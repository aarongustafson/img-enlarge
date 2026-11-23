export interface ImgEnlargeChangeDetail {
	/** Zero-based position in the collection snapshot. */
	index: number;
	total: number;
	element: ImgEnlargeElement;
	/** Original authored image for the selected slide. */
	image: HTMLImageElement;
}

export interface ImgEnlargeErrorDetail {
	error: Error;
	phase: 'configuration' | 'open' | 'load';
	element: ImgEnlargeElement;
}

/**
 * Each unnamed wrapper is an isolated gallery of its authored images.
 * Matching nonempty name attributes connect individual wrappers or groups.
 * Configure labels in inline script[type="application/json"][data-img-enlarge-config].
 * An empty marker sets page defaults; a value targets that gallery name.
 * The JSON accepts a flat label object or language-keyed dictionaries;
 * individual attributes override named labels, page labels, and built-in defaults,
 * in that order. Authored images stay in light DOM.
 * Open-label templates replace {name} with each authored image's accessible name.
 * Refresh after changing image names or referenced label text.
 * Explicit src/srcset override enclosing image links; otherwise image links
 * take precedence over inferred responsive candidates and the authored source.
 * The viewer preserves each authored image's referrerpolicy and crossorigin.
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
	/** Open at the first authored image when enlargement is useful or force is present. */
	open(): void;
	/** Close and restore focus immediately; remove inert exit visuals after CSS transitions. */
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
