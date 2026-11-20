<script lang="ts">
	import { i18n, t } from '#lib/i18n/index.svelte.js';

	/** 直近 30 日の日ごとの回答数（1 系列。今日の棒だけアクセント色） */
	let { daily }: { daily: { date: Date; count: number }[] } = $props();

	const H = 160;
	const M = { top: 8, right: 0, bottom: 24, left: 32 };
	let width = $state(600);
	let hover = $state<number>();

	const innerW = $derived(Math.max(0, width - M.left - M.right));
	const innerH = H - M.top - M.bottom;
	const slot = $derived(innerW / Math.max(1, daily.length));
	const barW = $derived(Math.max(2, slot - 2)); // 棒同士に 2px の隙間

	/** 目盛りの上限を 1・2・5 × 10^n に丸める */
	const yMax = $derived.by(() => {
		const max = Math.max(1, ...daily.map((d) => d.count));
		const p = 10 ** Math.floor(Math.log10(max));
		return ([1, 2, 5, 10].map((m) => m * p).find((v) => v >= max) ?? 10 * p);
	});

	const y = (v: number) => M.top + innerH - (v / yMax) * innerH;
	const x = (i: number) => M.left + i * slot + (slot - barW) / 2;

	/** 上端だけ 4px の角丸、底辺は基線に接する */
	function barPath(i: number, v: number): string {
		const x0 = x(i);
		const y0 = y(v);
		const h = M.top + innerH - y0;
		const r = Math.min(4, barW / 2, h);
		return `M${x0},${y0 + h}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + barW - r}Q${x0 + barW},${y0} ${x0 + barW},${y0 + r}V${y0 + h}Z`;
	}

	const fmtDay = (d: Date) => new Intl.DateTimeFormat(i18n.locale, { month: 'numeric', day: 'numeric' }).format(d);
	const last = $derived(daily.length - 1);
</script>

<div class="chart" bind:clientWidth={width}>
	<svg {width} height={H} role="img" aria-label={t('profile.dailyTitle')}>
		{#each [0, yMax / 2, yMax] as v (v)}
			<line class="grid" x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} />
			<text class="axis" x={M.left - 8} y={y(v)} text-anchor="end" dominant-baseline="middle">{v}</text>
		{/each}
		{#each daily as d, i (i)}
			{#if d.count > 0}
				<path d={barPath(i, d.count)} class:today={i === last} class:dim={hover !== undefined && hover !== i} />
			{/if}
		{/each}
		<text class="axis" x={x(0)} y={H - 6}>{fmtDay(daily[0].date)}</text>
		<text class="axis" x={x(Math.floor(last / 2)) + barW / 2} y={H - 6} text-anchor="middle">
			{fmtDay(daily[Math.floor(last / 2)].date)}
		</text>
		<text class="axis today-label" x={x(last) + barW} y={H - 6} text-anchor="end">{t('profile.today')}</text>
		<!-- ホバー用の当たり判定（棒より広い） -->
		{#each daily as _, i (i)}
			<rect
				class="hit"
				x={M.left + i * slot}
				y={M.top}
				width={slot}
				height={innerH}
				role="presentation"
				onpointerenter={() => (hover = i)}
				onpointerleave={() => (hover = undefined)}
			/>
		{/each}
	</svg>
	{#if hover !== undefined}
		{@const d = daily[hover]}
		<div
			class="tip"
			style:left="{Math.min(Math.max(x(hover) + barW / 2, 60), width - 60)}px"
			style:top="{y(d.count) - 8}px"
		>
			<span class="muted">{fmtDay(d.date)}</span>
			<strong class="num">{t('profile.reviewsCount', { count: String(d.count) })}</strong>
		</div>
	{/if}
	<details>
		<summary>{t('profile.showTable')}</summary>
		<table>
			<thead><tr><th>{t('profile.date')}</th><th>{t('profile.reviews')}</th></tr></thead>
			<tbody>
				{#each daily as d, i (i)}
					<tr><td>{fmtDay(d.date)}</td><td class="num">{d.count}</td></tr>
				{/each}
			</tbody>
		</table>
	</details>
</div>

<style>
	.chart {
		position: relative;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--chart-grid);
		stroke-width: 1;
	}
	.axis {
		fill: var(--muted);
		font-family: var(--mono);
		font-size: 11px;
	}
	.today-label {
		fill: var(--text-2);
	}
	path {
		fill: var(--chart-bar);
		transition: opacity 0.15s var(--ease);
	}
	path.today {
		fill: var(--chart-today);
	}
	path.dim {
		opacity: 0.45;
	}
	.hit {
		fill: transparent;
	}
	.tip {
		position: absolute;
		transform: translate(-50%, -100%);
		display: grid;
		gap: 2px;
		padding: 6px 10px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		box-shadow: var(--shadow-card);
		font-size: 0.8125rem;
		white-space: nowrap;
		pointer-events: none;
	}
	strong {
		font-weight: 500;
	}
	details {
		margin-top: 8px;
		font-size: 0.8125rem;
	}
	summary {
		color: var(--muted);
		cursor: pointer;
	}
	table {
		margin-top: 8px;
		border-collapse: collapse;
		font-size: 0.8125rem;
	}
	th,
	td {
		padding: 2px 16px 2px 0;
		text-align: left;
		font-weight: 400;
	}
	th {
		color: var(--muted);
	}
</style>
