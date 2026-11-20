import { describe, expect, it } from 'vitest';
import type { ReviewEntry } from '../atproto/records';
import { getScheduler, normalizeEntries, replay, State } from './scheduler';

const entry = (cardId: string, reviewedAt: string, rating: 1 | 2 | 3 | 4 = 3, ankiRevlogId?: number): ReviewEntry => ({
	cardId,
	reviewedAt,
	rating,
	ankiRevlogId
});

describe('normalizeEntries', () => {
	it('時刻順に並べ、ankiRevlogId や同一時刻の重複を除く', () => {
		const out = normalizeEntries([
			entry('a', '2026-01-02T00:00:00.000Z', 3, 2),
			entry('a', '2026-01-01T00:00:00.000Z', 3, 1),
			entry('a', '2026-01-02T00:00:00.000Z', 3, 2),
			entry('b', '2026-01-03T00:00:00.000Z'),
			entry('b', '2026-01-03T00:00:00.000Z')
		]);
		expect(out.map((e) => `${e.cardId}${e.reviewedAt.slice(8, 10)}`)).toEqual(['a01', 'a02', 'b03']);
	});
});

describe('replay', () => {
	it('同じ履歴からは常に同じ状態になる（fuzz なし）', async () => {
		const s = await getScheduler();
		const log = [
			entry('a', '2026-01-01T00:00:00.000Z', 3),
			entry('a', '2026-01-05T00:00:00.000Z', 3),
			entry('b', '2026-01-01T00:00:00.000Z', 1)
		];
		const x = replay(s, log);
		const y = replay(s, [...log].reverse());
		expect(x.get('a')?.dueAt.toISOString()).toBe(y.get('a')?.dueAt.toISOString());
		expect(x.get('a')?.state).toBe(State.Review);
		expect(x.get('b')?.state).toBe(State.Learning);
		expect(x.has('c')).toBe(false);
	});
});
