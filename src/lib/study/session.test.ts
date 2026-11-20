import { describe, expect, it } from 'vitest';
import type { Card, ReviewEntry } from '../atproto/records';
import { getScheduler } from './scheduler';
import { StudySession } from './session.svelte';

const card = (id: string): Card => ({ id, front: id, back: id });

async function setup(cards: Card[], newLimit = 20) {
	const s = await getScheduler();
	let now = new Date(2026, 0, 2, 12, 0);
	const recorded: ReviewEntry[] = [];
	let flushed = 0;
	const session = new StudySession({
		scheduler: s,
		deckUri: 'at://did:x/com.suibari.ankiat.deck/d',
		cards,
		states: new Map(),
		entries: [],
		newLimit,
		record: async (e) => recorded.push(e),
		flush: async () => void flushed++,
		now: () => now
	});
	return {
		session,
		recorded,
		flushed: () => flushed,
		advance: (ms: number) => (now = new Date(now.getTime() + ms))
	};
}

describe('StudySession', () => {
	it('新規カードを上限まで出し、回答を記録する', async () => {
		const { session, recorded } = await setup(['a', 'b', 'c'].map(card), 2);
		expect(session.counts).toEqual({ due: 0, new: 2, learning: 0 });
		expect(session.current?.id).toBe('a');
		session.reveal();
		await session.answer(4);
		session.reveal();
		await session.answer(4);
		expect(session.done).toBe(true);
		expect(recorded.map((e) => [e.cardId, e.rating])).toEqual([
			['a', 4],
			['b', 4]
		]);
	});

	it('裏面を見る前は回答できない', async () => {
		const { session, recorded } = await setup([card('a')]);
		await session.answer(3);
		expect(recorded).toEqual([]);
		expect(session.current?.id).toBe('a');
	});

	it('Again にしたカードは学習ステップとしてセッション内で再出題される', async () => {
		const { session, advance } = await setup(['a', 'b'].map(card));
		session.reveal();
		await session.answer(1); // a: Again → 1 分後
		expect(session.current?.id).toBe('b');
		expect(session.counts.learning).toBe(1);
		advance(2 * 60 * 1000);
		session.reveal();
		await session.answer(4); // b: Easy
		expect(session.current?.id).toBe('a');
	});

	it('他に出すカードがなければ、期日前の学習ステップを先取りする', async () => {
		const { session } = await setup([card('a')]);
		session.reveal();
		await session.answer(1);
		expect(session.current?.id).toBe('a');
	});

	it('未送信が 20 件たまったら書き込む', async () => {
		const cards = Array.from({ length: 25 }, (_, i) => card(String(i)));
		const { session, flushed } = await setup(cards, 25);
		for (let i = 0; i < 20; i++) {
			session.reveal();
			await session.answer(4);
		}
		expect(flushed()).toBe(1);
	});
});
