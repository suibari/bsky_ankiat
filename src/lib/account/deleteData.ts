/** AnkiAt のデータをすべて削除する（PDS と、この端末に保存したもの） */
import type { Agent } from '@atproto/api';
import { clear as idbClear } from 'idb-keyval';
import { NSID } from '../atproto/lexicons';
import { listAllRecords } from '../atproto/publicRepo';
import { commitWrites, del } from '../atproto/writes';

/** 読む側が「カードの欠けたデッキ」を見ないよう、デッキを最初に消す */
export const DELETE_ORDER = [
	NSID.deck,
	NSID.cardChunk,
	NSID.reviewLog,
	NSID.subscription,
	NSID.ankiSync,
	NSID.preferences
] as const;

/** 端末に残す設定（表示の好みは AnkiAt のデータではないため） */
const KEEP_LOCAL_KEYS = new Set(['ankiat.theme', 'ankiat.locale']);

export async function deleteAllAnkiatData(
	agent: Agent,
	did: string,
	progress: (collection: string, count: number) => void = () => {}
): Promise<number> {
	let total = 0;
	for (const collection of DELETE_ORDER) {
		const records = await listAllRecords(did, collection);
		progress(collection, records.length);
		if (records.length === 0) continue;
		await commitWrites(
			agent,
			did,
			records.map((r) => del(collection, r.uri.split('/').pop()!))
		);
		total += records.length;
	}
	await clearLocalData();
	return total;
}

export async function clearLocalData() {
	try {
		await idbClear();
	} catch {
		// IndexedDB が使えない環境では何もしない
	}
	try {
		for (const key of Object.keys(localStorage)) {
			if (key.startsWith('ankiat.') && !KEEP_LOCAL_KEYS.has(key)) localStorage.removeItem(key);
		}
	} catch {
		// localStorage が使えない環境では何もしない
	}
}
