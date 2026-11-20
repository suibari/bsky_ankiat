import { Agent } from '@atproto/api';
import {
	BrowserOAuthClient,
	atprotoLoopbackClientMetadata,
	type OAuthSession
} from '@atproto/oauth-client-browser';
import { APP_URL, CALLBACK_PATH, HANDLE_RESOLVER, OAUTH_SCOPE, buildClientMetadata } from './config';

type AuthState =
	| { status: 'loading' }
	| { status: 'signedOut'; error?: string }
	| { status: 'signedIn'; did: string; handle: string; agent: Agent };

export const auth = $state<{ current: AuthState }>({ current: { status: 'loading' } });

let client: BrowserOAuthClient | undefined;

const onSessionDeleted = () => {
	auth.current = { status: 'signedOut' };
};

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

/** ログイン中のユーザーの Agent と DID を返す（ログイン後の画面でのみ使う） */
export function currentUser(): { agent: Agent; did: string; handle: string } {
	const current = auth.current;
	if (current.status !== 'signedIn') throw new Error('not signed in');
	return { agent: current.agent, did: current.did, handle: current.handle };
}
