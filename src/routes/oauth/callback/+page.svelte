<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '#lib/atproto/auth.svelte.js';

	// コールバック自体の処理はレイアウトの initAuth() が行う。完了したらホームへ戻す
	$effect(() => {
		if (auth.current.status === 'signedIn') goto('/', { replaceState: true });
	});
</script>
