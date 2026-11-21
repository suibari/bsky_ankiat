import { describe, expect, it } from 'vitest';
import { fetchDeckSummary, isValidDeckRef } from './deck';

const DID = 'did:plc:abcdefghijklmnopqrstuvwx';

function fakeFetch(routes: Record<string, unknown>): typeof fetch {
	return (async (input: RequestInfo | URL) => {
		const url = String(input);
		for (const [prefix, body] of Object.entries(routes)) {
			if (url.startsWith(prefix) || url.includes(prefix)) return new Response(JSON.stringify(body), { status: 200 });
		}
		return new Response('{}', { status: 404 });
	}) as typeof fetch;
}

describe('isValidDeckRef', () => {
	it('DID と rkey の形式を確かめる', () => {
		expect(isValidDeckRef(DID, '3k2abc')).toBe(true);
		expect(isValidDeckRef('did:web:example.com', '3k2abc')).toBe(true);
		expect(isValidDeckRef('did:web:example.com/evil', '3k2abc')).toBe(false);
		expect(isValidDeckRef('did:plc:short', '3k2abc')).toBe(false);
		expect(isValidDeckRef(DID, '../x')).toBe(false);
	});
});

describe('fetchDeckSummary', () => {
	it('デッキと最初のカードの表面を取得する', async () => {
		const f = fakeFetch({
			[`https://plc.directory/${DID}`]: {
				alsoKnownAs: ['at://alice.test'],
				service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.test/' }]
			},
			'collection=com.suibari.ankiat.deck': {
				value: { name: '英単語', cardCount: 2, chunkCount: 1, updatedAt: '2026-01-01T00:00:00.000Z' }
			},
			'collection=com.suibari.ankiat.cardChunk': { value: { cards: [{ front: 'apple<br>&amp; pie' }] } }
		});
		expect(await fetchDeckSummary(DID, '3k2abc', f)).toEqual({
			did: DID,
			rkey: '3k2abc',
			name: '英単語',
			description: undefined,
			cardCount: 2,
			handle: 'alice.test',
			firstFront: 'apple & pie',
			updatedAt: '2026-01-01T00:00:00.000Z'
		});
	});

	it('デッキがなければ undefined', async () => {
		const f = fakeFetch({
			[`https://plc.directory/${DID}`]: {
				service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.test' }]
			}
		});
		expect(await fetchDeckSummary(DID, '3k2abc', f)).toBeUndefined();
	});
});
