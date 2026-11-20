/** Lexicon（lexicons/com/suibari/ankiat/*.json）に対応する TypeScript 型 */
import { NSID } from './lexicons';

export interface AnkiSource {
	type: 'anki';
	ankiDeckId: number;
	ankiDeckName: string;
}

export interface DeckRecord {
	$type?: typeof NSID.deck;
	name: string;
	description?: string;
	tags?: string[];
	langs?: string[];
	listed?: boolean;
	cardCount: number;
	chunkCount: number;
	source?: AnkiSource;
	createdAt: string;
	updatedAt: string;
}

export interface AnkiCardInfo {
	cardId: number;
	noteId: number;
	mod: number;
	noteMod: number;
}

export interface Card {
	id: string;
	front: string;
	back: string;
	tags?: string[];
	anki?: AnkiCardInfo;
}

export interface CardChunkRecord {
	$type?: typeof NSID.cardChunk;
	deck: string;
	index: number;
	cards: Card[];
	updatedAt: string;
}

export type Rating = 1 | 2 | 3 | 4;

export interface ReviewEntry {
	cardId: string;
	rating: Rating;
	reviewedAt: string;
	durationMs?: number;
	ankiRevlogId?: number;
}

export interface ReviewLogRecord {
	$type?: typeof NSID.reviewLog;
	deck: string;
	source: 'ankiat' | 'anki';
	entries: ReviewEntry[];
	createdAt: string;
}

export interface SubscriptionRecord {
	$type?: typeof NSID.subscription;
	deck: string;
	createdAt: string;
}

export interface AnkiSyncRecord {
	$type?: typeof NSID.ankiSync;
	deck: string;
	lastImportedRevlogId: number;
	lastPushedReviewLogRkey?: string;
	lastSyncedAt: string;
}

export interface PreferencesRecord {
	$type?: typeof NSID.preferences;
	newCardsPerDay?: number;
	publicHistoryConsentAt?: string;
}

export function chunkRkey(deckRkey: string, index: number): string {
	return `${deckRkey}-${index}`;
}

export function atUri(did: string, collection: string, rkey: string): string {
	return `at://${did}/${collection}/${rkey}`;
}

export function parseAtUri(uri: string): { did: string; collection: string; rkey: string } {
	const m = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
	if (!m) throw new Error(`invalid at-uri: ${uri}`);
	return { did: m[1], collection: m[2], rkey: m[3] };
}
