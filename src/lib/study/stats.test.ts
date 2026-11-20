import { describe, expect, it } from 'vitest';
import type { ReviewEntry } from '../atproto/records';
import { computeProfileStats } from './stats';

const e = (cardId: string, m: number, d: number, rating: 1 | 2 | 3 | 4 = 3, ankiRevlogId?: number): ReviewEntry => ({
	cardId,
	rating,
	reviewedAt: new Date(2026, m - 1, d, 12).toISOString(),
	ankiRevlogId
});
const now = new Date(2026, 10, 20, 14);

describe('computeProfileStats', () => {
	it('総回答数・学習日数・連続・最長連続・カード数・正答率', () => {
		const s = computeProfileStats(
			new Map([
				['deckA', [e('1', 11, 1), e('2', 11, 2, 1), e('3', 11, 3), e('1', 11, 4), e('1', 11, 19), e('1', 11, 20)]],
				['deckB', [e('1', 11, 20, 1), e('x', 11, 20, 3, 5), e('x', 11, 20, 3, 5)]]
			]),
			now
		);
		expect(s.totalReviews).toBe(8);
		expect(s.studyDays).toBe(6);
		expect(s.currentStreak).toBe(2);
		expect(s.longestStreak).toBe(4);
		expect(s.uniqueCards).toBe(5); // deckA の 1,2,3 と deckB の 1,x
		expect(s.retention).toBe(6 / 8);
		expect(s.decks).toEqual([
			{ uri: 'deckA', reviews: 6 },
			{ uri: 'deckB', reviews: 2 }
		]);
	});

	it('直近 30 日の日ごとの回答数（今日が最後）', () => {
		const s = computeProfileStats(new Map([['d', [e('1', 11, 20), e('2', 11, 20), e('1', 10, 22), e('1', 10, 1)]]]), now);
		expect(s.daily).toHaveLength(30);
		expect(s.daily[29].count).toBe(2);
		expect(s.daily[0].date.getDate()).toBe(22);
		expect(s.daily[0].count).toBe(1);
		expect(s.daily.reduce((n, d) => n + d.count, 0)).toBe(3);
	});

	it('回答がなければ正答率は null', () => {
		const s = computeProfileStats(new Map(), now);
		expect(s).toMatchObject({ totalReviews: 0, retention: null, longestStreak: 0, currentStreak: 0 });
	});
});
