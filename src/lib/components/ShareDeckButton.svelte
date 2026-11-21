<script lang="ts">
	import { Check, Link, Share2 } from '@lucide/svelte';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import { blueskyComposeUrl, buildDeckShareText } from '#lib/share/text.js';

	/** デッキを共有する（docs/SPEC.md 3.8）。追加の OAuth 権限は使わず、Bluesky の投稿画面を開くかリンクをコピーする */
	let { name, did, rkey, own }: { name: string; did: string; rkey: string; own: boolean } = $props();

	let open = $state(false);
	let copied = $state(false);
	let root: HTMLDivElement;

	const url = $derived(`${location.origin}/deck/${did}/${rkey}`);
	const composeUrl = $derived(blueskyComposeUrl(buildDeckShareText({ name, url, own }, i18n.locale)));

	async function copy() {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => {
				copied = false;
				open = false;
			}, 1200);
		} catch {
			// クリップボードが使えない環境では、URL を選択できるように表示する
			prompt(t('share.copyFallback'), url);
		}
	}
</script>

<svelte:window
	onclick={(e) => {
		if (open && !root.contains(e.target as Node)) open = false;
	}}
	onkeydown={(e) => {
		if (open && e.key === 'Escape') open = false;
	}}
/>

<div class="share" bind:this={root}>
	<button class="btn secondary" aria-haspopup="menu" aria-expanded={open} onclick={() => (open = !open)}>
		<Share2 size={16} aria-hidden="true" />{t('share.deck')}
	</button>
	{#if open}
		<div class="popover" role="menu">
			<a role="menuitem" href={composeUrl} target="_blank" rel="noopener" onclick={() => (open = false)}>
				<svg viewBox="0 0 600 530" width="16" height="16" aria-hidden="true"
					><path
						fill="currentColor"
						d="M136 44c69 52 143 157 170 213 27-56 101-161 170-213 50-37 130-66 130 26 0 18-10 154-16 176-21 76-99 95-168 83 121 20 151 89 85 157-126 129-181-32-195-73l-6-17-6 17c-14 41-69 202-195 73-66-68-36-137 85-157-69 12-147-7-168-83C16 224 6 88 6 70c0-92 80-63 130-26z"
					/></svg
				>
				{t('share.deckBluesky')}
			</a>
			<button role="menuitem" onclick={copy}>
				{#if copied}<Check size={16} aria-hidden="true" />{t('share.deckCopied')}{:else}<Link
						size={16}
						aria-hidden="true"
					/>{t('share.copyLink')}{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	.share {
		position: relative;
	}
	.popover {
		position: absolute;
		left: 0;
		top: calc(100% + 4px);
		z-index: 20;
		min-width: 200px;
		padding: 4px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		box-shadow: var(--shadow-card);
	}
	.popover a,
	.popover button {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 36px;
		padding: 0 12px;
		border: none;
		border-radius: 4px;
		background: none;
		color: var(--text);
		font-size: 0.875rem;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.popover a:hover,
	.popover button:hover {
		background: var(--surface-2);
	}
</style>
