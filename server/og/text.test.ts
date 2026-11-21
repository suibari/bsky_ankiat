import { describe, expect, it } from 'vitest';
import { buildMeta, htmlToPlain, isJapanese, stripEmoji, truncate, type DeckSummary } from './text';

const deck = (over: Partial<DeckSummary> = {}): DeckSummary => ({
	did: 'did:plc:abcdefghijklmnopqrstuvwx',
	rkey: '3k2abc',
	name: '中学英単語',
	cardCount: 120,
	handle: 'alice.bsky.social',
	updatedAt: '2026-11-21T00:00:00.000Z',
	...over
});

describe('htmlToPlain', () => {
	it('タグを除き、実体参照を戻して空白をまとめる', () => {
		expect(htmlToPlain('<b>A&amp;B</b><br>次の&lt;行&gt; &#x41;&#66;')).toBe('A&B 次の<行> AB');
		expect(htmlToPlain('<style>.x{}</style>本文')).toBe('本文');
	});
});

describe('truncate / stripEmoji / isJapanese', () => {
	it('コードポイント単位で切り詰める', () => {
		expect(truncate('あいうえお', 5)).toBe('あいうえお');
		expect(truncate('あいうえおか', 5)).toBe('あいうえ…');
	});

	it('絵文字を除く', () => {
		expect(stripEmoji('英単語 📚 まとめ👍🏻')).toBe('英単語 まとめ');
	});

	it('日本語を含むか判定する', () => {
		expect(isJapanese('TOEIC 単語')).toBe(true);
		expect(isJapanese('Spanish verbs')).toBe(false);
	});
});

describe('buildMeta', () => {
	it('タイトル・URL・バージョンつきの画像 URL を作る', () => {
		const m = buildMeta(deck({ description: '説明\n2 行目' }), 'https://ankiat.example');
		expect(m.title).toBe('中学英単語 | AnkiAt');
		expect(m.description).toBe('説明 2 行目');
		expect(m.url).toBe('https://ankiat.example/deck/did:plc:abcdefghijklmnopqrstuvwx/3k2abc');
		expect(m.image).toBe(
			'https://ankiat.example/og/deck/did:plc:abcdefghijklmnopqrstuvwx/3k2abc.png?v=2026-11-21T00%3A00%3A00.000Z'
		);
	});

	it('説明がなければ、デッキの言語に合わせた既定の文にする', () => {
		expect(buildMeta(deck(), 'https://x').description).toContain('@alice.bsky.social さんの暗記カードのデッキ（120 枚）');
		expect(buildMeta(deck({ name: 'Spanish verbs' }), 'https://x').description).toContain('by @alice.bsky.social (120 cards)');
	});
});
