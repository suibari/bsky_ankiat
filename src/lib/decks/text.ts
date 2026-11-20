/** ネイティブデッキのプレーンテキスト入力と HTML の相互変換（docs/SPEC.md 3.2） */

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};
const UNESCAPES: Record<string, string> = Object.fromEntries(
	Object.entries(ESCAPES).map(([k, v]) => [v, k])
);

export function textToHtml(text: string): string {
	return text
		.replace(/\r\n?/g, '\n')
		.replace(/[&<>"']/g, (c) => ESCAPES[c])
		.replace(/\n/g, '<br>');
}

/** textToHtml で作った HTML を元のテキストに戻す */
export function htmlToText(html: string): string {
	return html.replace(/<br\s*\/?>/gi, '\n').replace(/&(amp|lt|gt|quot|#39);/g, (e) => UNESCAPES[e]);
}
