import confetti from "https://esm.sh/canvas-confetti@1.6.0"

/** @typedef {{ value: number }} Model */

/** @type {import("npm:@anywidget/types").Render<Model>} */
export function render({ model, el }) {
	let btn = document.createElement("button");
	btn.innerHTML = `count is ${model.get("value")}`;
	btn.addEventListener("click", () => {
		model.set("value", model.get("value") + 1);
		model.save_changes();
	});
	model.on("change:value", () => {
		confetti();
		btn.innerHTML = `count is ${model.get("value")}`;
	});
	el.appendChild(btn);
}
