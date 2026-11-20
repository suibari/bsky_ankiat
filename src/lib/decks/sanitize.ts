/** カード HTML の表示用サニタイズ（docs/SPEC.md 3.5） */
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
	'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'br', 'hr', 'p', 'div', 'span',
	'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'ruby', 'rt', 'rp',
	'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'font', 'small', 'big'
];

/**
 * - script・イベント属性・外部リソース（img/audio 等）・style を除去する
 * - img は「[画像]」、audio / [sound:...] は「[音声]」に置き換える
 */
export function sanitizeCardHtml(html: string, labels: { image: string; audio: string }): string {
	const replaced = html
		.replace(/<img\b[^>]*>/gi, `<span class="media-placeholder">${labels.image}</span>`)
		.replace(/<audio\b[\s\S]*?<\/audio>/gi, `<span class="media-placeholder">${labels.audio}</span>`)
		.replace(/\[sound:[^\]]*\]/g, `<span class="media-placeholder">${labels.audio}</span>`);
	return DOMPurify.sanitize(replaced, {
		ALLOWED_TAGS,
		ALLOWED_ATTR: ['class', 'colspan', 'rowspan'],
		ALLOW_DATA_ATTR: false,
		FORBID_TAGS: ['style'],
		KEEP_CONTENT: true
	});
}

/** Anki の解答 HTML から、問題部分（<hr id=answer> より前）を取り除く */
export function stripAnswerPrefix(html: string): string {
	const m = /<hr[^>]*id=["']?answer["']?[^>]*>/i.exec(html);
	return m ? html.slice(m.index + m[0].length) : html;
}
