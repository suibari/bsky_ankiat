/** Bluesky のプロフィール（表示名・アバター）。公開 AppView から取得し、まとめて問い合わせる */

export interface Profile {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
}

const APPVIEW = 'https://public.api.bsky.app';
const BATCH_MAX = 25;
const cache = new Map<string, Promise<Profile | undefined>>();
let queue: { did: string; resolve: (p: Profile | undefined) => void }[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

async function flush() {
	timer = undefined;
	const items = queue;
	queue = [];
	for (let i = 0; i < items.length; i += BATCH_MAX) {
		const batch = items.slice(i, i + BATCH_MAX);
		const url = new URL('/xrpc/app.bsky.actor.getProfiles', APPVIEW);
		for (const { did } of batch) url.searchParams.append('actors', did);
		let profiles: Profile[] = [];
		try {
			const res = await fetch(url);
			if (res.ok) profiles = (await res.json()).profiles;
		} catch {
			// 取得できなければ DID / ハンドルだけで表示する
		}
		for (const item of batch) item.resolve(profiles.find((p) => p.did === item.did));
	}
}

/** 同じタイミングで呼ばれた分を 1 回の getProfiles にまとめる */
export function getProfile(did: string): Promise<Profile | undefined> {
	let p = cache.get(did);
	if (!p) {
		p = new Promise((resolve) => {
			queue.push({ did, resolve });
			timer ??= setTimeout(flush, 10);
		});
		cache.set(did, p);
	}
	return p;
}

export function profileUrl(handleOrDid: string): string {
	return `https://bsky.app/profile/${handleOrDid}`;
}

/** ハンドルまたは DID からプロフィールを取得する（ページの URL 用） */
export async function resolveActor(actor: string): Promise<Profile | undefined> {
	if (actor.startsWith('did:')) return getProfile(actor);
	try {
		const url = new URL('/xrpc/app.bsky.actor.getProfile', APPVIEW);
		url.searchParams.set('actor', actor);
		const res = await fetch(url);
		if (!res.ok) return undefined;
		const p: Profile = await res.json();
		cache.set(p.did, Promise.resolve(p));
		return p;
	} catch {
		return undefined;
	}
}

/** AnkiAt のプロフィールページ */
export function ankiatProfilePath(handleOrDid: string): string {
	return `/profile/${handleOrDid}`;
}

/** ハンドル入力の候補（Bluesky の公開 AppView の typeahead） */
export async function searchActors(q: string, signal?: AbortSignal, limit = 6): Promise<Profile[]> {
	const url = new URL('/xrpc/app.bsky.actor.searchActorsTypeahead', APPVIEW);
	url.searchParams.set('q', q);
	url.searchParams.set('limit', String(limit));
	const res = await fetch(url, { signal });
	if (!res.ok) return [];
	return (await res.json()).actors as Profile[];
}
