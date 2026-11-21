import { describe, expect, it } from 'vitest';
import { sanitizeReturnTo } from './returnTo';

describe('sanitizeReturnTo', () => {
	it('同じオリジンのパスはそのまま返す', () => {
		expect(sanitizeReturnTo('/study/did:plc:a/3k?x=1')).toBe('/study/did:plc:a/3k?x=1');
	});

	it('外部の URL やプロトコル相対 URL はホームにする', () => {
		expect(sanitizeReturnTo('https://evil.example/')).toBe('/');
		expect(sanitizeReturnTo('//evil.example/')).toBe('/');
		expect(sanitizeReturnTo('/\\evil.example')).toBe('/');
	});

	it('空やコールバック画面はホームにする', () => {
		expect(sanitizeReturnTo(null)).toBe('/');
		expect(sanitizeReturnTo('')).toBe('/');
		expect(sanitizeReturnTo('/oauth/callback?code=x')).toBe('/');
	});
});
