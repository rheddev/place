<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { onMount } from 'svelte';

	let { children } = $props();
	
	onMount(() => {
		// Apply initial theme based on system preference
		updateTheme();
		
		// Listen for changes in system color scheme preference
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		mediaQuery.addEventListener('change', updateTheme);
		
		// Cleanup listener on component destroy
		return () => {
			mediaQuery.removeEventListener('change', updateTheme);
		};
	});
	
	function updateTheme() {
		const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		document.documentElement.classList.toggle('dark', isDark);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}

<style>
	/* Global layout styles that respect CSS variables */
	:global(html, body) {
		margin: 0;
		padding: 0;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		background-color: var(--bg-secondary);
		color: var(--text-primary);
		transition: background-color 0.2s ease, color 0.2s ease;
	}
</style>
