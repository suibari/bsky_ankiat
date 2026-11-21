/** OGP 用に、デッキの情報を PDS から取得する（Pages Functions から使う） */
import { htmlToPlain, type DeckSummary } from './text';

type Fetch = typeof fetch;

const DID_RE = /^did:(plc:[a-z2-7]{24}|web:[a-zA-Z0-9.-]+)$/;
const RKEY_RE = /^[A-Za-z0-9._~:-]{1,512}$/;
const DECK = 'com.suibari.ankiat.deck';
const CHUNK = 'com.suibari.ankiat.cardChunk';

export function isValidDeckRef(did: string, rkey: string): boolean {
	return DID_RE.test(did) && RKEY_RE.test(rkey);
}

interface DidDocument {
	alsoKnownAs?: string[];
	service?: { id: string; type: string; serviceEndpoint: string }[];
}

async function resolve(did: string, f: Fetch): Promise<{ pds: string; handle?: string }> {
	const url = did.startsWith('did:plc:')
		? `https://plc.directory/${did}`
		: `https://${did.slice('did:web:'.length)}/.well-known/did.json`;
	const res = await f(url);
	if (!res.ok) throw new Error(`resolve ${did}: HTTP ${res.status}`);
	const doc = (await res.json()) as DidDocument;
	const pds = doc.service?.find(
		(s) => s.id.endsWith('#atproto_pds') && s.type === 'AtprotoPersonalDataServer'
	)?.serviceEndpoint;
	if (!pds) throw new Error(`no PDS for ${did}`);
	const handle = doc.alsoKnownAs?.find((a) => a.startsWith('at://'))?.slice('at://'.length);
	return { pds: pds.replace(/\/$/, ''), handle };
}

async function getRecord<T>(f: Fetch, pds: string, repo: string, collection: string, rkey: string) {
	const url = new URL('/xrpc/com.atproto.repo.getRecord', pds);
	url.searchParams.set('repo', repo);
	url.searchParams.set('collection', collection);
	url.searchParams.set('rkey', rkey);
	const res = await f(url);
	if (!res.ok) return undefined;
	return ((await res.json()) as { value: T }).value;
}

interface DeckRecord {
	name: string;
	description?: string;
	cardCount: number;
	chunkCount: number;
	updatedAt: string;
}

/** デッキがなければ undefined */
export async function fetchDeckSummary(did: string, rkey: string, f: Fetch = fetch): Promise<DeckSummary | undefined> {
	if (!isValidDeckRef(did, rkey)) return undefined;
	const { pds, handle } = await resolve(did, f);
	const deck = await getRecord<DeckRecord>(f, pds, did, DECK, rkey);
	if (!deck || typeof deck.name !== 'string') return undefined;
	let firstFront: string | undefined;
	if (deck.chunkCount > 0) {
		const chunk = await getRecord<{ cards?: { front?: string }[] }>(f, pds, did, CHUNK, `${rkey}-0`).catch(
			() => undefined
		);
		const front = chunk?.cards?.[0]?.front;
		if (typeof front === 'string') firstFront = htmlToPlain(front) || undefined;
	}
	return {
		did,
		rkey,
		name: deck.name,
		description: deck.description,
		cardCount: deck.cardCount ?? 0,
		handle,
		firstFront,
		updatedAt: deck.updatedAt ?? ''
	};
}

/** プロフィールのアバター（サムネイル）の URL。取れなければ undefined */
export async function fetchAvatarUrl(did: string, f: Fetch = fetch): Promise<string | undefined> {
	try {
		const res = await f(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`);
		if (!res.ok) return undefined;
		const avatar = ((await res.json()) as { avatar?: string }).avatar;
		if (!avatar) return undefined;
		// satori は webp を読めないので、サムネイルを JPEG で取得する
		return avatar.replace('/img/avatar/', '/img/avatar_thumbnail/').replace(/@[a-z]+$/, '') + '@jpeg';
	} catch {
		return undefined;
	}
}
