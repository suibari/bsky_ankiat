<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';
	import { page } from '$app/state';
	import { profileUrl, resolveActor, type Profile } from '#lib/atproto/profile.js';
	import DailyChart from '#lib/components/DailyChart.svelte';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import type { MessageKey } from '#lib/i18n/messages.js';
	import { loadProfileData, type ProfileData } from '#lib/study/profileData.js';

	let profile = $state<Profile | null>();
	let data = $state<ProfileData>();
	let error = $state<string>();

	$effect(() => {
		const actor = (page.params as { actor: string }).actor;
		profile = undefined;
		data = undefined;
		error = undefined;
		resolveActor(actor).then(async (p) => {
			profile = p ?? null;
			if (!p) return;
			try {
				data = await loadProfileData(p.did);
			} catch (e) {
				error = e instanceof Error ? e.message : String(e);
			}
		});
	});

	const nf = $derived(new Intl.NumberFormat(i18n.locale));
	const tiles = $derived.by(() => {
		if (!data) return [];
		const s = data.stats;
		const days = (n: number) => t('profile.daysUnit', { count: nf.format(n) });
		return [
			{ key: 'profile.totalReviews', value: nf.format(s.totalReviews) },
			{ key: 'profile.studyDays', value: days(s.studyDays) },
			{ key: 'profile.currentStreak', value: days(s.currentStreak) },
			{ key: 'profile.longestStreak', value: days(s.longestStreak) },
			{ key: 'profile.uniqueCards', value: nf.format(s.uniqueCards) },
			{
				key: 'profile.retention',
				value: s.retention === null ? '—' : `${Math.round(s.retention * 100)}%`,
				note: 'profile.retentionNote'
			}
		] as { key: MessageKey; value: string; note?: MessageKey }[];
	});
	const maxDeckReviews = $derived(Math.max(1, ...(data?.studiedDecks.map((d) => d.reviews) ?? [1])));
</script>

{#if profile === undefined}
	<p class="muted">{t('common.loading')}</p>
{:else if profile === null}
	<p>{t('profile.notFound')}</p>
{:else}
	<header class="who">
		{#if profile.avatar}
			<img src={profile.avatar} alt="" width="64" height="64" />
		{:else}
			<span class="avatar-fallback" aria-hidden="true">{(profile.displayName || profile.handle).slice(0, 1)}</span>
		{/if}
		<div class="names">
			<h1>{profile.displayName || profile.handle}</h1>
			<span class="muted">@{profile.handle}</span>
		</div>
		<a class="btn secondary small" href={profileUrl(profile.handle)} target="_blank" rel="noopener noreferrer">
			{t('profile.openBluesky')}<ExternalLink size={14} aria-hidden="true" />
		</a>
	</header>

	{#if error}
		<p class="error">{t('deck.loadError')}: {error}</p>
	{:else if !data}
		<p class="muted">{t('common.loading')}</p>
	{:else}
		{#if data.stats.totalReviews === 0}
			<p class="panel muted">{t('profile.empty')}</p>
		{:else}
			<dl class="tiles">
				{#each tiles as tile (tile.key)}
					<div class="panel tile" title={tile.note ? t(tile.note) : undefined}>
						<dt>{t(tile.key)}</dt>
						<dd class="num">{tile.value}</dd>
					</div>
				{/each}
			</dl>

			<section class="panel">
				<h2>{t('profile.dailyTitle')}</h2>
				<DailyChart daily={data.stats.daily} />
			</section>
		{/if}

		<div class="columns">
			<section>
				<h2>{t('profile.studiedDecks')}</h2>
				{#if data.studiedDecks.length === 0}
					<p class="muted small">{t('profile.noDecks')}</p>
				{:else}
					<ol class="panel ranked">
						{#each data.studiedDecks as d (d.uri)}
							<li>
								<div class="row">
									{#if d.name}
										<a href="/deck/{d.did}/{d.rkey}">{d.name}</a>
									{:else}
										<span class="muted">{t('profile.hiddenDeck')}</span>
									{/if}
									<span class="num muted">{nf.format(d.reviews)}</span>
								</div>
								<span class="bar"><span style:width="{(d.reviews / maxDeckReviews) * 100}%"></span></span>
							</li>
						{/each}
					</ol>
				{/if}
			</section>
			<section>
				<h2>{t('profile.ownDecks')}</h2>
				{#if data.ownDecks.length === 0}
					<p class="muted small">{t('profile.noDecks')}</p>
				{:else}
					<ul class="panel decks">
						{#each data.ownDecks as d (d.uri)}
							<li>
								<a href="/deck/{d.did}/{d.rkey}">{d.record.name}</a>
								<span class="muted small">{t('deck.cards', { count: String(d.record.cardCount) })}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	{/if}
{/if}

<style>
	.who {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 16px;
		margin-bottom: 32px;
	}
	.who img,
	.avatar-fallback {
		width: 64px;
		height: 64px;
		border-radius: 999px;
		object-fit: cover;
		background: var(--surface-2);
	}
	.avatar-fallback {
		display: grid;
		place-items: center;
		font-size: 1.5rem;
		color: var(--muted);
	}
	.names {
		display: grid;
		flex: 1;
		min-width: 12rem;
	}
	h1 {
		font-size: 1.5rem;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		margin: 0 0 12px;
	}
	.tile {
		padding: 16px 20px;
	}
	dt {
		font-size: 0.8125rem;
		color: var(--muted);
	}
	dd {
		margin: 4px 0 0;
		font-size: 1.75rem;
		font-weight: 500;
		line-height: 1.2;
	}
	section {
		margin-bottom: 24px;
	}
	.columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 24px;
		margin-top: 32px;
	}
	.columns h2 {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--muted);
		margin-bottom: 8px;
	}
	.ranked,
	.decks {
		display: grid;
		gap: 12px;
		margin: 0;
		padding: 16px 20px;
		list-style: none;
	}
	.row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}
	.row a,
	.decks a {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text);
		text-decoration: none;
	}
	.row a:hover,
	.decks a:hover {
		color: var(--accent-ink);
		text-decoration: underline;
	}
	.bar {
		display: block;
		height: 4px;
		margin-top: 4px;
		border-radius: 2px;
		background: var(--surface-2);
	}
	.bar span {
		display: block;
		height: 100%;
		border-radius: 2px;
		background: var(--chart-bar);
	}
	.decks li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}
	@media (max-width: 640px) {
		.tiles {
			grid-template-columns: repeat(2, 1fr);
		}
		.columns {
			grid-template-columns: 1fr;
		}
		dd {
			font-size: 1.5rem;
		}
	}
</style>
