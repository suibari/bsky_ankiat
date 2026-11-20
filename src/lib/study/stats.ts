/** プロフィール用のスタッツ（PDS の公開された回答履歴から計算） */
import type { ReviewEntry } from '../atproto/records';
import { dayStart } from './queue';
import { computeStreak } from './streak';

export const DAILY_DAYS = 30;

export interface ProfileStats {
	totalReviews: number;
	studyDays: number;
	currentStreak: number;
	longestStreak: number;
	/** 一度でも回答したカードの数（デッキをまたいで数える） */
	uniqueCards: number;
	/** 「もう一度」以外で答えた割合（0〜1）。回答がなければ null */
	retention: number | null;
	/** 直近 30 日（古い順）の回答数 */
	daily: { date: Date; count: number }[];
	/** 回答の多いデッキ順 */
	decks: { uri: string; reviews: number }[];
}

const keyOf = (d: Date) => {
	const s = dayStart(d);
	return `${s.getFullYear()}-${s.getMonth() + 1}-${s.getDate()}`;
};

export function computeProfileStats(
	entriesByDeck: Map<string, ReviewEntry[]>,
	now: Date = new Date()
): ProfileStats {
	const all: ReviewEntry[] = [];
	const cards = new Set<string>();
	const decks: { uri: string; reviews: number }[] = [];
	for (const [uri, entries] of entriesByDeck) {
		// 同じ Anki の復習ログが重複していても 1 回と数える
		const seen = new Set<string>();
		let n = 0;
		for (const e of entries) {
			const k = e.ankiRevlogId !== undefined ? `a${e.ankiRevlogId}` : `${e.cardId}@${e.reviewedAt}`;
			if (seen.has(k)) continue;
			seen.add(k);
			all.push(e);
			cards.add(`${uri}#${e.cardId}`);
			n++;
		}
		if (n > 0) decks.push({ uri, reviews: n });
	}
	decks.sort((a, b) => b.reviews - a.reviews);

	const counts = new Map<string, number>();
	for (const e of all) {
		const k = keyOf(new Date(e.reviewedAt));
		counts.set(k, (counts.get(k) ?? 0) + 1);
	}

	// 最長連続: 学習した日を古い順に並べ、前日と続いているかを見る
	const days = [...new Set(all.map((e) => dayStart(new Date(e.reviewedAt)).getTime()))].sort((a, b) => a - b);
	let longest = 0;
	let run = 0;
	let prev: Date | undefined;
	for (const t of days) {
		const d = new Date(t);
		if (prev) {
			const expected = new Date(prev);
			expected.setDate(expected.getDate() + 1);
			run = keyOf(expected) === keyOf(d) ? run + 1 : 1;
		} else {
			run = 1;
		}
		longest = Math.max(longest, run);
		prev = d;
	}

	const today = dayStart(now);
	const daily = Array.from({ length: DAILY_DAYS }, (_, i) => {
		const date = new Date(today);
		date.setDate(date.getDate() - (DAILY_DAYS - 1 - i));
		return { date, count: counts.get(keyOf(date)) ?? 0 };
	});

	const correct = all.filter((e) => e.rating >= 2).length;
	return {
		totalReviews: all.length,
		studyDays: days.length,
		currentStreak: computeStreak(
			all.map((e) => e.reviewedAt),
			now
		).current,
		longestStreak: longest,
		uniqueCards: cards.size,
		retention: all.length > 0 ? correct / all.length : null,
		daily,
		decks
	};
}
