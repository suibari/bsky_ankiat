/** デッキの OGP（docs/SPEC.md 3.8）: 表示用テキストとメタ情報の組み立て */

export interface DeckSummary {
	did: string;
	rkey: string;
	name: string;
	description?: string;
	cardCount: number;
	handle?: string;
	/** 最初のカードの表面（プレーンテキスト） */
	firstFront?: string;
	updatedAt: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

/** カードの HTML を 1 行のプレーンテキストにする */
export function htmlToPlain(html: string): string {
	return html
		.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, (m, e: string) => {
			if (e[0] === '#') {
				const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
				return Number.isFinite(code) ? String.fromCodePoint(code) : m;
			}
			return ENTITIES[e.toLowerCase()] ?? m;
		})
		.replace(/\s+/g, ' ')
		.trim();
}

/** 文字数（コードポイント単位）で切り詰め、切ったら … を付ける */
export function truncate(text: string, max: number): string {
	const chars = Array.from(text);
	return chars.length <= max ? text : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

/** 画像用のフォントに含まれない絵文字を除く */
export function stripEmoji(text: string): string {
	return text
		.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function isJapanese(text: string): boolean {
	return /[぀-ヿ㐀-鿿]/.test(text);
}

export interface DeckMeta {
	title: string;
	description: string;
	url: string;
	image: string;
}

export function buildMeta(deck: DeckSummary, origin: string): DeckMeta {
	const ja = isJapanese(`${deck.name} ${deck.description ?? ''}`);
	const who = deck.handle ? `@${deck.handle}` : undefined;
	const fallback = ja
		? `${who ? `${who} さんの` : ''}暗記カードのデッキ（${deck.cardCount} 枚）。ログインしなくても AnkiAt ですぐに学習できます。`
		: `A flashcard deck${who ? ` by ${who}` : ''} (${deck.cardCount} cards). Study it on AnkiAt right away, no sign-in needed.`;
	const path = `/deck/${deck.did}/${deck.rkey}`;
	return {
		title: `${truncate(deck.name, 80)} | AnkiAt`,
		description: deck.description ? truncate(deck.description.replace(/\s+/g, ' ').trim(), 160) : fallback,
		url: `${origin}${path}`,
		image: `${origin}/og${path}.png?v=${encodeURIComponent(deck.updatedAt)}`
	};
}
