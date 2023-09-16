# @anywidget/vite

> A [Vite](https://vitejs.dev/) plugin for
> [**anywidget**](https://anywidget.dev)

## Installation

```sh
npm install -D vite @anywidget/vite
```

## Usage

```javascript
// vite.config.js
import { defineConfig } from "vite";
import anywidget from "@anywidget/vite";

export default defineConfig({
	plugins: [anywidget()],
});
```

Read the [docs](https://anywidget.dev/en/bundling/#vite) to learn more about
configuring Vite with **anywidget** for your project.

## License

MIT
