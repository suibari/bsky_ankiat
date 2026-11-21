/**
 * カードのまとめて入力（docs/SPEC.md 3.2）
 * 1 行に 1 枚、「表[Tab]裏」の形式。スプレッドシートからのコピー（改行を含むセルは "…" で囲まれる）、
 * Quizlet や Anki のテキスト書き出しをそのまま受け付ける。.csv ファイルはカンマ区切りとして読む。
 */

export type Delimiter = '\t' | ',';

export const MAX_BULK_CARDS = 2000;

export interface BulkCard {
	front: string;
	back: string;
}

export interface BulkError {
	/** 1 始まりの行番号（その行が始まる位置） */
	line: number;
	reason: 'noDelimiter' | 'empty';
}

export interface BulkResult {
	cards: BulkCard[];
	errors: BulkError[];
	/** 上限を超えて読み捨てた枚数 */
	overflow: number;
}

interface Row {
	line: number;
	fields: string[];
}

/** 区切り文字と、"…" で囲まれたフィールド（中の "" は " 1 文字）を解釈して行に分ける */
export function splitRows(input: string, delimiter: Delimiter): Row[] {
	const text = input.replace(/\r\n?/g, '\n');
	const rows: Row[] = [];
	let i = 0;
	let line = 1;
	while (i < text.length) {
		const row: Row = { line, fields: [] };
		for (;;) {
			let field: string | undefined;
			if (text[i] === '"') {
				// 囲みとして閉じていて、直後が区切り・改行・末尾のときだけ囲みとみなす
				let j = i + 1;
				let buf = '';
				let closed = false;
				while (j < text.length) {
					if (text[j] === '"') {
						if (text[j + 1] === '"') {
							buf += '"';
							j += 2;
							continue;
						}
						closed = true;
						break;
					}
					buf += text[j++];
				}
				const after = text[j + 1];
				if (closed && (after === undefined || after === delimiter || after === '\n')) {
					field = buf;
					line += (text.slice(i, j + 1).match(/\n/g) ?? []).length;
					i = j + 1;
				}
			}
			if (field === undefined) {
				let j = i;
				while (j < text.length && text[j] !== delimiter && text[j] !== '\n') j++;
				field = text.slice(i, j);
				i = j;
			}
			row.fields.push(field);
			if (text[i] === delimiter) {
				i++;
				continue;
			}
			break;
		}
		rows.push(row);
		if (text[i] === '\n') {
			i++;
			line++;
		}
	}
	return rows;
}

/** Anki のテキスト書き出しの先頭にある設定行（#separator:tab など） */
const ANKI_HEADER = /^#[a-z ]+:/i;

export function parseBulk(input: string, delimiter: Delimiter = '\t'): BulkResult {
	const cards: BulkCard[] = [];
	const errors: BulkError[] = [];
	let overflow = 0;
	for (const row of splitRows(input, delimiter)) {
		const fields = row.fields.map((f) => f.trim());
		if (fields.every((f) => f === '')) continue;
		if (fields.length === 1 && ANKI_HEADER.test(fields[0])) continue;
		if (fields.length < 2) {
			errors.push({ line: row.line, reason: 'noDelimiter' });
			continue;
		}
		// 3 列目以降（Anki のタグ列など）は使わない
		const [front, back] = fields;
		if (!front || !back) {
			errors.push({ line: row.line, reason: 'empty' });
			continue;
		}
		if (cards.length >= MAX_BULK_CARDS) {
			overflow++;
			continue;
		}
		cards.push({ front, back });
	}
	return { cards, errors, overflow };
}

/** ファイルを読む。UTF-8 として読めなければ Shift_JIS（Excel の CSV）として読む */
export function decodeText(bytes: ArrayBuffer): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
	} catch {
		return new TextDecoder('shift_jis').decode(bytes);
	}
}

export function delimiterForFile(name: string): Delimiter {
	return /\.csv$/i.test(name) ? ',' : '\t';
}
