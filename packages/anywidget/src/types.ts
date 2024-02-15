export type JSONValue =
	| string
	| number
	| boolean
	| { [x: string]: JSONValue }
	| Array<JSONValue>;

export interface Comm {
	/** Comm id */
	comm_id: string;
	/** Target name */
	target_name: string;
	/**
	 * Sends a message to the sibling comm in the backend
	 * @param  data
	 * @param  callbacks
	 * @param  metadata
	 * @param  buffers
	 * @return message id
	 */
	send: (
		data: JSONValue,
		callbacks?: unknown,
		metadata?: Record<string, unknown>,
		buffers?: ArrayBuffer[],
	) => string;
	/**
	 * Closes the sibling comm in the backend
	 * @param  data
	 * @param  callbacks
	 * @param  metadata
	 * @param  buffers
	 * @return msg id
	 */
	close(
		data?: JSONValue,
		callbacks?: unknown,
		metadata?: Record<string, unknown>,
		buffers?: ArrayBuffer[] | ArrayBufferView[],
	): string;
	/**
	 * Register a message handler
	 * @param  callback, which is given a message
	 */
	on_msg: (callback: (msg: CommMessage) => void) => void;
	/**
	 * Register a handler for when the comm is closed by the backend
	 * @param  callback, which is given a message
	 */
	on_close: (callback: () => void) => void;
}

export type CommMessage = UpdateMessage | EchoUpdateMessage | CustomMessage;
export type UpdateMessage = {
	parent_header?: { msg_id: string };
	buffers?: ReadonlyArray<ArrayBuffer | DataView>;
	content: {
		data: {
			method: "update";
			state: Record<string, unknown>;
			buffer_paths?: ReadonlyArray<ReadonlyArray<string | number>>;
		};
	};
};
export type EchoUpdateMessage = {
	parent_header?: { msg_id: string };
	buffers?: ReadonlyArray<ArrayBuffer | DataView>;
	content: {
		data: {
			method: "echo_update";
			state: Record<string, unknown>;
			buffer_paths?: ReadonlyArray<ReadonlyArray<string | number>>;
		};
	};
};
export type CustomMessage = {
	buffers?: ReadonlyArray<ArrayBuffer | DataView>;
	content: {
		data: {
			method: "custom";
			content: unknown;
		};
	};
};

export type WidgetManager = { get_model: (model_id: string) => unknown };
export type FieldSerializer<A, B> = {
	serialize: (value: A) => B | Promise<B>;
	deserialize: (value: B, widget_manager: WidgetManager) => A | Promise<A>;
};

export type ModelOptions = {
	model_id: string;
	comm?: Comm;
	widget_manager: WidgetManager;
};
