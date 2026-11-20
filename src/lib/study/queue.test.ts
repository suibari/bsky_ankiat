import { describe, expect, it } from 'vitest';
import type { Card, ReviewEntry } from '../atproto/records';
import { buildQueue, dayStart, isDue } from './queue';
import { getScheduler, replay } from './scheduler';

const card = (id: string): Card => ({ id, front: id, back: id });

describe('dayStart', () => {
	it('午前 4 時より前は前日扱い', () => {
		expect(dayStart(new Date(2026, 0, 2, 3, 0)).getDate()).toBe(1);
		expect(dayStart(new Date(2026, 0, 2, 5, 0)).getDate()).toBe(2);
		expect(dayStart(new Date(2026, 0, 2, 5, 0)).getHours()).toBe(4);
	});
});

describe('buildQueue', () => {
	it('新規カードは 1 日の上限から今日導入した数を引いた分だけ出す', async () => {
		const s = await getScheduler();
		const now = new Date(2026, 0, 2, 12, 0);
		const cards = ['a', 'b', 'c', 'd', 'e'].map(card);
		const entries: ReviewEntry[] = [
			{ cardId: 'a', rating: 4, reviewedAt: new Date(2026, 0, 2, 9, 0).toISOString() }
		];
		const q = buildQueue(cards, replay(s, entries), entries, now, 3);
		expect(q.newCards.map((c) => c.id)).toEqual(['b', 'c']);
	});

	it('期日が来た復習カードと、20 分以内の学習ステップのカードを期日順に出す', async () => {
		const s = await getScheduler();
		const now = new Date('2026-03-01T12:00:00.000Z');
		const entries: ReviewEntry[] = [
			// 1 月に Good → もう期日が来ている
			{ cardId: 'old', rating: 3, reviewedAt: '2026-01-01T00:00:00.000Z' },
			// 直前に Again → 1 分後が期日（学習ステップ）
			{ cardId: 'again', rating: 1, reviewedAt: '2026-03-01T11:59:30.000Z' },
			// 直前に Easy → まだ先
			{ cardId: 'easy', rating: 4, reviewedAt: '2026-03-01T11:00:00.000Z' }
		];
		const cards = ['old', 'again', 'easy', 'new'].map(card);
		const q = buildQueue(cards, replay(s, entries), entries, now, 0);
		expect(q.due.map((c) => c.id)).toEqual(['old', 'again']);
		expect(q.newCards).toEqual([]);
	});

	it('デッキにないカードの履歴は無視する', async () => {
		const s = await getScheduler();
		const now = new Date(2026, 0, 2, 12, 0);
		const entries: ReviewEntry[] = [
			{ cardId: 'deleted', rating: 3, reviewedAt: new Date(2026, 0, 2, 9, 0).toISOString() }
		];
		const q = buildQueue([card('a')], replay(s, entries), entries, now, 1);
		expect(q.newCards.map((c) => c.id)).toEqual(['a']);
	});
});

describe('isDue', () => {
	const now = new Date(2026, 10, 20, 14, 0);
	it('復習カードは翌朝 4 時より前に期日が来れば今日の分', () => {
		expect(isDue(new Date(2026, 10, 20, 21, 0), false, now)).toBe(true);
		expect(isDue(new Date(2026, 10, 21, 3, 59), false, now)).toBe(true);
		expect(isDue(new Date(2026, 10, 21, 4, 0), false, now)).toBe(false);
	});
	it('学習ステップは 20 分先まで', () => {
		expect(isDue(new Date(2026, 10, 20, 14, 20), true, now)).toBe(true);
		expect(isDue(new Date(2026, 10, 20, 14, 21), true, now)).toBe(false);
	});
});

describe('buildQueue（Anki の期日）', () => {
	it('Anki の期日を FSRS より優先し、一時停止は出さず、新規扱いは新規に入れる', async () => {
		const s = await getScheduler();
		const now = new Date(2026, 10, 20, 14, 0);
		// FSRS では 9 日後が期日になる履歴
		const entries: ReviewEntry[] = [
			{ cardId: 'a1', rating: 3, reviewedAt: new Date(2026, 10, 18, 23, 0).toISOString() },
			{ cardId: 'a1', rating: 3, reviewedAt: new Date(2026, 10, 18, 23, 9).toISOString() },
			{ cardId: 'a2', rating: 3, reviewedAt: new Date(2026, 10, 18, 23, 0).toISOString() },
			{ cardId: 'a3', rating: 3, reviewedAt: new Date(2026, 10, 18, 23, 0).toISOString() }
		];
		const overrides = new Map([
			['a1', { cardId: 'a1', kind: 'review' as const, dueAt: new Date(2026, 10, 19, 4).toISOString() }],
			['a2', { cardId: 'a2', kind: 'suspended' as const }],
			['a3', { cardId: 'a3', kind: 'new' as const }]
		]);
		const cards = ['a1', 'a2', 'a3'].map(card);
		const withAnki = buildQueue(cards, replay(s, entries), entries, now, 20, overrides);
		expect(withAnki.due.map((c) => c.id)).toEqual(['a1']);
		expect(withAnki.newCards.map((c) => c.id)).toEqual(['a3']);
		const fsrsOnly = buildQueue(cards, replay(s, entries), entries, now, 20);
		expect(fsrsOnly.due).toEqual([]);
	});
});
