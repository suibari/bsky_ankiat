<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '#lib/atproto/auth.svelte.js';
	import { takeReturnTo } from '#lib/atproto/returnTo.js';

	// コールバック自体の処理はレイアウトの initAuth() が行う。
	// 完了したら、ログインを始めた画面に戻す（docs/SPEC.md 3.7）。失敗したら LP へ
	$effect(() => {
		const status = auth.current.status;
		if (status === 'signedIn') goto(takeReturnTo(), { replaceState: true });
		else if (status === 'signedOut') goto('/', { replaceState: true });
	});
</script>
