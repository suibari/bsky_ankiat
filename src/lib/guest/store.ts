/**
 * 未ログインでのお試し学習の回答（docs/SPEC.md 3.7）
 * PDS には書かず、この端末（IndexedDB）にだけ保存する。ログイン時に PDS へ引き継ぐ。
 */
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import type { ReviewEntry } from '../atproto/records';

export interface GuestEntry {
	deck: string;
	entry: ReviewEntry;
}

export interface GuestStore {
	get(): Promise<GuestEntry[] | undefined>;
	set(value: GuestEntry[]): Promise<void>;
	clear(): Promise<void>;
}

const KEY = 'guest:reviews';

export const idbGuestStore: GuestStore = {
	get: () => idbGet<GuestEntry[]>(KEY),
	set: (value) => idbSet(KEY, value),
	clear: () => idbDel(KEY)
};

export class GuestReviews {
	private chain: Promise<unknown> = Promise.resolve();

	constructor(private readonly store: GuestStore = idbGuestStore) {}

	/** タブ内の読み書きを直列化する */
	private serialize<T>(fn: () => Promise<T>): Promise<T> {
		const next = this.chain.then(fn, fn);
		this.chain = next.catch(() => {});
		return next;
	}

	all(): Promise<GuestEntry[]> {
		return this.serialize(async () => (await this.store.get()) ?? []);
	}

	add(deck: string, entry: ReviewEntry): Promise<number> {
		return this.serialize(async () => {
			const list = (await this.store.get()) ?? [];
			list.push({ deck, entry });
			await this.store.set(list);
			return list.length;
		});
	}

	/** デッキ URI ごとの回答 */
	async byDeck(): Promise<Map<string, ReviewEntry[]>> {
		const map = new Map<string, ReviewEntry[]>();
		for (const { deck, entry } of await this.all()) {
			const list = map.get(deck) ?? [];
			list.push(entry);
			map.set(deck, list);
		}
		return map;
	}

	clear(): Promise<void> {
		return this.serialize(() => this.store.clear());
	}
}

export const guestReviews = new GuestReviews();
