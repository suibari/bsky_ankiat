import { describe, expect, it } from 'vitest';
import type { ReviewEntry } from '../atproto/records';
import { ankiOverrides, computeAnkiSchedule } from './schedule';

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('computeAnkiSchedule', () => {
	const now = local(2026, 11, 20, 14);

	it('復習カードは「最後の回答日 + 間隔」の区切り時刻（午前 4 時）が期日', () => {
		// 11/18 23:09 に回答、間隔 1 日 → 11/19 4:00
		const s = computeAnkiSchedule([{ cardId: 1, queue: 2 }], {
			'1': [
				{ id: local(2026, 11, 18, 23, 0).getTime(), ivl: -600, type: 0 },
				{ id: local(2026, 11, 18, 23, 9).getTime(), ivl: 1, type: 0 }
			]
		}, now);
		expect(s).toEqual([{ cardId: 'a1', kind: 'review', dueAt: local(2026, 11, 19, 4).toISOString() }]);
	});

	it('午前 4 時より前の回答は前日扱いで日数を数える', () => {
		const s = computeAnkiSchedule([{ cardId: 1, queue: 2 }], {
			'1': [{ id: local(2026, 11, 19, 2).getTime(), ivl: 1, type: 1 }]
		}, now);
		expect(s[0].dueAt).toBe(local(2026, 11, 19, 4).toISOString());
	});

	it('学習ステップは秒数で期日を求める', () => {
		const t = local(2026, 11, 20, 13, 0).getTime();
		const s = computeAnkiSchedule([{ cardId: 1, queue: 1 }], { '1': [{ id: t, ivl: -600, type: 0 }] }, now);
		expect(s).toEqual([{ cardId: 'a1', kind: 'learning', dueAt: new Date(t + 600_000).toISOString() }]);
	});

	it('新規・一時停止・履歴なし・延期を扱う', () => {
		const s = computeAnkiSchedule(
			[
				{ cardId: 1, queue: 0 },
				{ cardId: 2, queue: -1 },
				{ cardId: 3, queue: 2 },
				{ cardId: 4, queue: -2 }
			],
			{ '4': [{ id: local(2026, 11, 10, 12).getTime(), ivl: 3, type: 1 }] },
			now
		);
		expect(s).toEqual([
			{ cardId: 'a1', kind: 'new' },
			{ cardId: 'a2', kind: 'suspended' },
			// a3 は履歴がないので含めない
			{ cardId: 'a4', kind: 'review', dueAt: local(2026, 11, 21, 4).toISOString() }
		]);
	});
});

describe('ankiOverrides', () => {
	it('期日の保存後に AnkiAt で回答したカードは除く', () => {
		const entries: ReviewEntry[] = [
			{ cardId: 'a1', rating: 3, reviewedAt: '2026-11-20T01:00:00.000Z' },
			{ cardId: 'a2', rating: 3, reviewedAt: '2026-11-20T06:00:00.000Z' }
		];
		const m = ankiOverrides(
			[
				{ cardId: 'a1', kind: 'review', dueAt: '2026-11-19T19:00:00.000Z' },
				{ cardId: 'a2', kind: 'review', dueAt: '2026-11-19T19:00:00.000Z' }
			],
			'2026-11-20T05:00:00.000Z',
			entries
		);
		expect([...m.keys()]).toEqual(['a1']);
	});

	it('期日が保存されていなければ空', () => {
		expect(ankiOverrides(undefined, undefined, []).size).toBe(0);
	});
});
