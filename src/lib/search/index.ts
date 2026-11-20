/** デッキ検索の索引づくり（docs/SPEC.md 3.3） */
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { resolveIdentity } from '../atproto/identity';
import { NSID } from '../atproto/lexicons';
import { listAllRecords } from '../atproto/publicRepo';
import type { DeckRecord } from '../atproto/records';
import { countLearners } from './learners';
import type { IndexedDeck } from './match';

export const RELAY_URL = 'https://bsky.network';
/** 索引のキャッシュ期間（暫定 1 時間） */
export const INDEX_TTL_MS = 60 * 60 * 1000;
const CACHE_KEY = 'search-index:v2';
const CONCURRENCY = 8;

export interface DeckIndex {
	fetchedAt: string;
	decks: IndexedDeck[];
	/** 読めなかったリポジトリの数 */
	failed: number;
}

/** リレーから、指定したコレクションを持つリポジトリの DID を列挙する */
export async function listReposWithCollection(collection: string, relay = RELAY_URL): Promise<string[]> {
	const dids: string[] = [];
	let cursor: string | undefined;
	do {
		const url = new URL('/xrpc/com.atproto.sync.listReposByCollection', relay);
		url.searchParams.set('collection', collection);
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

/** 学習リスト（subscription）を集めて、デッキごとの学習中の人数を数える */
async function collectLearners(): Promise<Map<string, number>> {
	const dids = await listReposWithCollection(NSID.subscription);
	const subs = new Map<string, string[]>();
	await mapLimit(dids, CONCURRENCY, async (did) => {
		try {
			const records = await listAllRecords<{ deck: string }>(did, NSID.subscription);
			subs.set(
				did,
				records.map((r) => r.value.deck)
			);
		} catch {
			// 読めないリポジトリは数えない
		}
	});
	return countLearners(subs);
}

export async function buildIndex(): Promise<DeckIndex> {
	const [dids, learners] = await Promise.all([
		listReposWithCollection(NSID.deck),
		collectLearners().catch(() => new Map<string, number>())
	]);
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
				record: r.value,
				learners: learners.get(r.uri) ?? 0
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

/** 索引の 1 デッキ分を差し替える（record が null なら削除）。元の索引は変更しない */
export function patchIndex(
	index: DeckIndex,
	did: string,
	rkey: string,
	record: DeckRecord | null,
	handle?: string
): DeckIndex {
	const rest = index.decks.filter((d) => !(d.did === did && d.rkey === rkey));
	if (!record) return { ...index, decks: rest };
	const prev = index.decks.find((d) => d.did === did && d.rkey === rkey);
	return {
		...index,
		decks: [...rest, { did, rkey, record, handle: prev?.handle ?? handle, learners: prev?.learners ?? 0 }]
	};
}

/**
 * 自分のデッキを作成・編集・削除したとき、端末の索引キャッシュにも反映する
 * （キャッシュが切れるまで古い名前が検索に出ないように）
 */
export async function updateCachedDeck(did: string, rkey: string, record: DeckRecord | null) {
	try {
		const cached = await idbGet<DeckIndex>(CACHE_KEY);
		if (!cached) return;
		const handle = record ? (await resolveIdentity(did).catch(() => undefined))?.handle : undefined;
		await idbSet(CACHE_KEY, patchIndex(cached, did, rkey, record, handle));
	} catch {
		// キャッシュの更新に失敗しても、次の再構築で正しくなる
	}
}

/** 学習リストへの追加・削除を、索引キャッシュの人数にすぐ反映する */
export async function adjustCachedLearners(deckUri: string, delta: 1 | -1) {
	try {
		const cached = await idbGet<DeckIndex>(CACHE_KEY);
		if (!cached) return;
		const decks = cached.decks.map((d) =>
			`at://${d.did}/${NSID.deck}/${d.rkey}` === deckUri
				? { ...d, learners: Math.max(0, (d.learners ?? 0) + delta) }
				: d
		);
		await idbSet(CACHE_KEY, { ...cached, decks });
	} catch {
		// 次の再構築で正しくなる
	}
}

/** 期限切れでもよいので、キャッシュ済みの索引を返す（作り直さない） */
export async function getCachedIndex(): Promise<DeckIndex | undefined> {
	try {
		return await idbGet<DeckIndex>(CACHE_KEY);
	} catch {
		return undefined;
	}
}
