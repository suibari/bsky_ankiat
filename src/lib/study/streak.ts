/** 連続学習日数（午前 4 時区切り。Anki 本体での復習も含める） */
import { dayStart } from './queue';

export interface Streak {
	/** 連続日数。今日まだ学習していなくても、昨日学習していれば昨日までの日数 */
	current: number;
	/** 今日学習したか */
	activeToday: boolean;
	/** 今日の回答数 */
	reviewedToday: number;
	/** 直近 7 日（古い順）に学習したか */
	lastWeek: boolean[];
}

function dayKey(d: Date): string {
	const s = dayStart(d);
	return `${s.getFullYear()}-${s.getMonth() + 1}-${s.getDate()}`;
}

function shiftDays(d: Date, days: number): Date {
	const x = new Date(d);
	x.setDate(x.getDate() + days);
	return x;
}

export function computeStreak(reviewedAt: string[], now: Date = new Date()): Streak {
	const days = new Set<string>();
	const todayKey = dayKey(now);
	let reviewedToday = 0;
	for (const at of reviewedAt) {
		const key = dayKey(new Date(at));
		days.add(key);
		if (key === todayKey) reviewedToday++;
	}
	const today = dayStart(now);
	const activeToday = days.has(todayKey);
	let current = 0;
	let cursor = activeToday ? today : shiftDays(today, -1);
	while (days.has(dayKey(cursor))) {
		current++;
		cursor = shiftDays(cursor, -1);
	}
	const lastWeek = Array.from({ length: 7 }, (_, i) => days.has(dayKey(shiftDays(today, i - 6))));
	return { current, activeToday, reviewedToday, lastWeek };
}
