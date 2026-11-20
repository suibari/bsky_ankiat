import { messages, type Locale, type MessageKey } from './messages';

const STORAGE_KEY = 'ankiat.locale';
export const LOCALES: Locale[] = ['ja', 'en'];
export type LocalePreference = 'system' | Locale;

function systemLocale(): Locale {
	return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

function loadPreference(): LocalePreference {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === 'ja' || saved === 'en') return saved;
	} catch {
		// localStorage が使えない環境ではシステム設定に従う
	}
	return 'system';
}

const initial = loadPreference();
export const i18n = $state<{ preference: LocalePreference; locale: Locale }>({
	preference: initial,
	locale: initial === 'system' ? systemLocale() : initial
});

function apply() {
	i18n.locale = i18n.preference === 'system' ? systemLocale() : i18n.preference;
	document.documentElement.lang = i18n.locale;
}

if (typeof window !== 'undefined') {
	// 「システム設定に従う」のとき、ブラウザの言語が変わったら追従する
	window.addEventListener('languagechange', () => {
		if (i18n.preference === 'system') apply();
	});
}

export function setLocalePreference(preference: LocalePreference) {
	i18n.preference = preference;
	apply();
	try {
		if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, preference);
	} catch {
		// 保存できなくても表示は切り替える
	}
}

export function t(key: MessageKey, params: Record<string, string> = {}): string {
	const text: string = messages[i18n.locale][key] ?? messages.ja[key];
	return text.replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? `{${name}}`);
}
