/**
 * AnkiConnect の接続状態と自動同期（docs/SPEC.md 2.3 / 3.6）
 * 自動同期は、この端末で一度 Anki 連携を設定した場合だけ行う
 * （未設定の端末で Anki の許可ダイアログやブラウザの許可プロンプトを出さないため）。
 */
import type { Agent } from '@atproto/api';
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { getOutbox } from '../study/data';
import { AnkiConnect, AnkiConnectError, isAnkiSupportedBrowser } from './client';
import { listLinkedDecks, syncDeck, type SyncResult } from './sync';

export const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const KEY_ENABLED = 'anki:enabled';
const KEY_API_KEY = 'anki:apiKey';

export type AnkiStatus =
	| 'idle'
	| 'unsupported'
	| 'connecting'
	| 'unreachable'
	| 'denied'
	| 'needKey'
	| 'badKey'
	| 'connected';

export const ankiState = $state<{
	status: AnkiStatus;
	error?: string;
	syncing: boolean;
	lastSyncAt?: string;
	lastResult?: { deck: string; result?: SyncResult; error?: string }[];
}>({ status: 'idle', syncing: false });

export const anki = new AnkiConnect();

let timer: ReturnType<typeof setInterval> | undefined;
let session: { agent: Agent; did: string } | undefined;

export async function connect(apiKey?: string): Promise<AnkiStatus> {
	if (!isAnkiSupportedBrowser()) return (ankiState.status = 'unsupported');
	ankiState.status = 'connecting';
	ankiState.error = undefined;
	try {
		const key = apiKey ?? (await idbGet<string>(KEY_API_KEY).catch(() => undefined));
		anki.setApiKey(key);
		const perm = await anki.requestPermission();
		if (perm.permission !== 'granted') return (ankiState.status = 'denied');
		if (perm.requireApikey && !key) return (ankiState.status = 'needKey');
		const version = await anki.version();
		if (version < 6) throw new Error(`AnkiConnect version ${version} is too old`);
		if (apiKey !== undefined) await idbSet(KEY_API_KEY, apiKey);
		await idbSet(KEY_ENABLED, true);
		ankiState.status = 'connected';
		startAutoSync();
		void syncAll();
	} catch (e) {
		const err = e as Error;
		ankiState.error = err.message;
		if (e instanceof AnkiConnectError && e.kind === 'unreachable') ankiState.status = 'unreachable';
		else if (/api key/i.test(err.message)) ankiState.status = 'badKey';
		else ankiState.status = 'unreachable';
	}
	return ankiState.status;
}

/** この端末での Anki 連携の設定を消す（PDS 上のデッキには触れない） */
export async function disconnect() {
	stopAutoSync();
	await idbDel(KEY_ENABLED).catch(() => {});
	await idbDel(KEY_API_KEY).catch(() => {});
	anki.setApiKey(undefined);
	ankiState.status = 'idle';
}

/** ログイン後に呼ぶ。設定済みの端末なら接続して自動同期を始める */
export async function initAnki(agent: Agent, did: string) {
	session = { agent, did };
	if (!isAnkiSupportedBrowser()) {
		ankiState.status = 'unsupported';
		return;
	}
	if (await idbGet<boolean>(KEY_ENABLED).catch(() => false)) await connect();
}

function startAutoSync() {
	if (timer) return;
	timer = setInterval(() => void syncAll(), AUTO_SYNC_INTERVAL_MS);
}

function stopAutoSync() {
	if (timer) clearInterval(timer);
	timer = undefined;
}

/** 連携デッキをすべて同期する。別のタブで同期中ならスキップする */
export async function syncAll(): Promise<void> {
	if (!session || ankiState.status !== 'connected' || ankiState.syncing) return;
	const { agent, did } = session;
	const run = async () => {
		ankiState.syncing = true;
		try {
			const linked = await listLinkedDecks(did);
			const outbox = getOutbox(agent, did);
			const results: NonNullable<typeof ankiState.lastResult> = [];
			for (const l of linked) {
				try {
					results.push({ deck: l.deck.record.name, result: await syncDeck(agent, did, anki, l, outbox) });
				} catch (e) {
					results.push({ deck: l.deck.record.name, error: e instanceof Error ? e.message : String(e) });
					if (e instanceof AnkiConnectError && e.kind === 'unreachable') {
						ankiState.status = 'unreachable';
						break;
					}
				}
			}
			ankiState.lastResult = results;
			ankiState.lastSyncAt = new Date().toISOString();
		} finally {
			ankiState.syncing = false;
		}
	};
	if (typeof navigator !== 'undefined' && navigator.locks) {
		await navigator.locks.request('ankiat-anki-sync', { ifAvailable: true }, async (lock) => {
			if (lock) await run();
		});
	} else {
		await run();
	}
}
