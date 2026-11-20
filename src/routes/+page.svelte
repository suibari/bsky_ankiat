<script lang="ts">
	import { auth } from '#lib/atproto/auth.svelte.js';
	import { t } from '#lib/i18n/index.svelte.js';
</script>

{#if auth.current.status === 'signedIn'}
	<h1>{t('home.welcome', { handle: auth.current.handle })}</h1>
	<p class="muted">{t('home.empty')}</p>
{/if}
