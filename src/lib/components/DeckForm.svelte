<script lang="ts">
	import { untrack } from 'svelte';
	import type { DeckMeta } from '#lib/decks/service.js';
	import { t } from '#lib/i18n/index.svelte.js';

	let {
		initial,
		submitLabel,
		submittingLabel,
		onsubmit,
		oncancel
	}: {
		initial?: DeckMeta;
		submitLabel: string;
		submittingLabel: string;
		onsubmit: (meta: DeckMeta) => Promise<void>;
		oncancel?: () => void;
	} = $props();

	// フォームの初期値としてのみ使う
	const init = untrack(() => initial);
	let name = $state(init?.name ?? '');
	let description = $state(init?.description ?? '');
	let tags = $state((init?.tags ?? []).join(', '));
	let listed = $state(init?.listed ?? true);
	let submitting = $state(false);
	let error = $state<string>();

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		submitting = true;
		error = undefined;
		try {
			await onsubmit({ name, description, tags: tags.split(/[,、]/), listed });
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			submitting = false;
		}
	}
</script>

<form onsubmit={submit}>
	<label>
		{t('deck.name')}
		<input class="field" bind:value={name} required maxlength="200" />
	</label>
	<label>
		{t('deck.description')}
		<textarea class="field" bind:value={description} rows="3" maxlength="3000"></textarea>
	</label>
	<label>
		{t('deck.tags')}
		<input class="field" bind:value={tags} />
	</label>
	<label class="check">
		<input type="checkbox" bind:checked={listed} />
		{t('deck.listed')}
	</label>
	<p class="muted small">{t('deck.listedNote')}</p>
	{#if error}<p class="error" role="alert">{t('deck.saveError')}: {error}</p>{/if}
	<div class="actions">
		<button class="btn" type="submit" disabled={submitting || !name.trim()}>
			{submitting ? submittingLabel : submitLabel}
		</button>
		{#if oncancel}
			<button class="btn secondary" type="button" onclick={oncancel}>{t('deck.cancel')}</button>
		{/if}
	</div>
</form>

<style>
	form {
		display: grid;
		gap: 0.75rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
	}
	.check {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.small {
		font-size: 0.875rem;
		margin: -0.5rem 0 0;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
	}
</style>
