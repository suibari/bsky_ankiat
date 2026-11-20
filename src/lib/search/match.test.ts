import { describe, expect, it } from 'vitest';
import type { DeckRecord } from '../atproto/records';
import { searchDecks, type IndexedDeck } from './match';

const deck = (rkey: string, record: Partial<DeckRecord>, handle?: string): IndexedDeck => ({
	did: 'did:plc:x',
	handle,
	rkey,
	record: {
		name: rkey,
		cardCount: 0,
		chunkCount: 0,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...record
	}
});

describe('searchDecks', () => {
	const decks = [
		deck('a', { name: 'TOEIC 英単語', tags: ['英語'], updatedAt: '2026-01-02T00:00:00.000Z' }, 'alice.test'),
		deck('b', { name: '世界史', description: 'ヨーロッパ中心', updatedAt: '2026-01-03T00:00:00.000Z' }),
		deck('c', { name: 'TOEIC 非公開', listed: false })
	];

	it('名前・説明・タグ・ハンドルに対して部分一致し、全角半角と大文字小文字を区別しない', () => {
		expect(searchDecks(decks, 'ｔｏｅｉｃ').map((d) => d.rkey)).toEqual(['a']);
		expect(searchDecks(decks, 'ヨーロッパ').map((d) => d.rkey)).toEqual(['b']);
		expect(searchDecks(decks, '英語').map((d) => d.rkey)).toEqual(['a']);
		expect(searchDecks(decks, 'ALICE').map((d) => d.rkey)).toEqual(['a']);
	});

	it('複数の語はすべて含むものだけ', () => {
		expect(searchDecks(decks, 'toeic 英単語').map((d) => d.rkey)).toEqual(['a']);
		expect(searchDecks(decks, 'toeic 世界史')).toEqual([]);
	});

	it('listed: false は除外し、空の検索語では新しい順に全件', () => {
		expect(searchDecks(decks, '').map((d) => d.rkey)).toEqual(['b', 'a']);
	});
});
