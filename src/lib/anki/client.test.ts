import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnkiConnect } from './client';

function stubAnki(responses: { result: unknown; error: string | null }[]) {
	const bodies: unknown[] = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: string, init: RequestInit) => {
			bodies.push(JSON.parse(init.body as string));
			return new Response(JSON.stringify(responses.shift()));
		})
	);
	return bodies;
}

afterEach(() => vi.unstubAllGlobals());

describe('AnkiConnect.answerCard', () => {
	it('Anki の出題キューと食い違って拒否されたら 1 回だけ再試行する', async () => {
		const bodies = stubAnki([
			{ result: null, error: 'not at top of queue' },
			{ result: [true], error: null }
		]);
		expect(await new AnkiConnect().answerCard(1, 3)).toBe(true);
		expect(bodies).toHaveLength(2);
		expect(bodies[1]).toMatchObject({ action: 'answerCards', params: { answers: [{ cardId: 1, ease: 3 }] } });
	});

	it('それ以外のエラーは再試行しない', async () => {
		const bodies = stubAnki([{ result: null, error: 'collection is not available' }]);
		await expect(new AnkiConnect().answerCard(1, 3)).rejects.toThrow('collection is not available');
		expect(bodies).toHaveLength(1);
	});
});
