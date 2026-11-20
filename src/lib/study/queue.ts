/** 出題キューの組み立て（docs/SPEC.md 3.4） */
import type { Card, ReviewEntry } from '../atproto/records';
import { State, type CardState } from './scheduler';

/** 学習ステップ中のカードを先取りして出題してよい範囲（Anki の learn ahead limit と同じ 20 分） */
export const LEARN_AHEAD_MS = 20 * 60 * 1000;
/** 1 日の区切り（Anki と同じく午前 4 時） */
export const DAY_ROLLOVER_HOUR = 4;

export function dayStart(now: Date): Date {
	const d = new Date(now);
	d.setHours(DAY_ROLLOVER_HOUR, 0, 0, 0);
	if (d > now) d.setDate(d.getDate() - 1);
	return d;
}

export function isLearning(state: CardState): boolean {
	return state.state === State.Learning || state.state === State.Relearning;
}

export interface DeckQueue {
	/** 期日が来た復習カード（学習ステップ中のものを含む）。期日順 */
	due: Card[];
	/** 今日出題する新規カード（デッキ内の順） */
	newCards: Card[];
}

/**
 * @param entries このデッキの回答履歴（今日導入した新規カードの数を数えるため）
 * @param newLimit 1 日の新規カード上限（デッキごと）
 */
export function buildQueue(
	cards: Card[],
	states: Map<string, CardState>,
	entries: ReviewEntry[],
	now: Date,
	newLimit: number
): DeckQueue {
	const start = dayStart(now).toISOString();
	const firstReview = new Map<string, string>();
	for (const e of entries) {
		const prev = firstReview.get(e.cardId);
		if (!prev || e.reviewedAt < prev) firstReview.set(e.cardId, e.reviewedAt);
	}
	const cardIds = new Set(cards.map((c) => c.id));
	let introducedToday = 0;
	for (const [id, at] of firstReview) if (cardIds.has(id) && at >= start) introducedToday++;

	const due: { card: Card; at: number }[] = [];
	const newCards: Card[] = [];
	const remainingNew = Math.max(0, newLimit - introducedToday);
	for (const card of cards) {
		const state = states.get(card.id);
		if (!state) {
			if (newCards.length < remainingNew) newCards.push(card);
			continue;
		}
		const at = state.dueAt.getTime();
		const limit = now.getTime() + (isLearning(state) ? LEARN_AHEAD_MS : 0);
		if (at <= limit) due.push({ card, at });
	}
	due.sort((a, b) => a.at - b.at);
	return { due: due.map((d) => d.card), newCards };
}
