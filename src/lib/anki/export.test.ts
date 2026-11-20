// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Card } from '../atproto/records';
import type { AnkiConnect, AnkiNewNote } from './client';
import { exportDeckName, exportDeckToAnki, toAnkiNote } from './export';

const labels = { image: '[画像]', audio: '[音声]' };

/** 重複判定（同じデッキで表面が同じ）と、1 件でも失敗すると全体が失敗する addNotes を再現する */
function fakeAnki() {
	const notes: AnkiNewNote[] = [];
	const decks = new Set<string>();
	const models: string[] = ['Basic'];
	const isDup = (n: AnkiNewNote) => notes.some((x) => x.deckName === n.deckName && x.fields.Front === n.fields.Front);
	const client = {
		modelNames: async () => [...models],
		createModel: async (p: { modelName: string }) => void models.push(p.modelName),
		createDeck: async (d: string) => void decks.add(d),
		canAddNotesWithErrorDetail: async (ns: AnkiNewNote[]) =>
			ns.map((n) => (isDup(n) ? { canAdd: false, error: 'duplicate' } : { canAdd: true })),
		addNotes: async (ns: AnkiNewNote[]) => {
			if (ns.some(isDup)) throw new Error('batch rejected');
			notes.push(...ns);
			return ns.map((_, i) => i + 1);
		}
	} as unknown as AnkiConnect;
	return { client, notes, decks, models };
}

const card = (id: string, front: string, back = 'b'): Card => ({ id, front, back });

describe('exportDeckName', () => {
	it('AnkiAt の下に置き、名前の中の「::」は全角にする', () => {
		expect(exportDeckName('英単語')).toBe('AnkiAt::英単語');
		expect(exportDeckName('a::b')).toBe('AnkiAt::a：b');
	});
});

describe('toAnkiNote', () => {
	it('サニタイズし、Anki 由来なら解答の問題部分を除き、AnkiAt タグを付ける', () => {
		const n = toAnkiNote(card('1', '<b onclick="x()">表</b><script>a()</script>', '表<hr id=answer>裏'), 'AnkiAt::d', true, labels);
		expect(n.fields).toEqual({ Front: '<b>表</b>', Back: '裏' });
		expect(n.tags).toEqual(['AnkiAt']);
		expect(n.modelName).toBe('AnkiAt');
	});
});

describe('exportDeckToAnki', () => {
	it('ノートタイプとデッキを作って追加し、2 回目は追加分だけ足す', async () => {
		const anki = fakeAnki();
		const deck = { name: '英単語', fromAnki: false, cards: [card('1', 'apple'), card('2', 'book'), card('3', 'apple')] };

		const first = await exportDeckToAnki(anki.client, deck, labels);
		expect(first).toEqual({ deckName: 'AnkiAt::英単語', added: 2, skipped: 1 });
		expect(anki.models).toContain('AnkiAt');
		expect(anki.decks.has('AnkiAt::英単語')).toBe(true);

		deck.cards.push(card('4', 'cat'));
		const second = await exportDeckToAnki(anki.client, deck, labels);
		expect(second).toEqual({ deckName: 'AnkiAt::英単語', added: 1, skipped: 3 });
		expect(anki.notes.map((n) => n.fields.Front)).toEqual(['apple', 'book', 'cat']);
		expect(anki.models.filter((m) => m === 'AnkiAt')).toHaveLength(1);
	});
});
