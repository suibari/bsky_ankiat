import { describe, expect, it } from 'vitest';
import type { Card } from '../atproto/records';
import { jsonBytes } from '../atproto/writes';
import { applyCardChanges } from './chunking';

const card = (id: string, size = 10): Card => ({ id, front: 'x'.repeat(size), back: 'y' });

describe('applyCardChanges', () => {
	it('空のデッキに追加すると 1 つ目のチャンクができる', () => {
		const plan = applyCardChanges([], { upserts: [card('a'), card('b')] });
		expect(plan.chunks.map((c) => c.map((x) => x.id))).toEqual([['a', 'b']]);
		expect(plan.changed).toEqual([0]);
		expect(plan.cardCount).toBe(2);
	});

	it('目安サイズを超えると新しいチャンクに分かれ、各チャンクは目安以下に収まる', () => {
		const cards = Array.from({ length: 50 }, (_, i) => card(`c${i}`, 100));
		const plan = applyCardChanges([], { upserts: cards }, 1000);
		expect(plan.chunks.length).toBeGreaterThan(1);
		for (const c of plan.chunks) expect(jsonBytes(c)).toBeLessThanOrEqual(1000);
		expect(plan.chunks.flat().map((c) => c.id)).toEqual(cards.map((c) => c.id));
		expect(plan.changed).toEqual(plan.chunks.map((_, i) => i));
	});

	it('新しいカードは末尾のチャンクに追加され、既存チャンクは変更されない', () => {
		const plan = applyCardChanges([[card('a')], [card('b')]], { upserts: [card('c')] });
		expect(plan.chunks.map((c) => c.map((x) => x.id))).toEqual([['a'], ['b', 'c']]);
		expect(plan.changed).toEqual([1]);
	});

	it('削除しても詰め直さず、空のチャンクも残す', () => {
		const plan = applyCardChanges([[card('a')], [card('b')]], { deletes: ['a', 'missing'] });
		expect(plan.chunks.map((c) => c.map((x) => x.id))).toEqual([[], ['b']]);
		expect(plan.changed).toEqual([0]);
		expect(plan.cardCount).toBe(1);
	});

	it('既存カードの更新はその場で置き換える', () => {
		const plan = applyCardChanges([[card('a'), card('b')]], {
			upserts: [{ id: 'a', front: 'new', back: 'y' }]
		});
		expect(plan.chunks[0][0].front).toBe('new');
		expect(plan.chunks[0].map((c) => c.id)).toEqual(['a', 'b']);
		expect(plan.changed).toEqual([0]);
	});

	it('更新で目安サイズを超えたら、そのカードを末尾のチャンクへ移す', () => {
		const existing = [[card('a', 100), card('b', 100)], [card('c', 100)]];
		const plan = applyCardChanges(existing, { upserts: [card('a', 900)] }, 1000);
		expect(plan.chunks[0].map((c) => c.id)).toEqual(['b']);
		expect(plan.chunks.flat().find((c) => c.id === 'a')?.front.length).toBe(900);
		expect(plan.changed).toContain(0);
		expect(plan.cardCount).toBe(3);
	});

	it('目安より大きい 1 枚のカードは単独のチャンクになる', () => {
		const plan = applyCardChanges([[card('a')]], { upserts: [card('big', 5000)] }, 1000);
		expect(plan.chunks.map((c) => c.map((x) => x.id))).toEqual([['a'], ['big']]);
	});

	it('元の配列を変更しない', () => {
		const existing = [[card('a')]];
		applyCardChanges(existing, { upserts: [card('b')], deletes: ['a'] });
		expect(existing[0].map((c) => c.id)).toEqual(['a']);
	});
});
