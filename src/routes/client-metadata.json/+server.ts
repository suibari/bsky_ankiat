import { json } from '@sveltejs/kit';
import { APP_URL, buildClientMetadata } from '#lib/atproto/config.js';

// ビルド時に静的ファイルとして書き出す（PUBLIC_APP_URL が必要）
export const prerender = true;

export function GET() {
	if (!APP_URL) {
		return json({ error: 'PUBLIC_APP_URL is not set (loopback client is used in development)' });
	}
	return json(buildClientMetadata(APP_URL));
}
