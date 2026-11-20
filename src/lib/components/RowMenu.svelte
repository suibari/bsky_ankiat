<script lang="ts">
	import { Ellipsis } from '@lucide/svelte';

	export interface MenuItem {
		label: string;
		/** 危険な操作。1 回目のクリックで confirmLabel を表示し、2 回目で実行する */
		danger?: boolean;
		confirmLabel?: string;
		onselect: () => void;
	}

	let { items, label }: { items: MenuItem[]; label: string } = $props();

	let open = $state(false);
	let confirming = $state<number>();
	let root: HTMLDivElement;

	function close() {
		open = false;
		confirming = undefined;
	}

	function select(item: MenuItem, i: number) {
		if (item.danger && confirming !== i) {
			confirming = i;
			return;
		}
		close();
		item.onselect();
	}
</script>

<svelte:window
	onclick={(e) => {
		if (open && !root.contains(e.target as Node)) close();
	}}
	onkeydown={(e) => {
		if (open && e.key === 'Escape') close();
	}}
/>

<div class="menu" bind:this={root}>
	<button
		class="icon-btn"
		aria-label={label}
		aria-haspopup="menu"
		aria-expanded={open}
		onclick={() => (open ? close() : (open = true))}
	>
		<Ellipsis size={18} aria-hidden="true" />
	</button>
	{#if open}
		<div class="popover" role="menu">
			{#each items as item, i (item.label)}
				<button role="menuitem" class:danger={item.danger} onclick={() => select(item, i)}>
					{confirming === i ? (item.confirmLabel ?? item.label) : item.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.menu {
		position: relative;
	}
	.popover {
		position: absolute;
		right: 0;
		top: calc(100% + 4px);
		z-index: 20;
		min-width: 200px;
		padding: 4px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		box-shadow: var(--shadow-card);
		animation: rise 0.18s var(--ease);
	}
	.popover button {
		display: block;
		width: 100%;
		height: 32px;
		padding: 0 12px;
		border: none;
		border-radius: 4px;
		background: none;
		text-align: left;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.popover button:hover {
		background: var(--surface-2);
	}
	.danger {
		color: var(--danger);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}
</style>
