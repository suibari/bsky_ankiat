import type { OAuthClientMetadataInput } from '@atproto/oauth-client-browser';
import { PUBLIC_APP_URL, PUBLIC_HANDLE_RESOLVER } from '$app/env/public';
import { NSID } from './lexicons';

/** OAuth で要求するスコープ。コレクションごとの granular scope を列挙する（docs/SPEC.md 3.1） */
export const OAUTH_SCOPE = ['atproto', ...Object.values(NSID).map((c) => `repo:${c}`)].join(' ');

/**
 * 本番の公開 URL（末尾スラッシュなし）。例: https://ankiat.example.com
 * 未設定の場合は開発用のループバッククライアントとして動作する。
 */
export const APP_URL: string = PUBLIC_APP_URL;

/** ハンドル解決に使う XRPC サービス（docs/SPEC.md 3.1。デフォルト bsky.social） */
export const HANDLE_RESOLVER: string = PUBLIC_HANDLE_RESOLVER;

export const CALLBACK_PATH = '/oauth/callback';

export function buildClientMetadata(appUrl: string): OAuthClientMetadataInput {
	return {
		client_id: `${appUrl}/client-metadata.json`,
		client_name: 'AnkiAt',
		client_uri: appUrl,
		redirect_uris: [`${appUrl}${CALLBACK_PATH}`],
		scope: OAUTH_SCOPE,
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		token_endpoint_auth_method: 'none',
		application_type: 'web',
		dpop_bound_access_tokens: true
	};
}
