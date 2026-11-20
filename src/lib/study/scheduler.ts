/**
 * FSRS（ts-fsrs）による学習状態の計算（docs/SPEC.md 3.4 / 4.3）
 * 学習状態は PDS に保存せず、回答履歴を時系列順に再生して求める。
 * 再生結果が毎回同じになるよう、fuzz（間隔のランダム化）は無効にする。
 */
import { DefaultScheduler, State } from 'ts-fsrs';
import type { Rating, ReviewEntry } from '../atproto/records';

const createScheduler = () => DefaultScheduler({ version: 'FSRS-7', enableFuzz: false });

export type Scheduler = Awaited<ReturnType<typeof createScheduler>>;
export type CardState = Parameters<Scheduler['review']>[0]['card'];
export { State };

let schedulerPromise: Promise<Scheduler> | undefined;

export function getScheduler(): Promise<Scheduler> {
	schedulerPromise ??= createScheduler();
	return schedulerPromise;
}

function newCard(scheduler: Scheduler, now: Date): CardState {
	return scheduler.newCard({ now }) as CardState;
}

/** 重複したエントリを取り除き、回答時刻順に並べる */
export function normalizeEntries(entries: ReviewEntry[]): ReviewEntry[] {
	const seen = new Set<string>();
	const out: ReviewEntry[] = [];
	for (const e of entries) {
		const key = e.ankiRevlogId !== undefined ? `anki:${e.ankiRevlogId}` : `${e.cardId}@${e.reviewedAt}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(e);
	}
	return out.sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
}

/** カードごとに履歴を再生して、現在の学習状態を求める */
export function replay(scheduler: Scheduler, entries: ReviewEntry[]): Map<string, CardState> {
	const states = new Map<string, CardState>();
	for (const e of normalizeEntries(entries)) {
		const now = new Date(e.reviewedAt);
		const card = states.get(e.cardId) ?? newCard(scheduler, now);
		states.set(e.cardId, scheduler.review({ card, grade: e.rating, now }).card);
	}
	return states;
}

export function answer(
	scheduler: Scheduler,
	state: CardState | undefined,
	rating: Rating,
	now: Date
): CardState {
	const card = state ?? newCard(scheduler, now);
	return scheduler.review({ card, grade: rating, now }).card;
}

/** 4 段階それぞれを選んだ場合の次回期日 */
export function previewDue(
	scheduler: Scheduler,
	state: CardState | undefined,
	now: Date
): Record<Rating, Date> {
	const card = state ?? newCard(scheduler, now);
	const out = {} as Record<Rating, Date>;
	for (const p of scheduler.preview({ card, now })) out[p.grade as Rating] = p.card.dueAt;
	return out;
}
