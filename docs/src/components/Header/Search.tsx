/** @jsxImportSource react */
import { useCallback, useRef, useState } from "react";
import { ALGOLIA } from "../../consts";
import "@docsearch/css";
import "./HeaderButton.css";
import "./Search.css";

import { createPortal } from "react-dom";
import * as docSearchReact from "@docsearch/react";

/** FIXME: This is still kinda nasty, but DocSearch is not ESM ready. */
const DocSearchModal =
	docSearchReact.DocSearchModal ||
	(docSearchReact as any).default.DocSearchModal;
const useDocSearchKeyboardEvents =
	docSearchReact.useDocSearchKeyboardEvents ||
	(docSearchReact as any).default.useDocSearchKeyboardEvents;

export default function Search() {
	const [isOpen, setIsOpen] = useState(false);
	const searchButtonRef = useRef<HTMLButtonElement>(null);
	const [initialQuery, setInitialQuery] = useState("");

	const onOpen = useCallback(() => {
		setIsOpen(true);
	}, [setIsOpen]);

	const onClose = useCallback(() => {
		setIsOpen(false);
	}, [setIsOpen]);

	const onInput = useCallback(
		(e) => {
			setIsOpen(true);
			setInitialQuery(e.key);
		},
		[setIsOpen, setInitialQuery]
	);

	useDocSearchKeyboardEvents({
		isOpen,
		onOpen,
		onClose,
		onInput,
		searchButtonRef,
	});

	return (
		<>
			<button
				type="button"
				ref={searchButtonRef}
				onClick={onOpen}
				className="search-input header-button"
			>
				<svg
					width="1em"
					height="1em"
					viewBox="0 0 24 24"
					fill="none"
					focusable="false"
					aria-hidden="true"
					role="img"
				>
					<path
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						transform="translate(-1)"
					></path>
				</svg>

				<span className="search-placeholder">Search</span>

				<span className="search-hint">
					<span className="sr-only">Press</span>

					<kbd>/</kbd>

					<span className="sr-only">to search</span>
				</span>
			</button>

			{isOpen &&
				createPortal(
					<DocSearchModal
						initialQuery={initialQuery}
						initialScrollY={window.scrollY}
						onClose={onClose}
						indexName={ALGOLIA.indexName}
						appId={ALGOLIA.appId}
						apiKey={ALGOLIA.apiKey}
						transformItems={(items) => {
							return items.map((item) => {
								// We transform the absolute URL into a relative URL to
								// work better on localhost, preview URLS.
								const a = document.createElement("a");
								a.href = item.url;
								const hash = a.hash === "#overview" ? "" : a.hash;
								return {
									...item,
									url: `${a.pathname}${hash}`,
								};
							});
						}}
					/>,
					document.body
				)}
		</>
	);
}
