/**
 * Anki 側の期日（docs/SPEC.md 3.6「Anki の期日」）
 * Anki 連携デッキは、同期のたびに Anki が計算した各カードの期日を ankiSync に保存し、
 * Anki に接続していなくてもその期日で出題する。
 */
import type { AnkiScheduleEntry, ReviewEntry } from '../atproto/records';
import { dayStart } from '../study/queue';
import { ankiCardId } from './convert';

export interface AnkiReview {
	id: number;
	ivl: number;
	type: number;
}

const QUEUE_NEW = 0;
const QUEUE_SUSPENDED = -1;
const QUEUE_BURIED = [-2, -3];

function addDays(base: Date, days: number): Date {
	const d = new Date(base);
	d.setDate(d.getDate() + days);
	return d;
}

/**
 * 最後の復習ログの時刻と間隔から、Anki の期日を求める。
 * ivl > 0 は日数（その日の区切り時刻に期日が来る）、ivl < 0 は秒数（学習ステップ）。
 */
export function computeAnkiSchedule(
	cards: { cardId: number; queue: number }[],
	reviews: Record<string, AnkiReview[]>,
	now: Date = new Date()
): AnkiScheduleEntry[] {
	const out: AnkiScheduleEntry[] = [];
	const tomorrow = addDays(dayStart(now), 1);
	for (const { cardId, queue } of cards) {
		const id = ankiCardId(cardId);
		if (queue === QUEUE_SUSPENDED) {
			out.push({ cardId: id, kind: 'suspended' });
			continue;
		}
		if (queue === QUEUE_NEW) {
			out.push({ cardId: id, kind: 'new' });
			continue;
		}
		const last = (reviews[String(cardId)] ?? []).reduce<AnkiReview | undefined>(
			(a, r) => (!a || r.id > a.id ? r : a),
			undefined
		);
		if (!last) continue; // 履歴がなく期日を求められない → AnkiAt の FSRS に任せる
		let kind: AnkiScheduleEntry['kind'];
		let due: Date;
		if (last.ivl > 0) {
			kind = 'review';
			due = addDays(dayStart(new Date(last.id)), last.ivl);
		} else {
			kind = 'learning';
			due = new Date(last.id + -last.ivl * 1000);
		}
		// 延期（bury）中のカードは、今日は出さない
		if (QUEUE_BURIED.includes(queue) && due < tomorrow) due = tomorrow;
		out.push({ cardId: id, kind, dueAt: due.toISOString() });
	}
	return out;
}

/**
 * 出題に使う Anki の期日。期日を保存した後に AnkiAt で回答したカードは除く
 * （次の同期までは AnkiAt の FSRS で計算した期日を使う）。
 */
export function ankiOverrides(
	schedule: AnkiScheduleEntry[] | undefined,
	scheduleUpdatedAt: string | undefined,
	entries: ReviewEntry[]
): Map<string, AnkiScheduleEntry> {
	const map = new Map<string, AnkiScheduleEntry>();
	if (!schedule || !scheduleUpdatedAt) return map;
	const answeredAfter = new Set(
		entries.filter((e) => e.reviewedAt > scheduleUpdatedAt).map((e) => e.cardId)
	);
	for (const s of schedule) if (!answeredAfter.has(s.cardId)) map.set(s.cardId, s);
	return map;
}
