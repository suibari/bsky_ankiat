import { describe, expect, it } from 'vitest';
import { countLearners } from './learners';

const A = 'at://did:a/com.suibari.ankiat.deck/1';
const B = 'at://did:b/com.suibari.ankiat.deck/1';

describe('countLearners', () => {
	it('ユーザーごとに 1 人と数え、作者本人と不正な URI は除く', () => {
		const counts = countLearners(
			new Map([
				['did:x', [A, A, B]],
				['did:y', [A]],
				['did:a', [A]], // 作者本人
				['did:z', ['not-a-uri']]
			])
		);
		expect(Object.fromEntries(counts)).toEqual({ [A]: 2, [B]: 1 });
	});
});
