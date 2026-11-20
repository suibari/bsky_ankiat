// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Agent } from '@atproto/api';
import { auth, handleSessionDeleted } from './auth.svelte';

const signedIn = (did: string) => ({ status: 'signedIn' as const, did, handle: 'a.test', agent: {} as Agent });

describe('handleSessionDeleted', () => {
	it('読み込み中（ログインのコールバック処理中）は、古いセッションの破棄でログアウト状態にしない', () => {
		auth.current = { status: 'loading' };
		handleSessionDeleted('did:plc:a');
		expect(auth.current.status).toBe('loading');
	});

	it('ログイン中のアカウントのセッションが消えたらログアウト状態にする', () => {
		auth.current = signedIn('did:plc:a');
		handleSessionDeleted('did:plc:a');
		expect(auth.current.status).toBe('signedOut');
	});

	it('別のアカウントのセッションが消えても影響しない', () => {
		auth.current = signedIn('did:plc:a');
		handleSessionDeleted('did:plc:b');
		expect(auth.current.status).toBe('signedIn');
	});
});
