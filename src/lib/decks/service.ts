/** デッキとカードの PDS への読み書き（docs/SPEC.md 3.2 / 4.1 / 4.2） */
import type { Agent } from '@atproto/api';
import { TID } from '@atproto/common-web';
import { NSID } from '../atproto/lexicons';
import { getRecord, listAllRecords } from '../atproto/publicRepo';
import {
	atUri,
	chunkRkey,
	type AnkiSource,
	type Card,
	type CardChunkRecord,
	type DeckRecord
} from '../atproto/records';
import { commitWrites, create, del, update, type Write } from '../atproto/writes';
import { applyCardChanges, type CardChanges } from './chunking';
import { updateCachedDeck } from '../search/index';

export interface DeckRef {
	did: string;
	rkey: string;
	uri: string;
	record: DeckRecord;
}

export interface LoadedDeck extends DeckRef {
	chunks: Card[][];
}

export interface DeckMeta {
	name: string;
	description?: string;
	tags?: string[];
	listed?: boolean;
}

function toRef(did: string, rkey: string, record: DeckRecord): DeckRef {
	return { did, rkey, uri: atUri(did, NSID.deck, rkey), record };
}

export async function listDecks(did: string): Promise<DeckRef[]> {
	const records = await listAllRecords<DeckRecord>(did, NSID.deck);
	return records
		.map((r) => toRef(did, r.uri.split('/').pop()!, r.value))
		.sort((a, b) => b.record.updatedAt.localeCompare(a.record.updatedAt));
}

export async function loadDeck(did: string, rkey: string): Promise<LoadedDeck | undefined> {
	const deck = await getRecord<DeckRecord>(did, NSID.deck, rkey);
	if (!deck) return undefined;
	const chunks = await Promise.all(
		Array.from({ length: deck.value.chunkCount }, async (_, i) => {
			const chunk = await getRecord<CardChunkRecord>(did, NSID.cardChunk, chunkRkey(rkey, i));
			return chunk?.value.cards ?? [];
		})
	);
	return { ...toRef(did, rkey, deck.value), chunks };
}

function cleanMeta(meta: DeckMeta): DeckMeta {
	const tags = (meta.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 10);
	return {
		name: meta.name.trim(),
		description: meta.description?.trim() || undefined,
		tags: tags.length > 0 ? tags : undefined,
		listed: meta.listed ?? true
	};
}

function chunkWrites(
	deckUri: string,
	deckRkey: string,
	prevChunkCount: number,
	chunks: Card[][],
	changed: number[],
	now: string
): Write[] {
	return changed.map((index) => {
		const value: CardChunkRecord = {
			$type: NSID.cardChunk,
			deck: deckUri,
			index,
			cards: chunks[index],
			updatedAt: now
		};
		const rkey = chunkRkey(deckRkey, index);
		return index < prevChunkCount
			? update(NSID.cardChunk, rkey, value)
			: create(NSID.cardChunk, rkey, value);
	});
}

/** デッキを作成する。チャンクを先に、デッキレコードを最後に書く */
export async function createDeck(
	agent: Agent,
	did: string,
	meta: DeckMeta,
	cards: Card[] = [],
	source?: AnkiSource
): Promise<LoadedDeck> {
	const rkey = TID.nextStr();
	const uri = atUri(did, NSID.deck, rkey);
	const now = new Date().toISOString();
	const plan = applyCardChanges([], { upserts: cards });
	const record: DeckRecord = {
		$type: NSID.deck,
		...cleanMeta(meta),
		cardCount: plan.cardCount,
		chunkCount: plan.chunks.length,
		...(source ? { source } : {}),
		createdAt: now,
		updatedAt: now
	};
	await commitWrites(agent, did, [
		...chunkWrites(uri, rkey, 0, plan.chunks, plan.changed, now),
		create(NSID.deck, rkey, record)
	]);
	void updateCachedDeck(did, rkey, record);
	return { did, rkey, uri, record, chunks: plan.chunks };
}

export async function updateDeckMeta(
	agent: Agent,
	deck: LoadedDeck,
	meta: DeckMeta
): Promise<LoadedDeck> {
	const record: DeckRecord = {
		...deck.record,
		...cleanMeta(meta),
		updatedAt: new Date().toISOString()
	};
	await commitWrites(agent, deck.did, [update(NSID.deck, deck.rkey, record)]);
	void updateCachedDeck(deck.did, deck.rkey, record);
	return { ...deck, record };
}

/** Anki 連携情報を設定・解除する（名前変更への追従、連携解除） */
export async function setDeckSource(
	agent: Agent,
	deck: LoadedDeck,
	source: AnkiSource | undefined
): Promise<LoadedDeck> {
	const { source: _old, ...rest } = deck.record;
	const record: DeckRecord = {
		...rest,
		...(source ? { source } : {}),
		updatedAt: new Date().toISOString()
	};
	await commitWrites(agent, deck.did, [update(NSID.deck, deck.rkey, record)]);
	void updateCachedDeck(deck.did, deck.rkey, record);
	return { ...deck, record };
}

/** カードの追加・更新・削除。変更のあったチャンクとデッキレコードだけを書き換える */
export async function saveCardChanges(
	agent: Agent,
	deck: LoadedDeck,
	changes: CardChanges
): Promise<LoadedDeck> {
	const now = new Date().toISOString();
	const plan = applyCardChanges(deck.chunks, changes);
	const record: DeckRecord = {
		...deck.record,
		cardCount: plan.cardCount,
		chunkCount: plan.chunks.length,
		updatedAt: now
	};
	await commitWrites(agent, deck.did, [
		...chunkWrites(deck.uri, deck.rkey, deck.record.chunkCount, plan.chunks, plan.changed, now),
		update(NSID.deck, deck.rkey, record)
	]);
	void updateCachedDeck(deck.did, deck.rkey, record);
	return { ...deck, record, chunks: plan.chunks };
}

/** デッキを削除する。読む側が「チャンクの欠けたデッキ」を見ないよう、デッキレコードを先に消す */
export async function deleteDeck(agent: Agent, deck: DeckRef): Promise<void> {
	const writes: Write[] = [del(NSID.deck, deck.rkey)];
	for (let i = 0; i < deck.record.chunkCount; i++) {
		writes.push(del(NSID.cardChunk, chunkRkey(deck.rkey, i)));
	}
	await commitWrites(agent, deck.did, writes);
	void updateCachedDeck(deck.did, deck.rkey, null);
}

export function newCardId(): string {
	return TID.nextStr();
}
