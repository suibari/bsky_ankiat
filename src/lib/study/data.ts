/** 学習まわりの PDS / IndexedDB アクセス（docs/SPEC.md 4.3〜4.6） */
import type { Agent } from '@atproto/api';
import { TID } from '@atproto/common-web';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { NSID } from '../atproto/lexicons';
import { getRecord, listAllRecords } from '../atproto/publicRepo';
import { ankiOverrides } from '../anki/schedule';
import type { DeckRef } from '../decks/service';
import type {
	AnkiScheduleEntry,
	AnkiSyncRecord,
	PreferencesRecord,
	ReviewEntry,
	ReviewLogRecord,
	SubscriptionRecord
} from '../atproto/records';
import { commitWrites, create, del, update } from '../atproto/writes';
import { Outbox, type OutboxState } from './outbox';

export const DEFAULT_NEW_CARDS_PER_DAY = 20;

// ---- アウトボックス ----

const outboxes = new Map<string, Outbox>();

export function getOutbox(agent: Agent, did: string): Outbox {
	let o = outboxes.get(did);
	if (!o) {
		o = new Outbox(did, {
			store: {
				get: (k) => idbGet<OutboxState>(k),
				set: (k, v) => idbSet(k, v)
			},
			write: (batch) => {
				const value: ReviewLogRecord = {
					$type: NSID.reviewLog,
					deck: batch.deck,
					source: 'ankiat',
					entries: batch.entries,
					createdAt: new Date().toISOString()
				};
				return commitWrites(agent, did, [create(NSID.reviewLog, batch.rkey, value)]);
			},
			exists: async (rkey) => !!(await getRecord(did, NSID.reviewLog, rkey)),
			lock: (name, fn) =>
				typeof navigator !== 'undefined' && navigator.locks
					? navigator.locks.request(name, fn)
					: fn()
		});
		outboxes.set(did, o);
	}
	return o;
}

// ---- 回答履歴 ----

/** PDS の回答履歴と未送信の回答を合わせて、デッキ URI ごとに返す */
export async function loadReviewEntries(
	agent: Agent,
	did: string
): Promise<Map<string, ReviewEntry[]>> {
	const outbox = getOutbox(agent, did);
	const logs = await listAllRecords<ReviewLogRecord>(did, NSID.reviewLog);
	const rkeys = new Set(logs.map((l) => l.uri.split('/').pop()!));
	await outbox.forget(rkeys);

	const byDeck = new Map<string, ReviewEntry[]>();
	const push = (deck: string, entries: ReviewEntry[]) => {
		const list = byDeck.get(deck) ?? [];
		list.push(...entries);
		byDeck.set(deck, list);
	};
	for (const l of logs) push(l.value.deck, l.value.entries);
	const pending = await outbox.pending();
	for (const b of pending.batches) push(b.deck, b.entries);
	for (const u of pending.unassigned) push(u.deck, [u.entry]);
	return byDeck;
}

// ---- 学習対象（subscription） ----

export interface Subscription {
	rkey: string;
	deck: string;
	createdAt: string;
}

export async function listSubscriptions(did: string): Promise<Subscription[]> {
	const records = await listAllRecords<SubscriptionRecord>(did, NSID.subscription);
	return records
		.map((r) => ({ rkey: r.uri.split('/').pop()!, deck: r.value.deck, createdAt: r.value.createdAt }))
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function subscribe(agent: Agent, did: string, deckUri: string): Promise<Subscription> {
	const rkey = TID.nextStr();
	const value: SubscriptionRecord = {
		$type: NSID.subscription,
		deck: deckUri,
		createdAt: new Date().toISOString()
	};
	await commitWrites(agent, did, [create(NSID.subscription, rkey, value)]);
	return { rkey, deck: deckUri, createdAt: value.createdAt };
}

export async function unsubscribe(agent: Agent, did: string, deckUri: string): Promise<void> {
	const subs = (await listSubscriptions(did)).filter((s) => s.deck === deckUri);
	if (subs.length === 0) return;
	await commitWrites(
		agent,
		did,
		subs.map((s) => del(NSID.subscription, s.rkey))
	);
}

// ---- 設定 ----

const PREFS_RKEY = 'self';

export async function getPreferences(did: string): Promise<PreferencesRecord> {
	return (await getRecord<PreferencesRecord>(did, NSID.preferences, PREFS_RKEY))?.value ?? {};
}

export async function savePreferences(
	agent: Agent,
	did: string,
	patch: Partial<PreferencesRecord>
): Promise<PreferencesRecord> {
	const existing = await getRecord<PreferencesRecord>(did, NSID.preferences, PREFS_RKEY);
	const value: PreferencesRecord = { ...existing?.value, ...patch, $type: NSID.preferences };
	await commitWrites(agent, did, [
		existing
			? update(NSID.preferences, PREFS_RKEY, value)
			: create(NSID.preferences, PREFS_RKEY, value)
	]);
	return value;
}

// ---- Anki の期日 ----

/** 自分の Anki 連携デッキなら、保存されている Anki の期日を返す（それ以外は空） */
export async function loadAnkiOverrides(
	myDid: string,
	deck: DeckRef,
	entries: ReviewEntry[]
): Promise<Map<string, AnkiScheduleEntry>> {
	if (deck.did !== myDid || deck.record.source?.type !== 'anki') return new Map();
	const sync = await getRecord<AnkiSyncRecord>(myDid, NSID.ankiSync, deck.rkey).catch(() => undefined);
	return ankiOverrides(sync?.value.schedule, sync?.value.scheduleUpdatedAt, entries);
}
