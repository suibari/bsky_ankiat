<script lang="ts">
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import { anki, ankiState, connect, disconnect, syncAll } from '#lib/anki/state.svelte.js';
	import { importDeck, listLinkedDecks, unlinkDeck, type LinkedDeck } from '#lib/anki/sync.js';
	import { formatDate } from '#lib/i18n/format.js';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import type { MessageKey } from '#lib/i18n/messages.js';

	const me = currentUser();

	let apiKey = $state('');
	let linked = $state<LinkedDeck[]>();
	let ankiDecks = $state<{ name: string; id: number }[]>();
	let selected = $state<number[]>([]);
	let working = $state<string>();
	let error = $state<string>();
	let unlinking = $state<string>();

	const linkedIds = $derived(new Set(linked?.map((l) => l.deck.record.source?.ankiDeckId)));
	const importable = $derived(ankiDecks?.filter((d) => !linkedIds.has(d.id)) ?? []);

	async function refresh() {
		linked = await listLinkedDecks(me.did);
		if (ankiState.status === 'connected') {
			const names = await anki.deckNamesAndIds();
			ankiDecks = Object.entries(names)
				.map(([name, id]) => ({ name, id }))
				.sort((a, b) => a.name.localeCompare(b.name));
		}
	}

	$effect(() => {
		if (ankiState.status === 'connected') void refresh().catch((e) => (error = e.message));
	});
	$effect(() => {
		// 同期が終わったら一覧を更新する
		if (ankiState.lastSyncAt) void listLinkedDecks(me.did).then((l) => (linked = l));
	});
	listLinkedDecks(me.did).then((l) => (linked = l));

	async function doConnect(e: SubmitEvent) {
		e.preventDefault();
		await connect(apiKey.trim() || undefined);
	}

	async function doImport() {
		error = undefined;
		try {
			for (const id of selected) {
				const deck = ankiDecks!.find((d) => d.id === id)!;
				await importDeck(me.agent, me.did, anki, deck.name, deck.id, (step) => {
					working = `${t('anki.importing', { deck: deck.name })} ${t(`anki.progress.${step}` as MessageKey)}`;
				});
			}
			selected = [];
			await refresh();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			working = undefined;
		}
	}

	async function doUnlink(l: LinkedDeck, keep: boolean) {
		error = undefined;
		working = t('anki.syncing');
		try {
			await unlinkDeck(me.agent, me.did, l.deck, keep);
			unlinking = undefined;
			await refresh();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			working = undefined;
		}
	}

	const statusMessage: Partial<Record<typeof ankiState.status, MessageKey>> = {
		unreachable: 'anki.status.unreachable',
		denied: 'anki.status.denied',
		needKey: 'anki.status.needKey',
		badKey: 'anki.status.badKey'
	};
</script>

<h1>{t('nav.anki')}</h1>

{#if ankiState.status === 'unsupported'}
	<p class="panel">{t('anki.unsupported')}</p>
{:else if ankiState.status !== 'connected'}
	<section class="panel">
		<h2>{t('anki.setupTitle')}</h2>
		<ol>
			<li>{t('anki.step1')}</li>
			<li>{t('anki.step2')}</li>
			<li>{t('anki.step3')}</li>
		</ol>
		<form onsubmit={doConnect}>
			<label>
				{t('anki.apiKey')}
				<input class="field" type="password" bind:value={apiKey} autocomplete="off" />
			</label>
			<button class="btn" type="submit" disabled={ankiState.status === 'connecting'}>
				{ankiState.status === 'connecting' ? t('anki.connecting') : t('anki.connect')}
			</button>
		</form>
		{#if statusMessage[ankiState.status]}
			<p class="error" role="alert">{t(statusMessage[ankiState.status]!)}</p>
		{/if}
	</section>
{:else}
	<section class="status">
		<span class="ok">● {t('anki.connected')}</span>
		{#if ankiState.lastSyncAt}
			<span class="muted">{t('anki.lastSync', { date: formatDate(ankiState.lastSyncAt, i18n.locale) })}</span>
		{/if}
		<button class="btn secondary" disabled={ankiState.syncing || !!working} onclick={() => syncAll()}>
			{ankiState.syncing ? t('anki.syncing') : t('anki.syncNow')}
		</button>
	</section>
{/if}

{#if working}<p class="muted" role="status">{working}</p>{/if}
{#if error}<p class="error" role="alert">{t('anki.error', { message: error })}</p>{/if}

<section>
	<h2>{t('anki.linkedTitle')}</h2>
	{#if !linked}
		<p class="muted">{t('common.loading')}</p>
	{:else if linked.length === 0}
		<p class="muted">{t('anki.noLinked')}</p>
	{:else}
		<ul>
			{#each linked as l (l.deck.uri)}
				{@const result = ankiState.lastResult?.find((r) => r.deck === l.deck.record.name)}
				<li class="panel">
					<div class="row">
						<a href="/deck/{l.deck.did}/{l.deck.rkey}" class="name">{l.deck.record.name}</a>
						<span class="muted small">{l.deck.record.source?.ankiDeckName}</span>
						<span class="muted small">{t('deck.cards', { count: String(l.deck.record.cardCount) })}</span>
					</div>
					{#if l.sync}
						<p class="muted small">{t('anki.lastSync', { date: formatDate(l.sync.lastSyncedAt, i18n.locale) })}</p>
					{/if}
					{#if result?.result}
						<p class="muted small">
							{t('anki.syncResult', {
								upserted: String(result.result.upserted),
								deleted: String(result.result.deleted),
								imported: String(result.result.imported),
								pushed: String(result.result.pushed)
							})}
						</p>
					{:else if result?.error}
						<p class="error small">{t('anki.error', { message: result.error })}</p>
					{/if}
					{#if unlinking === l.deck.uri}
						<div class="unlink">
							<p>{t('anki.unlinkQuestion')}</p>
							<button class="btn secondary" disabled={!!working} onclick={() => doUnlink(l, true)}>
								{t('anki.unlinkKeep')}
							</button>
							<button class="btn danger" disabled={!!working} onclick={() => doUnlink(l, false)}>
								{t('anki.unlinkDelete')}
							</button>
							<button class="btn secondary" onclick={() => (unlinking = undefined)}>{t('deck.cancel')}</button>
						</div>
					{:else}
						<button class="btn secondary small" onclick={() => (unlinking = l.deck.uri)}>{t('anki.unlink')}</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if ankiState.status === 'connected' && ankiDecks}
	<section>
		<h2>{t('anki.importTitle')}</h2>
		<p class="muted small">{t('anki.importNote')}</p>
		{#if importable.length === 0}
			<p class="muted">{t('anki.noImportable')}</p>
		{:else}
			<ul class="choices">
				{#each importable as d (d.id)}
					<li>
						<label><input type="checkbox" value={d.id} bind:group={selected} /> {d.name}</label>
					</li>
				{/each}
			</ul>
			<button class="btn" disabled={selected.length === 0 || !!working || ankiState.syncing} onclick={doImport}>
				{t('anki.import')}
			</button>
		{/if}
	</section>

	<section>
		<button class="btn secondary danger-text small" onclick={disconnect}>{t('anki.disconnect')}</button>
	</section>
{/if}

<style>
	section {
		margin: 1.5rem 0;
	}
	h2 {
		font-size: 1rem;
		margin-top: 0;
	}
	ol {
		padding-left: 1.25rem;
	}
	form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: end;
	}
	label {
		display: grid;
		gap: 0.25rem;
	}
	.status {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: center;
	}
	.ok {
		color: var(--accent);
		font-weight: 600;
	}
	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		align-items: baseline;
	}
	.name {
		font-weight: 600;
	}
	.small {
		font-size: 0.875rem;
	}
	li p {
		margin: 0.25rem 0;
	}
	.unlink {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.unlink p {
		width: 100%;
	}
	.choices {
		gap: 0.25rem;
		margin-bottom: 1rem;
	}
	.choices label {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
</style>
