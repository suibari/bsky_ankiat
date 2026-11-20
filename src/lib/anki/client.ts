/**
 * AnkiConnect クライアント（旧 API, version 6）（docs/SPEC.md 2.3）
 * https ページから 127.0.0.1 へ通信するため、Chrome の Local Network Access 向けに
 * fetch へ targetAddressSpace: 'loopback' を指定する。
 */

export const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';
export const ANKI_CONNECT_VERSION = 6;

export class AnkiConnectError extends Error {
	constructor(
		message: string,
		readonly kind: 'unreachable' | 'api'
	) {
		super(message);
	}
}

export interface PermissionResult {
	permission: 'granted' | 'denied';
	requireApikey?: boolean;
	version?: number;
}

export interface AnkiCardInfo {
	cardId: number;
	note: number;
	deckName: string;
	question: string;
	answer: string;
	mod: number;
	queue: number;
}

/** cardReviews の 1 行: [id, cid, usn, ease, ivl, lastIvl, factor, time, type] */
export type RevlogRow = [number, number, number, number, number, number, number, number, number];

export class AnkiConnect {
	constructor(
		private apiKey: string | undefined = undefined,
		private readonly url = ANKI_CONNECT_URL
	) {}

	setApiKey(key: string | undefined) {
		this.apiKey = key || undefined;
	}

	async invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
		const body: Record<string, unknown> = { action, version: ANKI_CONNECT_VERSION, params };
		if (this.apiKey) body.key = this.apiKey;
		let res: Response;
		try {
			res = await fetch(this.url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
				targetAddressSpace: 'loopback'
			} as RequestInit);
		} catch (e) {
			throw new AnkiConnectError(e instanceof Error ? e.message : String(e), 'unreachable');
		}
		const json: { result: T; error: string | null } = await res.json();
		if (json.error) throw new AnkiConnectError(json.error, 'api');
		return json.result;
	}

	requestPermission() {
		return this.invoke<PermissionResult>('requestPermission');
	}
	version() {
		return this.invoke<number>('version');
	}
	deckNamesAndIds() {
		return this.invoke<Record<string, number>>('deckNamesAndIds');
	}
	findCards(query: string) {
		return this.invoke<number[]>('findCards', { query });
	}
	cardsInfo(cards: number[], fields?: string[]) {
		return this.invoke<AnkiCardInfo[]>('cardsInfo', fields ? { cards, fields } : { cards });
	}
	notesModTime(notes: number[]) {
		return this.invoke<{ noteId: number; mod: number }[]>('notesModTime', { notes });
	}
	cardReviews(deck: string, startID: number) {
		return this.invoke<RevlogRow[]>('cardReviews', { deck, startID });
	}
	getReviewsOfCards(cards: number[]) {
		return this.invoke<Record<string, { id: number; ivl: number; type: number }[]>>('getReviewsOfCards', {
			cards
		});
	}
	getLatestReviewID(deck: string) {
		return this.invoke<number>('getLatestReviewID', { deck });
	}
	answerCards(answers: { cardId: number; ease: number }[]) {
		return this.invoke<boolean[]>('answerCards', { answers });
	}
}

/** Anki 連携に対応したブラウザか（Safari は https から 127.0.0.1 への HTTP をブロックする） */
export function isAnkiSupportedBrowser(userAgent = navigator.userAgent): boolean {
	const isSafari = /Safari\//.test(userAgent) && !/(Chrome|Chromium|CriOS|Edg|Firefox|FxiOS)\//.test(userAgent);
	const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
	return !isSafari && !isMobile;
}
