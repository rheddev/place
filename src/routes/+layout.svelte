<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<main>
	{@render children?.()}
</main>

<style>
	/* Layout-level styles that apply to all pages */
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		background-color: #fafafa;
	}

	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 32px 16px;
		min-height: 100vh;
	}

	/* Global utility classes */
	:global(.container) {
		max-width: 800px;
		margin: 0 auto;
	}

	:global(.text-center) {
		text-align: center;
	}
</style>
