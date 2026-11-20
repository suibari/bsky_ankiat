<script lang="ts">
	import { deleteAllAnkiatData } from '#lib/account/deleteData.js';
	import { disconnect } from '#lib/anki/state.svelte.js';
	import { currentUser, signOut } from '#lib/atproto/auth.svelte.js';
	import { t } from '#lib/i18n/index.svelte.js';
	import Modal from './Modal.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const me = currentUser();
	let typed = $state('');
	let running = $state(false);
	let progress = $state<string>();
	let error = $state<string>();

	const confirmed = $derived(typed.trim().replace(/^@/, '').toLowerCase() === me.handle.toLowerCase());

	async function run(e: SubmitEvent) {
		e.preventDefault();
		if (!confirmed) return;
		running = true;
		error = undefined;
		try {
			await disconnect();
			await deleteAllAnkiatData(me.agent, me.did, (collection, count) => {
				progress = t('deleteData.progress', { collection: collection.split('.').pop()!, count: String(count) });
			});
			await signOut();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			running = false;
		}
	}
</script>

<Modal bind:open title={t('deleteData.title')}>
	<form id="delete-data" onsubmit={run}>
		<p>{t('deleteData.body1')}</p>
		<p>{t('deleteData.body2')}</p>
		<p class="warn">{t('deleteData.body3')}</p>
		<label>
			{t('deleteData.confirmLabel', { handle: me.handle })}
			<input class="field" bind:value={typed} autocomplete="off" autocapitalize="off" spellcheck="false" disabled={running} />
		</label>
		{#if progress && running}<p class="muted small" role="status">{progress}</p>{/if}
		{#if error}<p class="error" role="alert">{t('deck.saveError')}: {error}</p>{/if}
	</form>
	{#snippet footer()}
		<button class="btn secondary" onclick={() => (open = false)} disabled={running}>{t('deck.cancel')}</button>
		<button class="btn danger" type="submit" form="delete-data" disabled={!confirmed || running}>
			{t('deleteData.submit')}
		</button>
	{/snippet}
</Modal>

<style>
	p {
		margin: 0 0 12px;
		font-size: 0.9375rem;
		color: var(--text-2);
	}
	.warn {
		color: var(--text);
	}
	label {
		display: grid;
		gap: 8px;
		margin-top: 16px;
		font-size: 0.875rem;
		color: var(--text-2);
	}
	input {
		color: var(--text);
	}
</style>
