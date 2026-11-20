/** 学習セッション（docs/SPEC.md 3.4） */
import type { AnkiScheduleEntry, Card, Rating, ReviewEntry } from '../atproto/records';
import { buildQueue, isLearning, LEARN_AHEAD_MS } from './queue';
import { answer, previewDue, type CardState, type Scheduler } from './scheduler';

/** 未送信がこの件数たまったら PDS に書き込む */
export const FLUSH_THRESHOLD = 20;

export interface SessionDeps {
	scheduler: Scheduler;
	deckUri: string;
	cards: Card[];
	states: Map<string, CardState>;
	entries: ReviewEntry[];
	newLimit: number;
	/** Anki 連携デッキで、Anki が計算した期日 */
	overrides?: Map<string, AnkiScheduleEntry>;
	/** 回答を端末に保存し、未送信件数を返す */
	record(entry: ReviewEntry): Promise<number>;
	/** 未送信の回答を PDS に書く */
	flush(): Promise<void>;
	now?: () => Date;
}

export class StudySession {
	current = $state<Card | null>(null);
	revealed = $state(false);
	reviewed = $state(0);
	counts = $state({ due: 0, new: 0, learning: 0 });
	flushError = $state<string>();

	private main: { card: Card; isNew: boolean }[] = [];
	private learning: Card[] = [];
	private currentIsNew = false;
	private shownAt = 0;
	private readonly states: Map<string, CardState>;
	private readonly now: () => Date;

	constructor(private readonly deps: SessionDeps) {
		this.states = new Map(deps.states);
		this.now = deps.now ?? (() => new Date());
		const q = buildQueue(
			deps.cards,
			this.states,
			deps.entries,
			this.now(),
			deps.newLimit,
			deps.overrides
		);
		this.main = [
			...q.due.map((card) => ({ card, isNew: false })),
			...q.newCards.map((card) => ({ card, isNew: true }))
		];
		this.next();
	}

	get done(): boolean {
		return this.current === null;
	}

	/** 4 段階それぞれの次回期日 */
	preview(): Record<Rating, Date> | undefined {
		if (!this.current) return undefined;
		return previewDue(this.deps.scheduler, this.states.get(this.current.id), this.now());
	}

	reveal() {
		this.revealed = true;
	}

	async answer(rating: Rating) {
		const card = this.current;
		if (!card || !this.revealed) return;
		const now = this.now();
		const state = answer(this.deps.scheduler, this.states.get(card.id), rating, now);
		this.states.set(card.id, state);
		this.reviewed++;
		if (isLearning(state) && state.dueAt.getTime() <= now.getTime() + LEARN_AHEAD_MS) {
			this.learning.push(card);
		}
		const entry: ReviewEntry = {
			cardId: card.id,
			rating,
			reviewedAt: now.toISOString(),
			durationMs: Math.max(0, now.getTime() - this.shownAt)
		};
		this.next();
		const pending = await this.deps.record(entry);
		if (pending >= FLUSH_THRESHOLD) void this.flush();
	}

	async flush() {
		try {
			await this.deps.flush();
			this.flushError = undefined;
		} catch (e) {
			this.flushError = e instanceof Error ? e.message : String(e);
		}
	}

	private next() {
		const now = this.now().getTime();
		this.learning.sort((a, b) => this.dueOf(a) - this.dueOf(b));
		let card: Card | undefined;
		if (this.learning.length > 0 && this.dueOf(this.learning[0]) <= now) {
			card = this.learning.shift();
			this.currentIsNew = false;
		} else if (this.main.length > 0) {
			const item = this.main.shift()!;
			card = item.card;
			this.currentIsNew = item.isNew;
		} else if (this.learning.length > 0) {
			// 学習ステップの期日前でも、他に出すカードがなければ先取りする
			card = this.learning.shift();
			this.currentIsNew = false;
		}
		this.current = card ?? null;
		this.revealed = false;
		this.shownAt = now;
		this.updateCounts();
	}

	private dueOf(card: Card): number {
		return this.states.get(card.id)?.dueAt.getTime() ?? 0;
	}

	private updateCounts() {
		const counts = { due: 0, new: 0, learning: this.learning.length };
		for (const m of this.main) m.isNew ? counts.new++ : counts.due++;
		if (this.current) {
			if (this.currentIsNew) counts.new++;
			else if (this.states.get(this.current.id) && isLearning(this.states.get(this.current.id)!))
				counts.learning++;
			else counts.due++;
		}
		this.counts = counts;
	}
}
