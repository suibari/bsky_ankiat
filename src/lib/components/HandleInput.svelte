<script lang="ts">
	import { searchActors, type Profile } from '#lib/atproto/profile.js';
	import { t } from '#lib/i18n/index.svelte.js';

	let {
		value = $bindable(''),
		id,
		placeholder,
		disabled = false
	}: { value?: string; id: string; placeholder?: string; disabled?: boolean } = $props();

	const DEBOUNCE_MS = 200;
	const MIN_CHARS = 2;

	let suggestions = $state<Profile[]>([]);
	let open = $state(false);
	let active = $state(-1);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | undefined;

	const listId = $derived(`${id}-listbox`);

	function query(raw: string) {
		clearTimeout(timer);
		controller?.abort();
		const q = raw.trim().replace(/^@/, '');
		// PDS の URL を入力しているときは候補を出さない
		if (q.length < MIN_CHARS || /^https?:/i.test(q)) {
			suggestions = [];
			open = false;
			return;
		}
		timer = setTimeout(async () => {
			controller = new AbortController();
			try {
				suggestions = await searchActors(q, controller.signal);
				open = suggestions.length > 0;
				active = -1;
			} catch {
				// 中断・通信失敗時は候補を出さないだけ
			}
		}, DEBOUNCE_MS);
	}

	function choose(p: Profile) {
		value = p.handle;
		open = false;
		suggestions = [];
		clearTimeout(timer);
		controller?.abort();
	}

	function onkeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = (active + 1) % suggestions.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = active <= 0 ? suggestions.length - 1 : active - 1;
		} else if (e.key === 'Enter' && active >= 0) {
			// 候補を選んでいるときは、フォームを送信せずに確定する
			e.preventDefault();
			choose(suggestions[active]);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			open = false;
		}
	}
</script>

<div class="combo">
	<input
		{id}
		class="field"
		bind:value
		{placeholder}
		{disabled}
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={open}
		aria-controls={listId}
		aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
		autocomplete="username"
		autocapitalize="off"
		spellcheck="false"
		required
		oninput={(e) => query(e.currentTarget.value)}
		{onkeydown}
		onblur={() => (open = false)}
		onfocus={() => (open = suggestions.length > 0)}
	/>
	{#if open}
		<ul id={listId} class="list" role="listbox" aria-label={t('login.suggestions')}>
			{#each suggestions as p, i (p.did)}
				<li
					id="{listId}-{i}"
					role="option"
					aria-selected={i === active}
					class:active={i === active}
					onpointerdown={(e) => {
						// 入力欄のフォーカスを外さずに選ぶ
						e.preventDefault();
						choose(p);
					}}
					onpointerenter={() => (active = i)}
				>
					{#if p.avatar}
						<img src={p.avatar} alt="" width="28" height="28" loading="lazy" />
					{:else}
						<span class="fallback" aria-hidden="true">{(p.displayName || p.handle).slice(0, 1)}</span>
					{/if}
					<span class="names">
						{#if p.displayName}<span class="name">{p.displayName}</span>{/if}
						<span class="handle">@{p.handle}</span>
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.combo {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	.list {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: 20;
		margin: 0;
		padding: 4px;
		list-style: none;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		box-shadow: var(--shadow-card);
	}
	li {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 44px;
		padding: 0 8px;
		border-radius: 4px;
		cursor: pointer;
	}
	li.active {
		background: var(--surface-2);
	}
	img,
	.fallback {
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: 999px;
		object-fit: cover;
		background: var(--surface-2);
	}
	.fallback {
		display: grid;
		place-items: center;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.names {
		display: grid;
		min-width: 0;
		line-height: 1.3;
	}
	.name,
	.handle {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.name {
		font-size: 0.875rem;
		font-weight: 500;
	}
	.handle {
		font-size: 0.8125rem;
		color: var(--muted);
	}
</style>
