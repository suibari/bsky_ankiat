import { describe, expect, it } from 'vitest';
import { computeStreak } from './streak';

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).toISOString();
const now = new Date(2026, 10, 20, 14, 0);

describe('computeStreak', () => {
	it('今日まで続いている日数と今日の回答数', () => {
		const s = computeStreak([at(11, 18), at(11, 19), at(11, 20), at(11, 20), at(11, 15)], now);
		expect(s.current).toBe(3);
		expect(s.activeToday).toBe(true);
		expect(s.reviewedToday).toBe(2);
		expect(s.lastWeek).toEqual([false, true, false, false, true, true, true]); // 11/14〜20
	});

	it('今日まだでも、昨日やっていれば連続は途切れない', () => {
		const s = computeStreak([at(11, 18), at(11, 19)], now);
		expect(s).toMatchObject({ current: 2, activeToday: false, reviewedToday: 0 });
	});

	it('昨日も今日もやっていなければ 0', () => {
		expect(computeStreak([at(11, 17)], now).current).toBe(0);
	});

	it('午前 4 時より前の学習は前日に数える', () => {
		const s = computeStreak([at(11, 19, 12), at(11, 20, 2)], now);
		expect(s).toMatchObject({ current: 1, activeToday: false });
	});
});
