import { describe, expect, it } from 'vitest';
import { decksToSubscribe } from './import.svelte';

const entry = (deck: string) => ({ deck, entry: { cardId: '1', rating: 3 as const, reviewedAt: '2026-01-01T00:00:00.000Z' } });
const deck = (did: string, rkey: string) => `at://${did}/com.suibari.ankiat.deck/${rkey}`;

describe('decksToSubscribe', () => {
	it('他人のデッキだけを、重複なしで返す', () => {
		const items = [entry(deck('did:plc:b', '1')), entry(deck('did:plc:me', '2')), entry(deck('did:plc:b', '1'))];
		expect(decksToSubscribe(items, 'did:plc:me', [])).toEqual([deck('did:plc:b', '1')]);
	});

	it('すでに学習リストにあるデッキは除く', () => {
		const items = [entry(deck('did:plc:b', '1')), entry(deck('did:plc:c', '2'))];
		expect(decksToSubscribe(items, 'did:plc:me', [deck('did:plc:b', '1')])).toEqual([deck('did:plc:c', '2')]);
	});

	it('不正な URI は無視する', () => {
		expect(decksToSubscribe([entry('nope')], 'did:plc:me', [])).toEqual([]);
	});
});
