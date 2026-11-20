// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Agent } from '@atproto/api';
import type { Write } from '../atproto/writes';
import { DELETE_ORDER, deleteAllAnkiatData } from './deleteData';

const DID = 'did:plc:deleteuser';

afterEach(() => vi.unstubAllGlobals());

describe('deleteAllAnkiatData', () => {
	it('AnkiAt の全コレクションのレコードを、デッキから順に削除する', async () => {
		const records = new Map<string, string[]>([
			['com.suibari.ankiat.deck', ['d1']],
			['com.suibari.ankiat.cardChunk', ['d1-0', 'd1-1']],
			['com.suibari.ankiat.reviewLog', ['r1']],
			['com.suibari.ankiat.preferences', ['self']],
			['app.bsky.feed.post', ['p1']]
		]);
		vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
			const url = new URL(String(input));
			if (url.host === 'plc.directory') {
				return Response.json({
					service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.test' }]
				});
			}
			const c = url.searchParams.get('collection')!;
			return Response.json({
				records: (records.get(c) ?? []).map((rkey) => ({ uri: `at://${DID}/${c}/${rkey}`, cid: 'x', value: {} }))
			});
		});
		const deleted: Write[][] = [];
		const agent = {
			com: { atproto: { repo: { applyWrites: async ({ writes }: { writes: Write[] }) => void deleted.push(writes) } } }
		} as unknown as Agent;
		localStorage.setItem('ankiat.theme', 'dark');
		localStorage.setItem('ankiat.helpSeen', '1');

		const total = await deleteAllAnkiatData(agent, DID);

		expect(total).toBe(5);
		expect(deleted.flat().map((w) => `${w.collection}/${w.rkey}`)).toEqual([
			'com.suibari.ankiat.deck/d1',
			'com.suibari.ankiat.cardChunk/d1-0',
			'com.suibari.ankiat.cardChunk/d1-1',
			'com.suibari.ankiat.reviewLog/r1',
			'com.suibari.ankiat.preferences/self'
		]);
		expect(deleted.flat().every((w) => w.$type === 'com.atproto.repo.applyWrites#delete')).toBe(true);
		expect(DELETE_ORDER.every((c) => c.startsWith('com.suibari.ankiat.'))).toBe(true);
		expect(localStorage.getItem('ankiat.theme')).toBe('dark');
		expect(localStorage.getItem('ankiat.helpSeen')).toBeNull();
	});
});
