import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// バックエンドなしの静的 SPA として出力する（docs/SPEC.md 1章）
			adapter: adapter({ fallback: 'index.html' })
		})
	],
	server: {
		// OAuth のループバッククライアントは 127.0.0.1 からのアクセスのみ許可される
		host: '127.0.0.1',
		port: 5173
	}
});
