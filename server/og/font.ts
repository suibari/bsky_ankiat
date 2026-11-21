/**
 * OGP 画像用のフォント。Google Fonts の text= 指定で、使う文字だけのサブセットを取得する
 * （日本語フォント全体は大きすぎて Functions に同梱できないため）。
 * User-Agent を付けずに取得すると、satori が読める TrueType が返る。
 */
type Fetch = typeof fetch;

export async function loadSubsetFont(
	family: string,
	weight: number,
	text: string,
	f: Fetch = fetch
): Promise<ArrayBuffer> {
	const chars = [...new Set(Array.from(text))].join('');
	const css = await f(
		`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(chars)}`
	).then((r) => {
		if (!r.ok) throw new Error(`font css: HTTP ${r.status}`);
		return r.text();
	});
	const url = /src:\s*url\(([^)]+)\)\s*format\(['"](?:truetype|opentype)['"]\)/.exec(css)?.[1];
	if (!url) throw new Error('font url not found');
	const res = await f(url);
	if (!res.ok) throw new Error(`font: HTTP ${res.status}`);
	return res.arrayBuffer();
}
