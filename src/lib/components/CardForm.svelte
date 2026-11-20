<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.js';

	let {
		initial,
		submitLabel,
		submittingLabel,
		onsubmit,
		oncancel
	}: {
		initial?: { front: string; back: string };
		submitLabel: string;
		submittingLabel: string;
		onsubmit: (card: { front: string; back: string }) => Promise<void>;
		oncancel?: () => void;
	} = $props();

	// フォームの初期値としてのみ使う
	const init = untrack(() => initial);
	let front = $state(init?.front ?? '');
	let back = $state(init?.back ?? '');
	let submitting = $state(false);
	let error = $state<string>();
	let frontEl: HTMLTextAreaElement;

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		submitting = true;
		error = undefined;
		try {
			await onsubmit({ front, back });
			if (!init) {
				front = '';
				back = '';
				frontEl.focus();
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			submitting = false;
		}
	}
</script>

<form onsubmit={submit}>
	<div class="sides">
		<label>
			{t('card.front')}
			<textarea class="field" bind:this={frontEl} bind:value={front} rows="3" required></textarea>
		</label>
		<label>
			{t('card.back')}
			<textarea class="field" bind:value={back} rows="3" required></textarea>
		</label>
	</div>
	{#if error}<p class="error" role="alert">{t('deck.saveError')}: {error}</p>{/if}
	<div class="actions">
		<button class="btn" type="submit" disabled={submitting || !front.trim() || !back.trim()}>
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
	.sides {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.75rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
	}
	textarea {
		resize: vertical;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
	}
</style>
