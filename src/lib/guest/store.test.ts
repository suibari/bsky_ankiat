import { describe, expect, it } from 'vitest';
import type { ReviewEntry } from '../atproto/records';
import { GuestReviews, type GuestEntry } from './store';

function memoryStore() {
	let data: GuestEntry[] | undefined;
	return {
		get: async () => structuredClone(data),
		set: async (v: GuestEntry[]) => void (data = structuredClone(v)),
		clear: async () => void (data = undefined)
	};
}

const e = (cardId: string): ReviewEntry => ({ cardId, rating: 3, reviewedAt: '2026-01-01T00:00:00.000Z' });

describe('GuestReviews', () => {
	it('回答を順に保存し、デッキごとにまとめて返す', async () => {
		const g = new GuestReviews(memoryStore());
		await g.add('deckA', e('1'));
		await g.add('deckB', e('2'));
		expect(await g.add('deckA', e('3'))).toBe(3);
		const map = await g.byDeck();
		expect(map.get('deckA')?.map((x) => x.cardId)).toEqual(['1', '3']);
		expect(map.get('deckB')?.map((x) => x.cardId)).toEqual(['2']);
	});

	it('同時に追加しても取りこぼさない', async () => {
		const g = new GuestReviews(memoryStore());
		await Promise.all([g.add('d', e('1')), g.add('d', e('2')), g.add('d', e('3'))]);
		expect(await g.all()).toHaveLength(3);
	});

	it('clear で空になる', async () => {
		const g = new GuestReviews(memoryStore());
		await g.add('d', e('1'));
		await g.clear();
		expect(await g.all()).toEqual([]);
	});
});
