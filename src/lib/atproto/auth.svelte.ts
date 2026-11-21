import { Agent } from '@atproto/api';
import {
	BrowserOAuthClient,
	atprotoLoopbackClientMetadata,
	type OAuthSession
} from '@atproto/oauth-client-browser';
import { APP_URL, CALLBACK_PATH, HANDLE_RESOLVER, OAUTH_SCOPE, buildClientMetadata } from './config';
import { saveReturnTo } from './returnTo';

type AuthState =
	| { status: 'loading' }
	| { status: 'signedOut'; error?: string }
	| { status: 'signedIn'; did: string; handle: string; agent: Agent };

export const auth = $state<{ current: AuthState }>({ current: { status: 'loading' } });

let client: BrowserOAuthClient | undefined;

/**
 * セッションが削除されたとき（期限切れ・別タブでのログアウトなど）。
 * ログインのコールバック処理中にも、同じアカウントの古いセッションの破棄で呼ばれるため、
 * 「ログイン中のアカウントのセッション」が消えたときだけログアウト状態にする
 * （無条件にすると、ログイン直後にログイン画面が一瞬表示されてしまう）。
 */
export function handleSessionDeleted(sub: string) {
	const current = auth.current;
	if (current.status === 'signedIn' && current.did === sub) {
		auth.current = { status: 'signedOut' };
	}
}

const onSessionDeleted = (sub: string) => handleSessionDeleted(sub);

function createClient(): BrowserOAuthClient {
	if (APP_URL) {
		return new BrowserOAuthClient({
			handleResolver: HANDLE_RESOLVER,
			clientMetadata: buildClientMetadata(APP_URL),
			onSessionDeleted
		});
	}
	// 開発用ループバッククライアント。client_id のオリジンは http://localhost 固定
	const redirect = `${location.origin}${CALLBACK_PATH}`;
	const clientId =
		`http://localhost?redirect_uri=${encodeURIComponent(redirect)}` +
		`&scope=${encodeURIComponent(OAUTH_SCOPE)}`;
	return new BrowserOAuthClient({
		handleResolver: HANDLE_RESOLVER,
		clientMetadata: atprotoLoopbackClientMetadata(clientId),
		onSessionDeleted
	});
}

async function applySession(session: OAuthSession) {
	const agent = new Agent(session);
	let handle: string = session.did;
	try {
		const res = await agent.com.atproto.repo.describeRepo({ repo: session.did });
		handle = res.data.handle;
	} catch {
		// ハンドル取得に失敗しても DID で続行する
	}
	auth.current = { status: 'signedIn', did: session.did, handle, agent };
	// 前回送れなかった回答があれば再送し、Anki 連携を設定済みなら接続する
	void import('../study/data').then(({ getOutbox }) =>
		getOutbox(agent, session.did)
			.flush()
			.catch(() => {})
	);
	void import('../anki/state.svelte').then(({ initAnki }) => initAnki(agent, session.did));
}

/** アプリ起動時に 1 回呼ぶ。OAuth のコールバック処理とセッションの復元を行う */
export async function initAuth() {
	if (client) return;
	try {
		client = createClient();
		const result = await client.init();
		if (result?.session) {
			await applySession(result.session);
		} else {
			auth.current = { status: 'signedOut' };
		}
	} catch (e) {
		auth.current = { status: 'signedOut', error: e instanceof Error ? e.message : String(e) };
	}
}

export async function signIn(handleOrUrl: string) {
	if (!client) throw new Error('auth is not initialized');
	// ログイン後は、ログインを始めた画面に戻す（docs/SPEC.md 3.7）
	saveReturnTo(location.pathname + location.search);
	// signIn はリダイレクトするため、通常は戻ってこない
	await client.signIn(handleOrUrl.trim().replace(/^@/, ''), { scope: OAUTH_SCOPE });
}

export async function signOut() {
	const current = auth.current;
	if (current.status !== 'signedIn' || !client) return;
	try {
		const session = await client.restore(current.did, false);
		await session.signOut();
	} finally {
		auth.current = { status: 'signedOut' };
	}
}

export interface Viewer {
	agent: Agent;
	did: string;
	handle: string;
}

/** ログイン中ならそのユーザー、未ログインなら undefined（未ログインでも開ける画面で使う） */
export function viewer(): Viewer | undefined {
	const current = auth.current;
	return current.status === 'signedIn'
		? { agent: current.agent, did: current.did, handle: current.handle }
		: undefined;
}

/** ログインのモーダル（未ログインでログインが必要な操作をしたとき） */
export const loginPrompt = $state<{ open: boolean; reason?: string }>({ open: false });

export function openLogin(reason?: string) {
	loginPrompt.reason = reason;
	loginPrompt.open = true;
}

/** ログイン中のユーザーの Agent と DID を返す（ログイン後の画面でのみ使う） */
export function currentUser(): { agent: Agent; did: string; handle: string } {
	const current = auth.current;
	if (current.status !== 'signedIn') throw new Error('not signed in');
	return { agent: current.agent, did: current.did, handle: current.handle };
}
