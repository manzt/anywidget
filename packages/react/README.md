# @anywidget/react

> React utilities for [**anywidget**](https://anywidget.dev)

## Installation

```sh
npm install @anywidget/react
```

## Usage

```javascript
import * as React from "react";
import { createRender, useModelState } from "@anywidget/react";

function Counter() {
	let [value, setValue] = useModelState("value");
	return <button onClick={() => setValue(value + 1)}>count is {count}</button>;
}

export let render = createRender(Counter);
```

## License

MIT
