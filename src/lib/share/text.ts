/** 共有する文章（Bluesky などに投稿されることを想定） */
import type { Locale } from '../i18n/messages';

export interface ShareSummary {
	reviewedToday: number;
	streak: number;
	profileUrl: string;
}

export function buildShareText(s: ShareSummary, locale: Locale): string {
	if (locale === 'ja') {
		const streak = s.streak >= 2 ? `${s.streak} 日連続です。` : '';
		return `今日は ${s.reviewedToday} 枚のカードを学習しました。${streak}\n\n#AnkiAt ${s.profileUrl}`;
	}
	const streak = s.streak >= 2 ? ` ${s.streak}-day streak.` : '';
	return `I studied ${s.reviewedToday} cards today.${streak}\n\n#AnkiAt ${s.profileUrl}`;
}

/** Bluesky の投稿画面を文章入りで開く URL（画像は付けられない） */
export function blueskyComposeUrl(text: string): string {
	return `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
}

/** デッキを共有する文章（docs/SPEC.md 3.8）。自分のデッキかどうかで言い方を変える */
export function buildDeckShareText(
	d: { name: string; url: string; own: boolean },
	locale: Locale
): string {
	if (locale === 'ja') {
		return d.own
			? `暗記カードのデッキ「${d.name}」を公開しました。ログインしなくても解けます。\n\n#AnkiAt ${d.url}`
			: `暗記カードのデッキ「${d.name}」で学習しています。\n\n#AnkiAt ${d.url}`;
	}
	return d.own
		? `I published a flashcard deck, “${d.name}”. You can study it without signing in.\n\n#AnkiAt ${d.url}`
		: `I'm studying the flashcard deck “${d.name}”.\n\n#AnkiAt ${d.url}`;
}
