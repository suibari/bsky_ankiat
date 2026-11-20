import { describe, expect, it } from 'vitest';
import type { Card } from '../atproto/records';
import { isAnkiSupportedBrowser } from './client';
import { diffContent, directDeckQuery, parseAnkiCardId, revlogToEntry, toCard } from './convert';

describe('toCard', () => {
	it('ID を a{cardId} にし、<style> を除去する', () => {
		const card = toCard(
			{ cardId: 12, note: 34, deckName: 'd', question: '<style>.card{}</style>表', answer: '<style>x</style>表<hr id=answer>裏', mod: 5 },
			6
		);
		expect(card).toEqual({
			id: 'a12',
			front: '表',
			back: '表<hr id=answer>裏',
			anki: { cardId: 12, noteId: 34, mod: 5, noteMod: 6 }
		});
		expect(parseAnkiCardId(card.id)).toBe(12);
		expect(parseAnkiCardId('3abc')).toBeUndefined();
	});
});

describe('directDeckQuery', () => {
	it('サブデッキを除外し、特殊文字をエスケープする', () => {
		expect(directDeckQuery('英語::TOEIC')).toBe('"deck:英語::TOEIC" -"deck:英語::TOEIC::*"');
		expect(directDeckQuery('a_b*"c')).toBe('"deck:a\\_b\\*\\"c" -"deck:a\\_b\\*\\"c::*"');
	});
});

describe('revlogToEntry', () => {
	it('通常の復習を変換する', () => {
		expect(revlogToEntry([1700000000000, 12, -1, 3, 4, 1, 2500, 6000, 1])).toEqual({
			cardId: 'a12',
			rating: 3,
			reviewedAt: new Date(1700000000000).toISOString(),
			durationMs: 6000,
			ankiRevlogId: 1700000000000
		});
	});

	it('手動の期日変更（ease 0）と Manual / Rescheduled（type 4 以上）は除外する', () => {
		expect(revlogToEntry([1, 12, -1, 0, 0, 0, 0, 0, 1])).toBeUndefined();
		expect(revlogToEntry([1, 12, -1, 3, 0, 0, 0, 0, 4])).toBeUndefined();
		expect(revlogToEntry([1, 12, -1, 3, 0, 0, 0, 0, 5])).toBeUndefined();
	});
});

describe('diffContent', () => {
	const stored: Card[] = [
		{ id: 'a1', front: '', back: '', anki: { cardId: 1, noteId: 9, mod: 10, noteMod: 10 } },
		{ id: 'a2', front: '', back: '', anki: { cardId: 2, noteId: 9, mod: 10, noteMod: 10 } },
		{ id: 'a3', front: '', back: '', anki: { cardId: 3, noteId: 9, mod: 10, noteMod: 10 } }
	];

	it('追加・カードの変更・ノートの変更を取り直し対象に、なくなったカードを削除対象にする', () => {
		const current = new Map([
			[1, { mod: 10, noteMod: 10 }],
			[2, { mod: 10, noteMod: 11 }],
			[4, { mod: 1, noteMod: 1 }]
		]);
		expect(diffContent(current, stored)).toEqual({ upserts: ['a2', 'a4'], deletes: ['a3'] });
	});
});

describe('isAnkiSupportedBrowser', () => {
	it('PC の Chrome / Firefox / Edge は対応、Safari とスマホは非対応', () => {
		const chrome = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
		const firefox = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';
		const safari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
		const android = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
		expect(isAnkiSupportedBrowser(chrome)).toBe(true);
		expect(isAnkiSupportedBrowser(firefox)).toBe(true);
		expect(isAnkiSupportedBrowser(safari)).toBe(false);
		expect(isAnkiSupportedBrowser(android)).toBe(false);
	});
});
