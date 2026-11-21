import { describe, expect, it } from 'vitest';
import { blueskyComposeUrl, buildDeckShareText, buildShareText } from './text';

const url = 'https://ankiat.suibari.com/profile/suibari.com';

describe('buildShareText', () => {
	it('連続 2 日以上なら連続日数を入れる', () => {
		expect(buildShareText({ reviewedToday: 42, streak: 3, profileUrl: url }, 'ja')).toBe(
			`今日は 42 枚のカードを学習しました。3 日連続です。\n\n#AnkiAt ${url}`
		);
		expect(buildShareText({ reviewedToday: 42, streak: 3, profileUrl: url }, 'en')).toBe(
			`I studied 42 cards today. 3-day streak.\n\n#AnkiAt ${url}`
		);
	});

	it('1 日目なら連続日数は入れない', () => {
		expect(buildShareText({ reviewedToday: 5, streak: 1, profileUrl: url }, 'ja')).toBe(
			`今日は 5 枚のカードを学習しました。\n\n#AnkiAt ${url}`
		);
	});
});

describe('blueskyComposeUrl', () => {
	it('文章を URL エンコードする', () => {
		expect(blueskyComposeUrl('a b\n#c')).toBe('https://bsky.app/intent/compose?text=a%20b%0A%23c');
	});
});

describe('buildDeckShareText', () => {
	it('自分のデッキと他人のデッキで文章を変え、URL を含める', () => {
		const url = 'https://ankiat.example/deck/did:plc:a/1';
		expect(buildDeckShareText({ name: '英単語', url, own: true }, 'ja')).toContain('「英単語」を公開しました');
		expect(buildDeckShareText({ name: '英単語', url, own: false }, 'ja')).toContain('「英単語」で学習しています');
		expect(buildDeckShareText({ name: 'Verbs', url, own: false }, 'en')).toContain(url);
	});
});
