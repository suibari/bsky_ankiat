import { describe, expect, it } from 'vitest';
import type { Card, ReviewEntry } from '../atproto/records';
import { buildQueue, dayStart } from './queue';
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
