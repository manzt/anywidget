<script>
	import { setContext } from "svelte";
	import { MODEL_CONTEXT_NAME, STORES_CONTEXT_NAME } from "./constants.js";

	export let model;
	export let Component;

	setContext(MODEL_CONTEXT_NAME, model);
	setContext(STORES_CONTEXT_NAME, {});
</script>

<svelte:component this={Component} />
