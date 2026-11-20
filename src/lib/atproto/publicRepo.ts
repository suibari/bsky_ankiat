/** 認証なしで任意ユーザーの PDS からレコードを読む */
import { resolveIdentity } from './identity';

export interface RecordEntry<T> {
	uri: string;
	cid: string;
	value: T;
}

async function xrpc<T>(pds: string, method: string, params: Record<string, string>): Promise<T> {
	const url = new URL(`/xrpc/${method}`, pds);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	const res = await fetch(url);
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		const err = new Error(body.message ?? `${method} failed: HTTP ${res.status}`) as Error & {
			status?: number;
			error?: string;
		};
		err.status = res.status;
		err.error = body.error;
		throw err;
	}
	return res.json();
}

export async function getRecord<T>(
	did: string,
	collection: string,
	rkey: string
): Promise<RecordEntry<T> | undefined> {
	const { pds } = await resolveIdentity(did);
	try {
		return await xrpc<RecordEntry<T>>(pds, 'com.atproto.repo.getRecord', {
			repo: did,
			collection,
			rkey
		});
	} catch (e) {
		const err = e as { status?: number; error?: string };
		if (err.error === 'RecordNotFound' || err.status === 404) return undefined;
		throw e;
	}
}

export async function listAllRecords<T>(did: string, collection: string): Promise<RecordEntry<T>[]> {
	const { pds } = await resolveIdentity(did);
	const out: RecordEntry<T>[] = [];
	let cursor: string | undefined;
	do {
		const params: Record<string, string> = { repo: did, collection, limit: '100' };
		if (cursor) params.cursor = cursor;
		const res = await xrpc<{ records: RecordEntry<T>[]; cursor?: string }>(
			pds,
			'com.atproto.repo.listRecords',
			params
		);
		out.push(...res.records);
		cursor = res.records.length > 0 ? res.cursor : undefined;
	} while (cursor);
	return out;
}
