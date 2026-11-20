<script lang="ts">
	import { Star } from '@lucide/svelte';
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import { t } from '#lib/i18n/index.svelte.js';
	import { isLearning, loadLearning, toggleLearning } from '#lib/study/learning.svelte.js';

	/** 他人のデッキを学習リストに追加する（＝いいね）。count は作者を除く学習中の人数 */
	let {
		uri,
		count = $bindable<number | undefined>(),
		size = 'normal'
	}: { uri: string; count?: number; size?: 'normal' | 'small' } = $props();

	const me = currentUser();
	let busy = $state(false);
	let error = $state<string>();
	loadLearning(me.did);

	const on = $derived(isLearning(uri));

	async function toggle() {
		busy = true;
		error = undefined;
		try {
			const added = await toggleLearning(me.agent, me.did, uri);
			if (count !== undefined) count = Math.max(0, count + (added ? 1 : -1));
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

{#if on !== undefined}
	<button
		class="btn secondary learn"
		class:small={size === 'small'}
		class:on
		aria-pressed={on}
		disabled={busy}
		onclick={toggle}
		title={error}
	>
		<Star size={16} aria-hidden="true" fill={on ? 'currentColor' : 'none'} />
		{on ? t('learn.on') : t('learn.add')}
		{#if count !== undefined}<span class="count num">{count}</span>{/if}
	</button>
{/if}

<style>
	.learn.on {
		color: var(--accent-ink);
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.count {
		padding-left: 8px;
		margin-left: 2px;
		border-left: 1px solid var(--border-strong);
		color: var(--text-2);
		font-weight: 400;
	}
</style>
