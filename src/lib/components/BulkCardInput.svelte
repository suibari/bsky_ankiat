<script lang="ts">
	import { FileUp } from '@lucide/svelte';
	import {
		decodeText,
		delimiterForFile,
		MAX_BULK_CARDS,
		parseBulk,
		type BulkCard,
		type Delimiter
	} from '#lib/decks/bulk.js';
	import { t } from '#lib/i18n/index.svelte.js';

	/**
	 * カードのまとめて入力（docs/SPEC.md 3.2）。
	 * onsubmit があれば「N 枚を追加」ボタンを出す。なければ cards を親が読む（新しいデッキの作成時）
	 */
	let {
		cards = $bindable<BulkCard[]>([]),
		onsubmit,
		id = 'bulk'
	}: { cards?: BulkCard[]; onsubmit?: (cards: BulkCard[]) => Promise<void>; id?: string } = $props();

	const PREVIEW_ROWS = 5;
	const MAX_ERRORS_SHOWN = 5;

	let text = $state('');
	let delimiter = $state<Delimiter>('\t');
	let fileName = $state<string>();
	let submitting = $state(false);
	let error = $state<string>();
	let fileInput: HTMLInputElement;

	const result = $derived(parseBulk(text, delimiter));
	$effect(() => {
		cards = result.cards;
	});
	// 入力を空にしたら、ファイルから読んだ区切り文字の指定もやめる
	$effect(() => {
		if (text === '') {
			delimiter = '\t';
			fileName = undefined;
		}
	});

	async function onfile(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		text = decodeText(await file.arrayBuffer());
		delimiter = delimiterForFile(file.name);
		fileName = file.name;
		fileInput.value = '';
	}

	async function submit() {
		if (!onsubmit || result.cards.length === 0) return;
		submitting = true;
		error = undefined;
		try {
			await onsubmit(result.cards);
			text = '';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			submitting = false;
		}
	}
</script>

<div class="bulk">
	<label for={id}>{t('bulk.label')}</label>
	<p class="muted small help">{t('bulk.help')}</p>
	<textarea
		{id}
		class="field mono"
		rows="8"
		bind:value={text}
		placeholder={t('bulk.placeholder')}
		spellcheck="false"
	></textarea>
	<div class="row">
		<input
			bind:this={fileInput}
			type="file"
			accept=".txt,.tsv,.csv,text/plain,text/csv,text/tab-separated-values"
			onchange={onfile}
			hidden
		/>
		<button class="btn secondary small" type="button" onclick={() => fileInput.click()}>
			<FileUp size={16} aria-hidden="true" />{t('bulk.file')}
		</button>
		{#if fileName}
			<span class="muted small">
				{delimiter === ',' ? t('bulk.loadedCsv', { name: fileName }) : t('bulk.loaded', { name: fileName })}
			</span>
		{/if}
	</div>

	{#if text.trim()}
		<div class="preview" role="status">
			<p class="summary">
				{t('bulk.count', { count: String(result.cards.length) })}
				{#if result.errors.length > 0}
					<span class="warn">{t('bulk.errorCount', { count: String(result.errors.length) })}</span>
				{/if}
			</p>
			{#if result.cards.length > 0}
				<table>
					<thead>
						<tr><th>{t('card.front')}</th><th>{t('card.back')}</th></tr>
					</thead>
					<tbody>
						{#each result.cards.slice(0, PREVIEW_ROWS) as c, i (i)}
							<tr><td>{c.front}</td><td>{c.back}</td></tr>
						{/each}
					</tbody>
				</table>
				{#if result.cards.length > PREVIEW_ROWS}
					<p class="muted small">{t('bulk.more', { count: String(result.cards.length - PREVIEW_ROWS) })}</p>
				{/if}
			{/if}
			{#if result.errors.length > 0}
				<ul class="errors small">
					{#each result.errors.slice(0, MAX_ERRORS_SHOWN) as e (e.line)}
						<li>
							{t(e.reason === 'empty' ? 'bulk.error.empty' : delimiter === ',' ? 'bulk.error.noComma' : 'bulk.error.noTab', {
								line: String(e.line)
							})}
						</li>
					{/each}
					{#if result.errors.length > MAX_ERRORS_SHOWN}
						<li>{t('bulk.moreErrors', { count: String(result.errors.length - MAX_ERRORS_SHOWN) })}</li>
					{/if}
				</ul>
			{/if}
			{#if result.overflow > 0}
				<p class="warn small">{t('bulk.overflow', { max: String(MAX_BULK_CARDS), count: String(result.overflow) })}</p>
			{/if}
		</div>
	{/if}

	{#if error}<p class="error" role="alert">{t('deck.saveError')}: {error}</p>{/if}
	{#if onsubmit}
		<div>
			<button class="btn" type="button" disabled={submitting || result.cards.length === 0} onclick={submit}>
				{submitting ? t('card.adding') : t('bulk.add', { count: String(result.cards.length) })}
			</button>
		</div>
	{/if}
</div>

<style>
	.bulk {
		display: grid;
		gap: 0.5rem;
	}
	label {
		font-weight: 500;
	}
	.help {
		margin: -0.25rem 0 0;
	}
	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.875rem;
		tab-size: 12;
		resize: vertical;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.preview {
		display: grid;
		gap: 8px;
		padding: 12px 16px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}
	.preview p {
		margin: 0;
	}
	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		font-weight: 500;
	}
	.warn {
		color: var(--danger);
		font-weight: 400;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		font-size: 0.875rem;
	}
	th,
	td {
		padding: 4px 8px 4px 0;
		border-bottom: 1px solid var(--border);
		text-align: left;
		vertical-align: top;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	th {
		font-weight: 500;
		color: var(--muted);
	}
	.errors {
		margin: 0;
		padding-left: 1.25em;
		color: var(--danger);
	}
</style>
