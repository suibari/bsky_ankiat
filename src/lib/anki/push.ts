/** AnkiAt での回答を Anki へ反映する計画（docs/SPEC.md 3.6 手順 3） */
import type { ReviewLogRecord } from '../atproto/records';
import { parseAnkiCardId } from './convert';

export interface PushPlan {
	answers: { cardId: number; ease: number; reviewedAt: string }[];
	/** 処理した reviewLog の最大 rkey（次回の基準点）。処理対象がなければ元の値 */
	watermark: string | undefined;
}

/**
 * rkey が基準点より大きい、このデッキの source=ankiat の reviewLog を対象に、
 * 回答を時系列順に並べる。rkey は TID なので文字列比較で時刻順になる。
 */
export function planPush(
	logs: { rkey: string; value: ReviewLogRecord }[],
	deckUri: string,
	watermark: string | undefined,
	/** 前回途中で失敗したとき、送り終えた最後の回答の時刻。これ以前の回答は送らない */
	pushedUntil?: string
): PushPlan {
	const targets = logs.filter(
		(l) =>
			l.value.deck === deckUri &&
			l.value.source === 'ankiat' &&
			(watermark === undefined || l.rkey > watermark)
	);
	const entries = targets
		.flatMap((l) => l.value.entries)
		.filter((e) => pushedUntil === undefined || e.reviewedAt > pushedUntil)
		.sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
	const answers: PushPlan['answers'] = [];
	for (const e of entries) {
		const cardId = parseAnkiCardId(e.cardId);
		if (cardId !== undefined) answers.push({ cardId, ease: e.rating, reviewedAt: e.reviewedAt });
	}
	const next = targets.reduce<string | undefined>(
		(max, l) => (max === undefined || l.rkey > max ? l.rkey : max),
		watermark
	);
	return { answers, watermark: next };
}
