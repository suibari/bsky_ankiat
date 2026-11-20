import type { Locale } from './messages';

const UNITS: [unit: Intl.NumberFormatOptions['unit'], ms: number][] = [
	['year', 365 * 86_400_000],
	['month', 30 * 86_400_000],
	['day', 86_400_000],
	['hour', 3_600_000],
	['minute', 60_000]
];

/** 「10 分」「4 日」「2 か月」のような短い間隔表示 */
export function formatInterval(ms: number, locale: Locale): string {
	for (const [unit, size] of UNITS) {
		if (ms >= size || unit === 'minute') {
			const value = Math.max(1, Math.round(ms / size));
			return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short' }).format(value);
		}
	}
	return '';
}

export function formatDate(iso: string, locale: Locale): string {
	return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
