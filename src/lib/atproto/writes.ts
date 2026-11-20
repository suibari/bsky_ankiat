/**
 * applyWrites の書き込みを、PDS の制限（1 リクエスト 200 操作・1,000,000 バイト）に収まるよう分割する。
 * docs/SPEC.md 2.2 / 4.2
 */

type RecordValue = { [key: string]: unknown };

export type Write =
	| { $type: 'com.atproto.repo.applyWrites#create'; collection: string; rkey: string; value: RecordValue }
	| { $type: 'com.atproto.repo.applyWrites#update'; collection: string; rkey: string; value: RecordValue }
	| { $type: 'com.atproto.repo.applyWrites#delete'; collection: string; rkey: string };

export const MAX_WRITES_PER_REQUEST = 200;
/** 1,000,000 バイトの上限に対し、リクエストの外枠や DPoP 等の余裕を残す */
export const MAX_REQUEST_BYTES = 900_000;

const encoder = new TextEncoder();
export function jsonBytes(value: unknown): number {
	return encoder.encode(JSON.stringify(value)).length;
}

export function create(collection: string, rkey: string, value: object): Write {
	return { $type: 'com.atproto.repo.applyWrites#create', collection, rkey, value: value as RecordValue };
}
export function update(collection: string, rkey: string, value: object): Write {
	return { $type: 'com.atproto.repo.applyWrites#update', collection, rkey, value: value as RecordValue };
}
export function del(collection: string, rkey: string): Write {
	return { $type: 'com.atproto.repo.applyWrites#delete', collection, rkey };
}

/** 書き込みを順序を保ったままバッチに分ける。1 件で上限を超えるものはエラー */
export function batchWrites(writes: Write[], maxBytes = MAX_REQUEST_BYTES): Write[][] {
	const batches: Write[][] = [];
	let current: Write[] = [];
	let size = 0;
	for (const w of writes) {
		const bytes = jsonBytes(w) + 1;
		if (bytes > maxBytes) {
			throw new Error(`a single write exceeds the request size limit (${bytes} bytes)`);
		}
		if (current.length >= MAX_WRITES_PER_REQUEST || size + bytes > maxBytes) {
			batches.push(current);
			current = [];
			size = 0;
		}
		current.push(w);
		size += bytes;
	}
	if (current.length > 0) batches.push(current);
	return batches;
}

/** 分割したバッチを順番に書き込む。途中で失敗した場合、それより前のバッチは書き込み済みになる */
export async function commitWrites(
	agent: { com: { atproto: { repo: { applyWrites: (input: { repo: string; writes: Write[] }) => Promise<unknown> } } } },
	repo: string,
	writes: Write[]
): Promise<void> {
	for (const batch of batchWrites(writes)) {
		await agent.com.atproto.repo.applyWrites({ repo, writes: batch });
	}
}
