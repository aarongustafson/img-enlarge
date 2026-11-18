export interface ImgEnlargeChangeDetail {
	/** Zero-based position in the collection snapshot. */
	index: number;
	total: number;
	element: ImgEnlargeElement;
}

export interface ImgEnlargeErrorDetail {
	error: Error;
	phase: 'configuration' | 'open' | 'load';
	element: ImgEnlargeElement;
}

/**
 * Unnamed images open independently; matching nonempty name attributes opt into galleries.
 * Configure labels in inline script[type="application/json"][data-img-enlarge-config].
 * An empty marker sets page defaults; a value targets that gallery name.
 * The JSON accepts a flat label object or language-keyed dictionaries;
 * individual attributes override named labels, page labels, and built-in defaults,
 * in that order. Authored images stay in light DOM.
 * Explicit src/srcset override enclosing image links; otherwise image links
 * take precedence over inferred responsive candidates and the authored source.
 */
export class ImgEnlargeElement extends HTMLElement {
	static readonly observedAttributes: string[];
	readonly state: 'idle' | 'inactive' | 'ready' | 'open' | 'error';
	connectedCallback(): void;
	disconnectedCallback(): void;
	attributeChangedCallback(
		name: string,
		previous: string | null,
		value: string | null,
	): void;
	/** Reread markup, labels, and language; close the viewer and retain opener focus. */
	refresh(): void;
	/** Open this image's collection when enlargement is useful or force is present. */
	open(): void;
	close(): void;
	/** Stop at the last image; do not wrap. */
	next(): void;
	/** Stop at the first image; do not wrap. */
	previous(): void;
}

export interface ImgEnlargeEventMap {
	'img-enlarge:open': CustomEvent<ImgEnlargeChangeDetail>;
	'img-enlarge:change': CustomEvent<ImgEnlargeChangeDetail>;
	'img-enlarge:close': CustomEvent<Record<string, never>>;
	'img-enlarge:error': CustomEvent<ImgEnlargeErrorDetail>;
}

declare global {
	interface HTMLElementTagNameMap {
		'img-enlarge': ImgEnlargeElement;
	}
	interface HTMLElementEventMap extends ImgEnlargeEventMap {}
	interface DocumentEventMap extends ImgEnlargeEventMap {}
}
