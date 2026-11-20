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
