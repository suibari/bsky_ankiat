/** ライト / ダークテーマ。既定はシステム設定に従う */
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'ankiat.theme';

function load(): ThemePreference {
	try {
		const v = localStorage.getItem(STORAGE_KEY);
		if (v === 'light' || v === 'dark') return v;
	} catch {
		// 保存できない環境ではシステム設定に従う
	}
	return 'system';
}

export const theme = $state<{ preference: ThemePreference }>({ preference: load() });

export function setTheme(preference: ThemePreference) {
	theme.preference = preference;
	const root = document.documentElement;
	if (preference === 'system') delete root.dataset.theme;
	else root.dataset.theme = preference;
	try {
		if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, preference);
	} catch {
		// 保存できなくても表示は切り替える
	}
}
