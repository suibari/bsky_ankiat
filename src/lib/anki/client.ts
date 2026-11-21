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

export interface AnkiNewNote {
	deckName: string;
	modelName: string;
	fields: Record<string, string>;
	tags?: string[];
	options?: {
		allowDuplicate?: boolean;
		duplicateScope?: 'deck' | 'collection';
		duplicateScopeOptions?: { deckName?: string; checkChildren?: boolean; checkAllModels?: boolean };
	};
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
	modelNames() {
		return this.invoke<string[]>('modelNames');
	}
	createModel(params: {
		modelName: string;
		inOrderFields: string[];
		cardTemplates: { Name?: string; Front: string; Back: string }[];
		css?: string;
	}) {
		return this.invoke<unknown>('createModel', params);
	}
	createDeck(deck: string) {
		return this.invoke<number>('createDeck', { deck });
	}
	canAddNotesWithErrorDetail(notes: AnkiNewNote[]) {
		return this.invoke<{ canAdd: boolean; error?: string }[]>('canAddNotesWithErrorDetail', { notes });
	}
	addNotes(notes: AnkiNewNote[]) {
		return this.invoke<number[]>('addNotes', { notes });
	}
	answerCards(answers: { cardId: number; ease: number }[]) {
		return this.invoke<boolean[]>('answerCards', { answers });
	}
	/**
	 * カード 1 枚に回答する。
	 * Anki 本体で学習画面やデッキ概要を開くと出題キューがキャッシュされ、キューの先頭以外の
	 * カードへの回答は "not at top of queue" で拒否される。このエラーではその回答が
	 * ロールバックされ、キャッシュも破棄されるため、1 回だけ再試行すれば通る。
	 * 複数枚をまとめて送ると、どこまで反映されたか分からないまま失敗するため 1 枚ずつ送る。
	 */
	async answerCard(cardId: number, ease: number): Promise<boolean> {
		try {
			return (await this.answerCards([{ cardId, ease }]))[0];
		} catch (e) {
			if (!(e instanceof AnkiConnectError && /not at top of queue/.test(e.message))) throw e;
			return (await this.answerCards([{ cardId, ease }]))[0];
		}
	}
}

/** Anki 連携に対応したブラウザか（Safari は https から 127.0.0.1 への HTTP をブロックする） */
export function isAnkiSupportedBrowser(userAgent = navigator.userAgent): boolean {
	const isSafari = /Safari\//.test(userAgent) && !/(Chrome|Chromium|CriOS|Edg|Firefox|FxiOS)\//.test(userAgent);
	const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
	return !isSafari && !isMobile;
}
