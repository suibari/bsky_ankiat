/** ログイン後に戻る画面（docs/SPEC.md 3.7）。OAuth の前に保存し、コールバック後に取り出す */

const KEY = 'ankiat.returnTo';

/** 同じオリジン内のパスだけを許す。ログイン関連の画面には戻さない */
export function sanitizeReturnTo(path: string | null | undefined): string {
	if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/';
	if (path.startsWith('/oauth/')) return '/';
	return path;
}

export function saveReturnTo(path: string) {
	try {
		localStorage.setItem(KEY, sanitizeReturnTo(path));
	} catch {
		// 保存できない環境ではホームに戻る
	}
}

export function takeReturnTo(): string {
	try {
		const path = localStorage.getItem(KEY);
		localStorage.removeItem(KEY);
		return sanitizeReturnTo(path);
	} catch {
		return '/';
	}
}
