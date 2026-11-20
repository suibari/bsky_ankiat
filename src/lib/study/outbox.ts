/**
 * 回答のアウトボックス（docs/SPEC.md 3.4）
 * 回答はまず端末（IndexedDB）に保存し、まとめて reviewLog レコードとして PDS に書く。
 *
 * 二重書き込みを防ぐため、送信前に rkey（TID）を割り当てて保存しておき、
 * 再送時は同じ rkey で作成する。既に存在すれば書き込み済みとみなす。
 */
import { TID } from '@atproto/common-web';
import type { ReviewEntry } from '../atproto/records';

export const MAX_ENTRIES_PER_RECORD = 500;

export interface PendingBatch {
	rkey: string;
	deck: string;
	entries: ReviewEntry[];
}

export interface OutboxState {
	unassigned: { deck: string; entry: ReviewEntry }[];
	batches: PendingBatch[];
}

export interface OutboxStore {
	get(key: string): Promise<OutboxState | undefined>;
	set(key: string, value: OutboxState): Promise<void>;
}

export interface OutboxDeps {
	store: OutboxStore;
	/** reviewLog レコードを rkey 指定で作成する */
	write(batch: PendingBatch): Promise<void>;
	/** rkey のレコードが既に PDS にあるか */
	exists(rkey: string): Promise<boolean>;
	/** タブをまたいだ排他制御（なければタブ内のみ） */
	lock?<T>(name: string, fn: () => Promise<T>): Promise<T>;
	newRkey?(): string;
}

const empty = (): OutboxState => ({ unassigned: [], batches: [] });

export class Outbox {
	private readonly key: string;
	private chain: Promise<unknown> = Promise.resolve();

	constructor(
		private readonly did: string,
		private readonly deps: OutboxDeps
	) {
		this.key = `outbox:${did}`;
	}

	/** タブ内の操作を直列化し、さらにタブ間でもロックする */
	private serialize<T>(fn: () => Promise<T>): Promise<T> {
		const run = () =>
			this.deps.lock ? this.deps.lock(`ankiat-${this.key}`, fn) : fn();
		const next = this.chain.then(run, run);
		this.chain = next.catch(() => {});
		return next;
	}

	private async load(): Promise<OutboxState> {
		return (await this.deps.store.get(this.key)) ?? empty();
	}

	add(deck: string, entry: ReviewEntry): Promise<number> {
		return this.serialize(async () => {
			const s = await this.load();
			s.unassigned.push({ deck, entry });
			await this.deps.store.set(this.key, s);
			return s.unassigned.length;
		});
	}

	/** まだ PDS に書いていない回答（PDS の履歴と合わせて学習状態の計算に使う） */
	async pending(): Promise<OutboxState> {
		return this.load();
	}

	/** PDS に既にある rkey のバッチを取り除く（読み込み時の整合用） */
	forget(rkeysInPds: Set<string>): Promise<void> {
		return this.serialize(async () => {
			const s = await this.load();
			const kept = s.batches.filter((b) => !rkeysInPds.has(b.rkey));
			if (kept.length !== s.batches.length) {
				await this.deps.store.set(this.key, { ...s, batches: kept });
			}
		});
	}

	/** 未送信の回答を PDS に書く。書けたバッチ数を返す */
	flush(): Promise<number> {
		return this.serialize(async () => {
			let s = await this.load();
			if (s.unassigned.length > 0) {
				s = assignBatches(s, this.deps.newRkey ?? (() => TID.nextStr()));
				await this.deps.store.set(this.key, s);
			}
			let written = 0;
			for (const batch of [...s.batches]) {
				try {
					await this.deps.write(batch);
				} catch (e) {
					if (!(await this.deps.exists(batch.rkey).catch(() => false))) throw e;
				}
				s = { ...s, batches: s.batches.filter((b) => b.rkey !== batch.rkey) };
				await this.deps.store.set(this.key, s);
				written++;
			}
			return written;
		});
	}
}

/** 未割り当ての回答をデッキごと・500 件ごとのバッチにまとめ、rkey を割り当てる */
export function assignBatches(state: OutboxState, newRkey: () => string): OutboxState {
	const byDeck = new Map<string, ReviewEntry[]>();
	for (const { deck, entry } of state.unassigned) {
		const list = byDeck.get(deck) ?? [];
		list.push(entry);
		byDeck.set(deck, list);
	}
	const batches = [...state.batches];
	for (const [deck, entries] of byDeck) {
		for (let i = 0; i < entries.length; i += MAX_ENTRIES_PER_RECORD) {
			batches.push({ rkey: newRkey(), deck, entries: entries.slice(i, i + MAX_ENTRIES_PER_RECORD) });
		}
	}
	return { unassigned: [], batches };
}
