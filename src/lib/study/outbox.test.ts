import { describe, expect, it } from 'vitest';
import type { ReviewEntry } from '../atproto/records';
import { Outbox, type OutboxState, type PendingBatch } from './outbox';

function setup(opts: { failWrites?: number; existsAfterFail?: boolean } = {}) {
	const data = new Map<string, OutboxState>();
	const written: PendingBatch[] = [];
	let fails = opts.failWrites ?? 0;
	let n = 0;
	const outbox = new Outbox('did:x', {
		store: {
			get: async (k) => structuredClone(data.get(k)),
			set: async (k, v) => void data.set(k, structuredClone(v))
		},
		write: async (b) => {
			if (fails > 0) {
				fails--;
				if (opts.existsAfterFail) written.push(b);
				throw new Error('network');
			}
			written.push(b);
		},
		exists: async (rkey) => written.some((b) => b.rkey === rkey),
		newRkey: () => `r${++n}`
	});
	return { outbox, written };
}

const e = (cardId: string): ReviewEntry => ({ cardId, rating: 3, reviewedAt: '2026-01-01T00:00:00.000Z' });

describe('Outbox', () => {
	it('デッキごとにまとめて書き込み、書いた分は消える', async () => {
		const { outbox, written } = setup();
		await outbox.add('deckA', e('1'));
		await outbox.add('deckB', e('2'));
		await outbox.add('deckA', e('3'));
		expect(await outbox.flush()).toBe(2);
		expect(written.map((b) => [b.deck, b.entries.map((x) => x.cardId)])).toEqual([
			['deckA', ['1', '3']],
			['deckB', ['2']]
		]);
		expect(await outbox.pending()).toEqual({ unassigned: [], batches: [] });
	});

	it('500 件を超えたら複数のレコードに分ける', async () => {
		const { outbox, written } = setup();
		for (let i = 0; i < 501; i++) await outbox.add('d', e(String(i)));
		await outbox.flush();
		expect(written.map((b) => b.entries.length)).toEqual([500, 1]);
	});

	it('書き込みに失敗したら残し、次回は同じ rkey で再送する', async () => {
		const { outbox, written } = setup({ failWrites: 1 });
		await outbox.add('d', e('1'));
		await expect(outbox.flush()).rejects.toThrow('network');
		expect((await outbox.pending()).batches.map((b) => b.rkey)).toEqual(['r1']);
		await outbox.add('d', e('2'));
		await outbox.flush();
		expect(written.map((b) => b.rkey)).toEqual(['r1', 'r2']);
	});

	it('失敗扱いでも実際には書けていた場合は、二重に書かない', async () => {
		const { outbox, written } = setup({ failWrites: 1, existsAfterFail: true });
		await outbox.add('d', e('1'));
		expect(await outbox.flush()).toBe(1);
		expect(written.map((b) => b.rkey)).toEqual(['r1']);
		expect((await outbox.pending()).batches).toEqual([]);
	});

	it('PDS に既にあるバッチは forget で取り除ける', async () => {
		const { outbox } = setup({ failWrites: 1 });
		await outbox.add('d', e('1'));
		await outbox.flush().catch(() => {});
		await outbox.forget(new Set(['r1']));
		expect((await outbox.pending()).batches).toEqual([]);
	});

	it('同時に呼んでも追加が失われない', async () => {
		const { outbox } = setup();
		await Promise.all(Array.from({ length: 20 }, (_, i) => outbox.add('d', e(String(i)))));
		expect((await outbox.pending()).unassigned.length).toBe(20);
	});

	it('addMany でまとめて追加した回答も、デッキごとに書き込まれる', async () => {
		const { outbox, written } = setup();
		await outbox.add('deckA', e('0'));
		expect(
			await outbox.addMany([
				{ deck: 'deckA', entry: e('1') },
				{ deck: 'deckB', entry: e('2') }
			])
		).toBe(3);
		await outbox.flush();
		expect(written.map((b) => [b.deck, b.entries.map((x) => x.cardId)])).toEqual([
			['deckA', ['0', '1']],
			['deckB', ['2']]
		]);
	});
});
