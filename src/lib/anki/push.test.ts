import { describe, expect, it } from 'vitest';
import type { ReviewLogRecord } from '../atproto/records';
import { planPush } from './push';

const D = 'at://did:x/com.suibari.ankiat.deck/d';
const log = (
	rkey: string,
	source: 'ankiat' | 'anki',
	entries: [string, number, string][],
	deck = D
): { rkey: string; value: ReviewLogRecord } => ({
	rkey,
	value: {
		deck,
		source,
		createdAt: '',
		entries: entries.map(([cardId, rating, reviewedAt]) => ({
			cardId,
			rating: rating as 1 | 2 | 3 | 4,
			reviewedAt
		}))
	}
});

describe('planPush', () => {
	const logs = [
		log('3aaa', 'ankiat', [['a1', 3, '2026-01-01T00:00:00Z']]),
		log('3bbb', 'anki', [['a2', 1, '2026-01-02T00:00:00Z']]),
		log('3ccc', 'ankiat', [
			['a3', 4, '2026-01-04T00:00:00Z'],
			['a2', 2, '2026-01-03T00:00:00Z']
		]),
		log('3ddd', 'ankiat', [['a9', 3, '2026-01-05T00:00:00Z']], 'at://did:x/com.suibari.ankiat.deck/other')
	];

	it('基準点より後の、このデッキの AnkiAt の回答だけを時系列順に送る', () => {
		expect(planPush(logs, D, '3aaa')).toEqual({
			answers: [
				{ cardId: 2, ease: 2 },
				{ cardId: 3, ease: 4 }
			],
			watermark: '3ccc'
		});
	});

	it('基準点がなければすべて対象', () => {
		expect(planPush(logs, D, undefined).answers.map((a) => a.cardId)).toEqual([1, 2, 3]);
	});

	it('対象がなければ基準点は変わらない', () => {
		expect(planPush(logs, D, '3zzz')).toEqual({ answers: [], watermark: '3zzz' });
	});

	it('Anki 由来でない ID のカードは送らない', () => {
		const p = planPush([log('3eee', 'ankiat', [['3xyz', 3, '2026-01-01T00:00:00Z']])], D, undefined);
		expect(p).toEqual({ answers: [], watermark: '3eee' });
	});
});
