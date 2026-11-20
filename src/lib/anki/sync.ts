/** Anki 連携: インポート・同期・連携解除（docs/SPEC.md 3.6） */
import type { Agent } from '@atproto/api';
import { TID } from '@atproto/common-web';
import { NSID } from '../atproto/lexicons';
import { getRecord, listAllRecords } from '../atproto/publicRepo';
import type { AnkiSyncRecord, Card, ReviewEntry, ReviewLogRecord } from '../atproto/records';
import { commitWrites, create, del, update } from '../atproto/writes';
import {
	createDeck,
	deleteDeck,
	listDecks,
	loadDeck,
	saveCardChanges,
	setDeckSource,
	type DeckRef,
	type LoadedDeck
} from '../decks/service';
import type { Outbox } from '../study/outbox';
import { MAX_ENTRIES_PER_RECORD } from '../study/outbox';
import { subscribe, unsubscribe } from '../study/data';
import type { AnkiConnect } from './client';
import { diffContent, directDeckQuery, revlogToEntry, toCard } from './convert';
import { planPush } from './push';
import { computeAnkiSchedule } from './schedule';

/** AnkiConnect に一度に渡す ID の数 */
const BATCH = 500;

export class AnkiDeckMissingError extends Error {}

export interface LinkedDeck {
	deck: DeckRef;
	sync?: AnkiSyncRecord;
}

export type Progress = (message: string) => void;

function chunks<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

// ---- Anki からの読み取り ----

/** そのデッキが直接持つカードの、カード mod とノート mod */
async function fetchModTimes(anki: AnkiConnect, deckName: string) {
	const ids = await anki.findCards(directDeckQuery(deckName));
	const infos = (
		await Promise.all(chunks(ids, BATCH).map((c) => anki.cardsInfo(c, ['cardId', 'note', 'mod'])))
	).flat();
	const noteIds = [...new Set(infos.map((i) => i.note))];
	const noteMods = new Map<number, number>();
	for (const c of chunks(noteIds, BATCH)) {
		for (const n of await anki.notesModTime(c)) noteMods.set(n.noteId, n.mod);
	}
	const mods = new Map<number, { mod: number; noteMod: number }>();
	for (const i of infos) mods.set(i.cardId, { mod: i.mod, noteMod: noteMods.get(i.note) ?? 0 });
	return mods;
}

/** カードを完全に取得する（findCards の順序を保つ） */
async function fetchCards(
	anki: AnkiConnect,
	cardIds: number[],
	mods: Map<number, { mod: number; noteMod: number }>
): Promise<Card[]> {
	const out: Card[] = [];
	for (const c of chunks(cardIds, BATCH)) {
		for (const info of await anki.cardsInfo(c)) {
			if (info.cardId === undefined) continue; // 取得中に削除されたカード
			out.push(toCard(info, mods.get(info.cardId)?.noteMod ?? 0));
		}
	}
	return out;
}

async function fetchReviewEntries(
	anki: AnkiConnect,
	deckName: string,
	startId: number,
	cardIds: Set<number>
): Promise<ReviewEntry[]> {
	const rows = await anki.cardReviews(deckName, startId);
	const out: ReviewEntry[] = [];
	for (const row of rows) {
		if (!cardIds.has(row[1])) continue; // サブデッキなど対象外のカード
		const e = revlogToEntry(row);
		if (e) out.push(e);
	}
	return out;
}

/** ankiDeckId から現在のデッキ名を求める。見つからなければ例外 */
async function resolveDeckName(anki: AnkiConnect, ankiDeckId: number): Promise<string> {
	const names = await anki.deckNamesAndIds();
	const name = Object.entries(names).find(([, id]) => id === ankiDeckId)?.[0];
	if (!name) throw new AnkiDeckMissingError(`Anki deck ${ankiDeckId} not found`);
	return name;
}

// ---- PDS への書き込み ----

async function writeAnkiReviewLogs(agent: Agent, did: string, deckUri: string, entries: ReviewEntry[]) {
	if (entries.length === 0) return;
	const now = new Date().toISOString();
	const writes = chunks(entries, MAX_ENTRIES_PER_RECORD).map((batch) => {
		const value: ReviewLogRecord = {
			$type: NSID.reviewLog,
			deck: deckUri,
			source: 'anki',
			entries: batch,
			createdAt: now
		};
		return create(NSID.reviewLog, TID.nextStr(), value);
	});
	await commitWrites(agent, did, writes);
}

/** Anki が計算した各カードの期日を求める（回答の反映より後に呼ぶ） */
async function fetchSchedule(anki: AnkiConnect, cardIds: number[]) {
	const cards: { cardId: number; queue: number }[] = [];
	const reviews: Record<string, { id: number; ivl: number; type: number }[]> = {};
	for (const c of chunks(cardIds, BATCH)) {
		for (const info of await anki.cardsInfo(c, ['cardId', 'queue'])) {
			if (info.cardId !== undefined) cards.push({ cardId: info.cardId, queue: info.queue });
		}
		Object.assign(reviews, await anki.getReviewsOfCards(c));
	}
	return { schedule: computeAnkiSchedule(cards, reviews), scheduleUpdatedAt: new Date().toISOString() };
}

async function putAnkiSync(agent: Agent, did: string, rkey: string, value: AnkiSyncRecord, exists: boolean) {
	const record = { ...value, $type: NSID.ankiSync };
	await commitWrites(agent, did, [
		exists ? update(NSID.ankiSync, rkey, record) : create(NSID.ankiSync, rkey, record)
	]);
}

// ---- 公開 API ----

export async function listLinkedDecks(did: string): Promise<LinkedDeck[]> {
	const [decks, syncs] = await Promise.all([
		listDecks(did),
		listAllRecords<AnkiSyncRecord>(did, NSID.ankiSync)
	]);
	const syncByDeck = new Map(syncs.map((s) => [s.value.deck, s.value]));
	return decks
		.filter((d) => d.record.source?.type === 'anki')
		.map((deck) => ({ deck, sync: syncByDeck.get(deck.uri) }));
}

/** Anki のデッキを取り込んで連携を始める（手順 1〜5） */
export async function importDeck(
	agent: Agent,
	did: string,
	anki: AnkiConnect,
	ankiDeckName: string,
	ankiDeckId: number,
	progress: Progress = () => {}
): Promise<LoadedDeck> {
	progress('cards');
	const mods = await fetchModTimes(anki, ankiDeckName);
	const cardIds = [...mods.keys()];
	const cards = await fetchCards(anki, cardIds, mods);

	progress('upload');
	const name = ankiDeckName.split('::').pop() || ankiDeckName;
	const deck = await createDeck(agent, did, { name, listed: true }, cards, {
		type: 'anki',
		ankiDeckId,
		ankiDeckName
	});
	await subscribe(agent, did, deck.uri);

	progress('history');
	const entries = await fetchReviewEntries(anki, ankiDeckName, 0, new Set(cardIds));
	await writeAnkiReviewLogs(agent, did, deck.uri, entries);

	const latest = await anki.getLatestReviewID(ankiDeckName);
	await putAnkiSync(
		agent,
		did,
		deck.rkey,
		{
			deck: deck.uri,
			lastImportedRevlogId: latest,
			lastSyncedAt: new Date().toISOString(),
			...(await fetchSchedule(anki, cardIds))
		},
		false
	);
	return deck;
}

export interface SyncResult {
	upserted: number;
	deleted: number;
	imported: number;
	pushed: number;
}

/** 連携デッキを 1 つ同期する（手順 0〜4） */
export async function syncDeck(
	agent: Agent,
	did: string,
	anki: AnkiConnect,
	linked: LinkedDeck,
	outbox: Outbox
): Promise<SyncResult> {
	const source = linked.deck.record.source!;
	// 手順 0: デッキの確認（存在しない名前で cardReviews 等を呼ぶとデッキが作られてしまう）
	const deckName = await resolveDeckName(anki, source.ankiDeckId);
	let deck = await loadDeck(did, linked.deck.rkey);
	if (!deck) throw new Error('deck record not found');
	if (source.ankiDeckName !== deckName) {
		deck = await setDeckSource(agent, deck, { ...source, ankiDeckName: deckName });
	}

	// 手順 1: 内容の同期（Anki → PDS）
	const mods = await fetchModTimes(anki, deckName);
	const diff = diffContent(mods, deck.chunks.flat());
	if (diff.upserts.length > 0 || diff.deletes.length > 0) {
		const ids = diff.upserts.map((id) => Number(id.slice(1)));
		const upserts = await fetchCards(anki, ids, mods);
		deck = await saveCardChanges(agent, deck, { upserts, deletes: diff.deletes });
	}

	// 手順 2: Anki 復習ログの取り込み
	const sync = linked.sync ?? (await getRecord<AnkiSyncRecord>(did, NSID.ankiSync, deck.rkey))?.value;
	const entries = await fetchReviewEntries(
		anki,
		deckName,
		sync?.lastImportedRevlogId ?? 0,
		new Set(mods.keys())
	);
	await writeAnkiReviewLogs(agent, did, deck.uri, entries);

	// 手順 3: AnkiAt の回答を Anki へ反映（未送信の回答を先に PDS へ書く）
	await outbox.flush();
	const logs = (await listAllRecords<ReviewLogRecord>(did, NSID.reviewLog)).map((r) => ({
		rkey: r.uri.split('/').pop()!,
		value: r.value
	}));
	const plan = planPush(logs, deck.uri, sync?.lastPushedReviewLogRkey);
	const existing = new Set(mods.keys());
	const answers = plan.answers.filter((a) => existing.has(a.cardId));
	for (const c of chunks(answers, 100)) await anki.answerCards(c);

	// 手順 4: 基準点の更新（手順 3 で生じた revlog は基準点より前になり、再取り込みされない）と、
	// 手順 5: Anki が計算した期日の保存（手順 3 の反映後の状態を使う）
	const latest = await anki.getLatestReviewID(deckName);
	await putAnkiSync(
		agent,
		did,
		deck.rkey,
		{
			deck: deck.uri,
			lastImportedRevlogId: latest,
			lastPushedReviewLogRkey: plan.watermark,
			lastSyncedAt: new Date().toISOString(),
			...(await fetchSchedule(anki, [...existing]))
		},
		!!sync
	);

	return {
		upserted: diff.upserts.length,
		deleted: diff.deletes.length,
		imported: entries.length,
		pushed: answers.length
	};
}

/** 連携解除。keep=true ならネイティブデッキとして残す */
export async function unlinkDeck(agent: Agent, did: string, deck: DeckRef, keep: boolean) {
	if (keep) {
		const loaded = await loadDeck(did, deck.rkey);
		if (loaded) await setDeckSource(agent, loaded, undefined);
	} else {
		await deleteDeck(agent, deck);
		await unsubscribe(agent, did, deck.uri);
	}
	if (await getRecord(did, NSID.ankiSync, deck.rkey)) {
		await commitWrites(agent, did, [del(NSID.ankiSync, deck.rkey)]);
	}
}
