// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizeCardHtml, stripAnswerPrefix } from './sanitize';

const labels = { image: '[画像]', audio: '[音声]' };

describe('sanitizeCardHtml', () => {
	it('script・イベント属性・リンクを除去する', () => {
		const out = sanitizeCardHtml(
			'<b onclick="x()">太字</b><script>alert(1)</script><a href="javascript:x">リンク</a>',
			labels
		);
		expect(out).toBe('<b>太字</b>リンク');
	});

	it('style 要素は中身ごと除去し、style 属性も残さない', () => {
		const out = sanitizeCardHtml('<style>.card{color:red}</style><div style="color:red">本文</div>', labels);
		expect(out).toBe('<div>本文</div>');
	});

	it('画像と音声をプレースホルダーに置き換える', () => {
		const out = sanitizeCardHtml('<img src="a.png" onerror="x()">[sound:a.mp3]', labels);
		expect(out).toBe(
			'<span class="media-placeholder">[画像]</span><span class="media-placeholder">[音声]</span>'
		);
	});

	it('iframe や外部リソースを読み込む要素を除去する', () => {
		const out = sanitizeCardHtml('<iframe src="https://evil"></iframe><video src="v.mp4"></video>本文', labels);
		expect(out).toBe('本文');
	});
});

describe('stripAnswerPrefix', () => {
	it('<hr id=answer> より後ろだけを返す', () => {
		expect(stripAnswerPrefix('表<hr id=answer>裏')).toBe('裏');
		expect(stripAnswerPrefix('表<hr id="answer">裏')).toBe('裏');
	});

	it('区切りがなければそのまま返す', () => {
		expect(stripAnswerPrefix('裏だけ')).toBe('裏だけ');
	});
});
