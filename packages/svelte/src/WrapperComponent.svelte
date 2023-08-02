<script>
	import { setContext } from "svelte";
	import { MODEL_SYMBOL, STORES_SYMBOL } from "./constants.js";

	export let model;
	export let Component;

	setContext(MODEL_SYMBOL, model);
	setContext(STORES_SYMBOL, {});
</script>

<svelte:component this={Component} />
