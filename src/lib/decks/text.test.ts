import { describe, expect, it } from 'vitest';
import { htmlToText, textToHtml } from './text';

describe('textToHtml / htmlToText', () => {
	it('HTML の特殊文字をエスケープし、改行を <br> にする', () => {
		expect(textToHtml('a < b & "c"\r\nd')).toBe('a &lt; b &amp; &quot;c&quot;<br>d');
	});

	it('元のテキストに戻せる', () => {
		const text = `<script>alert('x')</script>\n2 行目 & '引用'`;
		expect(htmlToText(textToHtml(text))).toBe(text);
	});
});
