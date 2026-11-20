import { messages, type Locale, type MessageKey } from './messages';

const STORAGE_KEY = 'ankiat.locale';
export const LOCALES: Locale[] = ['ja', 'en'];

function detect(): Locale {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === 'ja' || saved === 'en') return saved;
	} catch {
		// localStorage が使えない環境ではブラウザ設定に従う
	}
	return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export const i18n = $state<{ locale: Locale }>({ locale: detect() });

export function setLocale(locale: Locale) {
	i18n.locale = locale;
	document.documentElement.lang = locale;
	try {
		localStorage.setItem(STORAGE_KEY, locale);
	} catch {
		// 保存できなくても表示は切り替える
	}
}

export function t(key: MessageKey, params: Record<string, string> = {}): string {
	const text: string = messages[i18n.locale][key] ?? messages.ja[key];
	return text.replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? `{${name}}`);
}
