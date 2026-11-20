/** デッキ検索の索引づくり（docs/SPEC.md 3.3） */
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { resolveIdentity } from '../atproto/identity';
import { NSID } from '../atproto/lexicons';
import { listAllRecords } from '../atproto/publicRepo';
import type { DeckRecord } from '../atproto/records';
import type { IndexedDeck } from './match';

export const RELAY_URL = 'https://bsky.network';
/** 索引のキャッシュ期間（暫定 1 時間） */
export const INDEX_TTL_MS = 60 * 60 * 1000;
const CACHE_KEY = 'search-index:v1';
const CONCURRENCY = 8;

export interface DeckIndex {
	fetchedAt: string;
	decks: IndexedDeck[];
	/** 読めなかったリポジトリの数 */
	failed: number;
}

/** リレーから、デッキを持つリポジトリの DID を列挙する */
export async function listDeckOwners(relay = RELAY_URL): Promise<string[]> {
	const dids: string[] = [];
	let cursor: string | undefined;
	do {
		const url = new URL('/xrpc/com.atproto.sync.listReposByCollection', relay);
		url.searchParams.set('collection', NSID.deck);
		url.searchParams.set('limit', '1000');
		if (cursor) url.searchParams.set('cursor', cursor);
		const res = await fetch(url);
		if (!res.ok) throw new Error(`listReposByCollection failed: HTTP ${res.status}`);
		const body: { repos: { did: string }[]; cursor?: string } = await res.json();
		dids.push(...body.repos.map((r) => r.did));
		cursor = body.repos.length > 0 ? body.cursor : undefined;
	} while (cursor);
	return [...new Set(dids)];
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const i = next++;
			results[i] = await fn(items[i]);
		}
	});
	await Promise.all(workers);
	return results;
}

export async function buildIndex(): Promise<DeckIndex> {
	const dids = await listDeckOwners();
	let failed = 0;
	const perRepo = await mapLimit(dids, CONCURRENCY, async (did) => {
		try {
			const [identity, records] = await Promise.all([
				resolveIdentity(did),
				listAllRecords<DeckRecord>(did, NSID.deck)
			]);
			return records.map((r) => ({
				did,
				handle: identity.handle,
				rkey: r.uri.split('/').pop()!,
				record: r.value
			}));
		} catch {
			failed++;
			return [];
		}
	});
	return { fetchedAt: new Date().toISOString(), decks: perRepo.flat(), failed };
}

/** キャッシュが有効ならそれを、なければ作り直して返す */
export async function getIndex(force = false): Promise<DeckIndex> {
	if (!force) {
		const cached = await idbGet<DeckIndex>(CACHE_KEY).catch(() => undefined);
		if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < INDEX_TTL_MS) return cached;
	}
	const index = await buildIndex();
	await idbSet(CACHE_KEY, index).catch(() => {});
	return index;
}
