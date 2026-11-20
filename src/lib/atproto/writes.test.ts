import { describe, expect, it } from 'vitest';
import { batchWrites, create, MAX_WRITES_PER_REQUEST } from './writes';

describe('batchWrites', () => {
	it('200 操作ごとに分割する', () => {
		const writes = Array.from({ length: 450 }, (_, i) => create('c', `r${i}`, {}));
		expect(batchWrites(writes).map((b) => b.length)).toEqual([MAX_WRITES_PER_REQUEST, 200, 50]);
	});

	it('サイズの上限を超えないように分割し、順序を保つ', () => {
		const writes = Array.from({ length: 5 }, (_, i) => create('c', `r${i}`, { s: 'x'.repeat(300) }));
		const batches = batchWrites(writes, 800);
		expect(batches.length).toBeGreaterThan(1);
		expect(batches.flat()).toEqual(writes);
	});

	it('1 件で上限を超える書き込みはエラーにする', () => {
		expect(() => batchWrites([create('c', 'r', { s: 'x'.repeat(2000) })], 1000)).toThrow();
	});
});
