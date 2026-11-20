<script lang="ts">
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.js';

	let {
		open = $bindable(false),
		title,
		children,
		footer
	}: { open?: boolean; title: string; children: Snippet; footer?: Snippet } = $props();

	let dialog: HTMLDialogElement;

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	onclick={(e) => {
		// 背景（ダイアログの外側）のクリックで閉じる
		if (e.target === dialog) open = false;
	}}
	aria-labelledby="modal-title"
>
	<div class="inner">
		<header>
			<h2 id="modal-title">{title}</h2>
			<button class="icon-btn" onclick={() => (open = false)} aria-label={t('help.close')}>
				<X size={20} aria-hidden="true" />
			</button>
		</header>
		<div class="body">{@render children()}</div>
		{#if footer}<footer>{@render footer()}</footer>{/if}
	</div>
</dialog>

<style>
	dialog {
		width: min(560px, calc(100vw - 32px));
		max-height: calc(100dvh - 32px);
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		color: var(--text);
	}
	dialog[open] {
		animation: enter 0.24s var(--ease);
	}
	@keyframes enter {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
	dialog::backdrop {
		background: rgb(8 14 28 / 55%);
	}
	.inner {
		display: flex;
		flex-direction: column;
		max-height: calc(100dvh - 34px);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 16px 16px 8px 24px;
	}
	h2 {
		margin: 0;
		font-size: 1.125rem;
	}
	.body {
		padding: 4px 24px 24px;
		overflow-y: auto;
	}
	footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 24px 20px;
		border-top: 1px solid var(--border);
	}
</style>
