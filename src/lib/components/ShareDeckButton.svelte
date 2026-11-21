<script lang="ts">
	import { Share2 } from '@lucide/svelte';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import { buildDeckShareText, deckImagePath } from '#lib/share/text.js';
	import ShareDialog from './ShareDialog.svelte';

	/**
	 * デッキのシェア（docs/SPEC.md 3.8）。今日の学習のシェアと同じモーダルで、
	 * デッキの OGP 画像をプレビューする。Bluesky ではリンクから OGP のカードが付く
	 */
	let {
		name,
		did,
		rkey,
		updatedAt,
		own
	}: { name: string; did: string; rkey: string; updatedAt: string; own: boolean } = $props();

	let open = $state(false);
	let message = $state<string>();
	let error = $state<string>();

	const url = $derived(`${location.origin}/deck/${did}/${rkey}`);
	const text = $derived(buildDeckShareText({ name, url, own }, i18n.locale));
</script>

<button
	class="btn secondary"
	onclick={() => {
		message = error = undefined;
		open = true;
	}}
>
	<Share2 size={16} aria-hidden="true" />{t('share.open')}
</button>

<ShareDialog
	bind:open
	bind:message
	bind:error
	title={t('share.deckTitle')}
	imageUrl={open ? deckImagePath(did, rkey, updatedAt) : undefined}
	fallbackImageUrl="/og.png"
	imageAlt={t('share.deckAlt', { name })}
	{text}
	copyValue={url}
	copyLabel={t('share.copyLink')}
/>
