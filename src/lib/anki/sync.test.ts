// @vitest-environment jsdom
/**
 * 偽の PDS（fetch と applyWrites を差し替え）と偽の AnkiConnect を使った同期の結合テスト
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent } from '@atproto/api';
import { NSID } from '../atproto/lexicons';
import type { AnkiSyncRecord, DeckRecord, ReviewLogRecord } from '../atproto/records';
import type { Write } from '../atproto/writes';
import { Outbox, type OutboxState } from '../study/outbox';
import type { AnkiCardInfo, AnkiConnect, RevlogRow } from './client';
import { importDeck, listLinkedDecks, syncDeck, unlinkDeck, AnkiDeckMissingError } from './sync';

const DID = 'did:plc:testuser';

class FakePds {
	records = new Map<string, unknown>(); // `${collection}/${rkey}` → value

	agent = {
		com: {
			atproto: {
				repo: {
					applyWrites: async ({ writes }: { repo: string; writes: Write[] }) => {
						for (const w of writes) {
							const key = `${w.collection}/${w.rkey}`;
							if (w.$type.endsWith('#create')) {
								if (this.records.has(key)) throw new Error('Record already exists');
								this.records.set(key, structuredClone((w as { value: unknown }).value));
							} else if (w.$type.endsWith('#update')) {
								this.records.set(key, structuredClone((w as { value: unknown }).value));
							} else {
								this.records.delete(key);
							}
						}
					}
				}
			}
		}
	} as unknown as Agent;

	list<T>(collection: string): { rkey: string; value: T }[] {
		return [...this.records.entries()]
			.filter(([k]) => k.startsWith(`${collection}/`))
			.map(([k, v]) => ({ rkey: k.slice(collection.length + 1), value: v as T }))
			.sort((a, b) => a.rkey.localeCompare(b.rkey));
	}

	fetch = async (input: RequestInfo | URL): Promise<Response> => {
		const url = new URL(String(input));
		if (url.host === 'plc.directory') {
			return Response.json({
				alsoKnownAs: ['at://user.test'],
				service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.test' }]
			});
		}
		const collection = url.searchParams.get('collection')!;
		if (url.pathname.endsWith('getRecord')) {
			const key = `${collection}/${url.searchParams.get('rkey')}`;
			if (!this.records.has(key)) return Response.json({ error: 'RecordNotFound' }, { status: 400 });
			return Response.json({ uri: `at://${DID}/${key}`, cid: 'x', value: this.records.get(key) });
		}
		if (url.pathname.endsWith('listRecords')) {
			const records = this.list(collection).map((r) => ({
				uri: `at://${DID}/${collection}/${r.rkey}`,
				cid: 'x',
				value: r.value
			}));
			return Response.json({ records });
		}
		throw new Error(`unexpected fetch ${url}`);
	};
}

class FakeAnki {
	decks: Record<string, number> = { 英語: 1, '英語::TOEIC': 2 };
	cards = new Map<number, { deck: string; note: number; q: string; a: string; mod: number }>();
	noteMods = new Map<number, number>();
	revlog: RevlogRow[] = [];
	answered: { cardId: number; ease: number }[] = [];
	clock = 1_700_000_000_000;

	addCard(cardId: number, deck: string, q: string) {
		this.cards.set(cardId, { deck, note: cardId * 10, q, a: `${q}<hr id=answer>答え`, mod: 100 });
		this.noteMods.set(cardId * 10, 100);
	}
	review(cardId: number, ease: number) {
		this.revlog.push([++this.clock, cardId, -1, ease, 1, 0, 2500, 3000, 1]);
	}

	client = {
		deckNamesAndIds: async () => ({ ...this.decks }),
		findCards: async (query: string) => {
			const m = /^"deck:(.+?)" -"deck:.+::\*"$/.exec(query)!;
			const name = m[1].replace(/\\(.)/g, '$1');
			return [...this.cards.entries()].filter(([, c]) => c.deck === name).map(([id]) => id);
		},
		cardsInfo: async (ids: number[]) =>
			ids.map((id) => {
				const c = this.cards.get(id);
				if (!c) return {} as AnkiCardInfo;
				return { cardId: id, note: c.note, deckName: c.deck, question: c.q, answer: c.a, mod: c.mod };
			}),
		notesModTime: async (notes: number[]) => notes.map((n) => ({ noteId: n, mod: this.noteMods.get(n)! })),
		cardReviews: async (deck: string, startID: number) => {
			if (!(deck in this.decks)) throw new Error('cardReviews would create a deck');
			return this.revlog.filter((r) => r[0] > startID && this.cards.get(r[1])?.deck.startsWith(deck));
		},
		getLatestReviewID: async () => (this.revlog.length ? Math.max(...this.revlog.map((r) => r[0])) : 0),
		answerCards: async (answers: { cardId: number; ease: number }[]) => {
			for (const a of answers) {
				this.answered.push(a);
				this.review(a.cardId, a.ease);
			}
			return answers.map(() => true);
		}
	} as unknown as AnkiConnect;
}

let pds: FakePds;
let anki: FakeAnki;
let outbox: Outbox;

beforeEach(() => {
	pds = new FakePds();
	anki = new FakeAnki();
	vi.stubGlobal('fetch', pds.fetch);
	const store = new Map<string, OutboxState>();
	outbox = new Outbox(DID, {
		store: { get: async (k) => store.get(k), set: async (k, v) => void store.set(k, v) },
		write: async (b) => {
			await pds.agent.com.atproto.repo.applyWrites({
				repo: DID,
				writes: [
					{
						$type: 'com.atproto.repo.applyWrites#create',
						collection: NSID.reviewLog,
						rkey: b.rkey,
						value: { deck: b.deck, source: 'ankiat', entries: b.entries, createdAt: '' }
					}
				]
			});
		},
		exists: async (rkey) => pds.records.has(`${NSID.reviewLog}/${rkey}`)
	});
});
afterEach(() => vi.unstubAllGlobals());

const reviewLogs = () => pds.list<ReviewLogRecord>(NSID.reviewLog).map((r) => r.value);

describe('Anki 連携', () => {
	it('インポート: サブデッキを除いたカードと過去の履歴を取り込み、基準点を記録する', async () => {
		anki.addCard(11, '英語', 'apple');
		anki.addCard(12, '英語', 'book');
		anki.addCard(21, '英語::TOEIC', 'invoice');
		anki.review(11, 3);
		anki.review(21, 3);
		anki.revlog.push([++anki.clock, 12, -1, 0, 0, 0, 0, 0, 4]); // 手動の期日変更 → 除外

		const deck = await importDeck(pds.agent, DID, anki.client, '英語', 1);

		const record = pds.records.get(`${NSID.deck}/${deck.rkey}`) as DeckRecord;
		expect(record).toMatchObject({ name: '英語', cardCount: 2, source: { type: 'anki', ankiDeckId: 1 } });
		expect(deck.chunks.flat().map((c) => c.id)).toEqual(['a11', 'a12']);
		expect(reviewLogs()).toEqual([
			expect.objectContaining({ source: 'anki', entries: [expect.objectContaining({ cardId: 'a11', rating: 3 })] })
		]);
		const sync = pds.records.get(`${NSID.ankiSync}/${deck.rkey}`) as AnkiSyncRecord;
		expect(sync.lastImportedRevlogId).toBe(anki.clock);
		expect(pds.list(NSID.subscription)).toHaveLength(1);
	});

	it('同期: 内容の変更・Anki での復習・AnkiAt での回答を双方向に反映し、二重に取り込まない', async () => {
		anki.addCard(11, '英語', 'apple');
		anki.addCard(12, '英語', 'book');
		await importDeck(pds.agent, DID, anki.client, '英語', 1);

		// Anki 側: ノートを編集、カードを追加・削除、復習
		anki.cards.get(11)!.q = 'apple (edited)';
		anki.noteMods.set(110, 200);
		anki.addCard(13, '英語', 'cat');
		anki.cards.delete(12);
		anki.review(13, 4);
		// AnkiAt 側: 回答（まだアウトボックス）
		const [linked] = await listLinkedDecks(DID);
		await outbox.add(linked.deck.uri, { cardId: 'a11', rating: 2, reviewedAt: new Date().toISOString() });

		const result = await syncDeck(pds.agent, DID, anki.client, linked, outbox);

		expect(result).toEqual({ upserted: 2, deleted: 1, imported: 1, pushed: 1 });
		expect(anki.answered).toEqual([{ cardId: 11, ease: 2 }]);
		const cards = (await listLinkedDecks(DID))[0];
		expect(cards.deck.record.cardCount).toBe(2);

		// もう一度同期しても、何も起きない（押し戻した回答を取り込まない・二度送らない）
		const [linked2] = await listLinkedDecks(DID);
		const again = await syncDeck(pds.agent, DID, anki.client, linked2, outbox);
		expect(again).toEqual({ upserted: 0, deleted: 0, imported: 0, pushed: 0 });
		expect(anki.answered).toHaveLength(1);
		const ankiEntries = reviewLogs().filter((l) => l.source === 'anki').flatMap((l) => l.entries);
		expect(ankiEntries.map((e) => e.cardId)).toEqual(['a13']);
	});

	it('Anki 側でデッキ名が変わったら追従し、デッキが消えていたら同期を中止する', async () => {
		anki.addCard(11, '英語', 'apple');
		await importDeck(pds.agent, DID, anki.client, '英語', 1);
		anki.decks = { English: 1 };
		anki.cards.get(11)!.deck = 'English';
		let [linked] = await listLinkedDecks(DID);
		await syncDeck(pds.agent, DID, anki.client, linked, outbox);
		[linked] = await listLinkedDecks(DID);
		expect(linked.deck.record.source?.ankiDeckName).toBe('English');

		anki.decks = {};
		await expect(syncDeck(pds.agent, DID, anki.client, linked, outbox)).rejects.toBeInstanceOf(
			AnkiDeckMissingError
		);
	});

	it('連携解除: 残す場合はネイティブデッキになり、削除する場合は消える', async () => {
		anki.addCard(11, '英語', 'apple');
		const d1 = await importDeck(pds.agent, DID, anki.client, '英語', 1);
		await unlinkDeck(pds.agent, DID, d1, true);
		expect((pds.records.get(`${NSID.deck}/${d1.rkey}`) as DeckRecord).source).toBeUndefined();
		expect(pds.list(NSID.ankiSync)).toEqual([]);

		const d2 = await importDeck(pds.agent, DID, anki.client, '英語', 1);
		await unlinkDeck(pds.agent, DID, d2, false);
		expect(pds.records.has(`${NSID.deck}/${d2.rkey}`)).toBe(false);
		expect(pds.list(NSID.cardChunk).filter((c) => c.rkey.startsWith(d2.rkey))).toEqual([]);
	});
});
