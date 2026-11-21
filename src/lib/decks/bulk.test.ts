import { describe, expect, it } from 'vitest';
import { decodeText, delimiterForFile, MAX_BULK_CARDS, parseBulk, splitRows } from './bulk';

describe('parseBulk', () => {
	it('1 行に 1 枚、タブで表と裏を分ける', () => {
		const r = parseBulk('apple\tりんご\r\nbanana\tバナナ\n');
		expect(r.cards).toEqual([
			{ front: 'apple', back: 'りんご' },
			{ front: 'banana', back: 'バナナ' }
		]);
		expect(r.errors).toEqual([]);
	});

	it('空行は無視し、区切りのない行と空の面はエラーとして行番号を返す', () => {
		const r = parseBulk('a\tb\n\nonly front\n\tback\nc\td');
		expect(r.cards.map((c) => c.front)).toEqual(['a', 'c']);
		expect(r.errors).toEqual([
			{ line: 3, reason: 'noDelimiter' },
			{ line: 4, reason: 'empty' }
		]);
	});

	it('スプレッドシートからコピーした、改行を含むセルを 1 枚として読む', () => {
		const r = parseBulk('"line1\nline2"\tback\nnext\t"say ""hi"""');
		expect(r.cards).toEqual([
			{ front: 'line1\nline2', back: 'back' },
			{ front: 'next', back: 'say "hi"' }
		]);
	});

	it('引用符で始まるだけの普通のテキストは、そのまま読む', () => {
		const r = parseBulk('"Hello" means?\tこんにちは');
		expect(r.cards).toEqual([{ front: '"Hello" means?', back: 'こんにちは' }]);
	});

	it('Anki の書き出しの設定行を飛ばし、3 列目以降は使わない', () => {
		const r = parseBulk('#separator:tab\n#html:false\nfront\tback\ttag1 tag2');
		expect(r.cards).toEqual([{ front: 'front', back: 'back' }]);
		expect(r.errors).toEqual([]);
	});

	it('CSV はカンマで区切る', () => {
		const r = parseBulk('a,b\n"x, y",z', ',');
		expect(r.cards).toEqual([
			{ front: 'a', back: 'b' },
			{ front: 'x, y', back: 'z' }
		]);
	});

	it('上限を超えた分は読み捨てて枚数を返す', () => {
		const text = Array.from({ length: MAX_BULK_CARDS + 3 }, (_, i) => `q${i}\ta${i}`).join('\n');
		const r = parseBulk(text);
		expect(r.cards).toHaveLength(MAX_BULK_CARDS);
		expect(r.overflow).toBe(3);
	});

	it('改行を含むセルのあとの行番号がずれない', () => {
		const r = parseBulk('"a\nb"\tc\nbad');
		expect(r.errors).toEqual([{ line: 3, reason: 'noDelimiter' }]);
	});
});

describe('splitRows', () => {
	it('末尾の区切りは空のフィールドになる', () => {
		expect(splitRows('a\t', '\t')[0].fields).toEqual(['a', '']);
	});
});

describe('decodeText / delimiterForFile', () => {
	it('UTF-8（BOM つき）と Shift_JIS を読める', () => {
		const utf8 = new TextEncoder().encode('﻿りんご\tapple');
		expect(decodeText(utf8.buffer as ArrayBuffer)).toBe('りんご\tapple');
		// 「あ」の Shift_JIS は 0x82 0xA0
		expect(decodeText(new Uint8Array([0x82, 0xa0]).buffer)).toBe('あ');
	});

	it('.csv だけカンマ区切り', () => {
		expect(delimiterForFile('deck.CSV')).toBe(',');
		expect(delimiterForFile('deck.txt')).toBe('\t');
		expect(delimiterForFile('deck.tsv')).toBe('\t');
	});
});
