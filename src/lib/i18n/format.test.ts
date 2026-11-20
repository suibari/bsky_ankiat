import { describe, expect, it } from 'vitest';
import { formatInterval } from './format';

describe('formatInterval', () => {
	it('適切な単位で丸める', () => {
		expect(formatInterval(30_000, 'en')).toBe('1 min');
		expect(formatInterval(10 * 60_000, 'en')).toBe('10 min');
		expect(formatInterval(3 * 86_400_000, 'en')).toBe('3 days');
		expect(formatInterval(70 * 86_400_000, 'en')).toBe('2 mths');
		expect(formatInterval(10 * 60_000, 'ja')).toBe('10 分');
	});
});
