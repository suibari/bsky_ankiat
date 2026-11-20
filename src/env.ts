import { defineEnvVars } from '@sveltejs/kit/env';

// 静的 SPA なので、すべてビルド時に埋め込む公開変数とする
export const variables = defineEnvVars({
	PUBLIC_APP_URL: {
		public: true,
		static: true,
		description:
			'本番の公開 URL（末尾スラッシュなし）。未設定なら開発用ループバッククライアントで動作する',
		schema: (value) => (value ?? '').replace(/\/$/, '')
	},
	PUBLIC_HANDLE_RESOLVER: {
		public: true,
		static: true,
		description: 'ハンドル解決に使う XRPC サービスの URL',
		schema: (value) => value || 'https://bsky.social'
	}
});
