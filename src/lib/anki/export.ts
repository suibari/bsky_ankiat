/**
 * AnkiAt のデッキを Anki に書き出す（コピー。以後は AnkiAt とつながらない）
 * - 書き出し先は「AnkiAt::デッキ名」、ノートには「AnkiAt」タグを付ける
 * - ノートタイプは言語に左右されないよう、専用の「AnkiAt」（表・裏）を使う（なければ作る）
 * - 同じデッキ内で表面が同じノートは追加しない（2 回目以降は追加分だけ足される）
 * - 他人の HTML が Anki 内で動かないよう、表示用と同じサニタイズを通す
 */
import type { Card } from '../atproto/records';
import { sanitizeCardHtml, stripAnswerPrefix } from '../decks/sanitize';
import type { AnkiConnect, AnkiNewNote } from './client';

export const EXPORT_MODEL = 'AnkiAt';
export const EXPORT_TAG = 'AnkiAt';
const BATCH = 200;

const MODEL = {
	modelName: EXPORT_MODEL,
	inOrderFields: ['Front', 'Back'],
	cardTemplates: [{ Name: 'Card 1', Front: '{{Front}}', Back: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}' }],
	css: '.card { font-family: system-ui, sans-serif; font-size: 20px; text-align: center; color: black; background-color: white; }'
};

/** Anki のデッキ名（「::」は階層の区切りなので、名前の中では全角に置き換える） */
export function exportDeckName(name: string): string {
	const safe = name.replace(/::/g, '：').trim() || 'deck';
	return `AnkiAt::${safe}`;
}

export interface ExportLabels {
	image: string;
	audio: string;
}

export function toAnkiNote(card: Card, deckName: string, fromAnki: boolean, labels: ExportLabels): AnkiNewNote {
	const back = fromAnki ? stripAnswerPrefix(card.back) : card.back;
	return {
		deckName,
		modelName: EXPORT_MODEL,
		fields: { Front: sanitizeCardHtml(card.front, labels), Back: sanitizeCardHtml(back, labels) },
		tags: [EXPORT_TAG],
		options: {
			allowDuplicate: false,
			duplicateScope: 'deck',
			duplicateScopeOptions: { deckName, checkChildren: false, checkAllModels: false }
		}
	};
}

export interface ExportResult {
	deckName: string;
	added: number;
	/** 書き出し済み・重複などで追加しなかった数 */
	skipped: number;
}

export async function exportDeckToAnki(
	anki: AnkiConnect,
	deck: { name: string; cards: Card[]; fromAnki: boolean },
	labels: ExportLabels
): Promise<ExportResult> {
	if (!(await anki.modelNames()).includes(EXPORT_MODEL)) await anki.createModel(MODEL);
	const deckName = exportDeckName(deck.name);
	await anki.createDeck(deckName);

	// 同じ一括の中に表面が同じノートがあると全体が失敗するので、先に除く
	const seen = new Set<string>();
	const notes: AnkiNewNote[] = [];
	for (const card of deck.cards) {
		const note = toAnkiNote(card, deckName, deck.fromAnki, labels);
		const key = note.fields.Front.trim();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		notes.push(note);
	}

	let added = 0;
	for (let i = 0; i < notes.length; i += BATCH) {
		const chunk = notes.slice(i, i + BATCH);
		// addNotes は 1 件でも失敗すると全体が取り消されるので、追加できるものだけを渡す
		const checks = await anki.canAddNotesWithErrorDetail(chunk);
		const addable = chunk.filter((_, j) => checks[j]?.canAdd);
		if (addable.length > 0) {
			await anki.addNotes(addable);
			added += addable.length;
		}
	}
	return { deckName, added, skipped: deck.cards.length - added };
}
