<script lang="ts">
	import LocaleSelect from '#lib/components/LocaleSelect.svelte';
	import { t } from '#lib/i18n/index.svelte.js';
</script>

<h1>{t('nav.settings')}</h1>
<LocaleSelect />
