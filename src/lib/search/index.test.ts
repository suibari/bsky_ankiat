import { describe, expect, it } from 'vitest';
import type { DeckRecord } from '../atproto/records';
import { patchIndex, type DeckIndex } from './index';

const record = (name: string): DeckRecord => ({
	name,
	cardCount: 0,
	chunkCount: 0,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
});

describe('patchIndex', () => {
	const index: DeckIndex = {
		fetchedAt: '2026-01-01T00:00:00.000Z',
		failed: 0,
		decks: [
			{ did: 'did:a', rkey: '1', handle: 'a.test', record: record('旧名') },
			{ did: 'did:b', rkey: '1', handle: 'b.test', record: record('他人') }
		]
	};

	it('同じデッキを差し替え、ハンドルは引き継ぐ', () => {
		const out = patchIndex(index, 'did:a', '1', record('新名'));
		expect(out.decks.find((d) => d.did === 'did:a')).toEqual({
			did: 'did:a',
			rkey: '1',
			handle: 'a.test',
			record: record('新名')
		});
		expect(out.decks).toHaveLength(2);
		expect(index.decks[0].record.name).toBe('旧名');
	});

	it('新しいデッキは追加し、null なら削除する', () => {
		expect(patchIndex(index, 'did:a', '2', record('追加'), 'a.test').decks).toHaveLength(3);
		expect(patchIndex(index, 'did:a', '1', null).decks.map((d) => d.did)).toEqual(['did:b']);
	});
});
