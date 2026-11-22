const BaseElement = globalThis.HTMLElement ?? class {};
const activeViewers = new WeakMap();
const labelConfigurations = new WeakMap();
const defaultLabels = {
	'open-label': 'Enlarge image',
	'dialog-label': 'Enlarged images',
	'close-label': 'Close',
	'previous-label': 'Previous image',
	'next-label': 'Next image',
	'loading-label': 'Loading image',
	'error-label': 'The image could not be loaded.',
	'retry-label': 'Try again',
	'position-label': '{current} of {total}',
};

/** Enhance authored images without changing their links or responsive sources. */
export class ImgEnlargeElement extends BaseElement {
	static observedAttributes = [
		'src',
		'srcset',
		'sizes',
		'caption',
		'name',
		'controls',
		'force',
		...Object.keys(defaultLabels),
	];

	constructor() {
		super();
		this._state = 'idle';
		this._pending = false;
		this._entries = [];
		this._viewer = null;
		this._closingDialogs = new Set();
		this._layoutFrame = null;
		this._layoutAbort = null;
		this._resizeObserver = null;
	}

	get state() {
		return this._state;
	}

	connectedCallback() {
		this._schedule();
	}

	disconnectedCallback() {
		this._stopLayout();
		this.close();
		this._clearClosingDialogs();
		this._clearEntries();
		this._state = 'idle';
	}

	attributeChangedCallback(name, previous, value) {
		if (previous !== value && this.isConnected) this._schedule();
	}

	_schedule() {
		if (this._pending) return;
		this._pending = true;
		queueMicrotask(() => {
			if (!this._pending) return;
			this._pending = false;
			if (this.isConnected) this.refresh();
		});
	}

	_images() {
		const images = [...this.querySelectorAll('img')].filter(
			(image) =>
				image.closest('img-enlarge') === this &&
				!image.closest('.img-enlarge-dialog'),
		);
		if (!images.length) {
			throw new Error(
				'img-enlarge requires at least one authored image.',
			);
		}
		return images;
	}

	_clearEntries() {
		for (const { anchor } of this._entries) anchor.remove();
		this._entries = [];
	}

	_clearClosingDialogs() {
		for (const dialog of this._closingDialogs) dialog.remove();
		this._closingDialogs.clear();
	}

	static _validateLabels(labels) {
		if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
			throw new Error('img-enlarge label dictionaries must be objects.');
		}
		for (const [name, value] of Object.entries(labels)) {
			if (!Object.hasOwn(defaultLabels, name))
				throw new Error(`Unknown img-enlarge label: ${name}.`);
			if (typeof value !== 'string' || !value.trim())
				throw new Error(`${name} must be a nonempty string.`);
			if (
				name === 'position-label' &&
				(!value.includes('{current}') || !value.includes('{total}'))
			)
				throw new Error(
					'position-label must include {current} and {total}.',
				);
		}
	}

	static _labelConfiguration(script) {
		if (
			script.localName !== 'script' ||
			script.type.trim().toLowerCase() !== 'application/json' ||
			script.hasAttribute('src')
		)
			throw new Error(
				'data-img-enlarge-config must mark an inline <script type="application/json">.',
			);
		const text = script.textContent;
		const cached = labelConfigurations.get(script);
		if (cached?.text === text) return cached.value;
		const parsed = JSON.parse(text);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
			throw new Error(
				'data-img-enlarge-config must contain a label object or language dictionaries.',
			);
		const entries = Object.entries(parsed);
		const value = { flat: {}, locales: new Map() };
		if (
			entries.every(
				([, labels]) => typeof labels !== 'object' || labels === null,
			)
		) {
			ImgEnlargeElement._validateLabels(parsed);
			value.flat = parsed;
		} else {
			for (const [language, labels] of entries) {
				const key = Intl.getCanonicalLocales(language)[0].toLowerCase();
				if (value.locales.has(key))
					throw new Error(
						`Duplicate img-enlarge language: ${language}.`,
					);
				ImgEnlargeElement._validateLabels(labels);
				value.locales.set(key, labels);
			}
		}
		labelConfigurations.set(script, { text, value });
		return value;
	}

	_resolveLabels() {
		const scripts = [
			...this.ownerDocument.querySelectorAll('[data-img-enlarge-config]'),
		];
		const scopes = new Set(['', this.getAttribute('name') ?? '']);
		const labels = { ...defaultLabels };
		for (const scope of scopes) {
			const matches = scripts.filter(
				(script) =>
					script.getAttribute('data-img-enlarge-config') === scope,
			);
			if (matches.length > 1)
				throw new Error(
					'Only one data-img-enlarge-config script is allowed per scope.',
				);
			if (!matches.length) continue;
			const configuration = ImgEnlargeElement._labelConfiguration(
				matches[0],
			);
			Object.assign(labels, configuration.flat);
			if (configuration.locales.size) {
				let language =
					this.closest('[lang]')?.getAttribute('lang') ??
					this.ownerDocument.documentElement.lang;
				const dictionaries = [];
				if (language)
					language =
						Intl.getCanonicalLocales(language)[0].toLowerCase();
				while (language) {
					const dictionary = configuration.locales.get(language);
					if (dictionary) dictionaries.unshift(dictionary);
					language = language.slice(
						0,
						Math.max(0, language.lastIndexOf('-')),
					);
				}
				Object.assign(labels, ...dictionaries);
			}
		}
		for (const name of Object.keys(defaultLabels)) {
			if (this.hasAttribute(name)) labels[name] = this.getAttribute(name);
		}
		ImgEnlargeElement._validateLabels(labels);
		return labels;
	}

	/** Reread configuration, closing the viewer and retaining opener focus. */
	refresh() {
		this._pending = false;
		this._stopLayout();
		this.close();
		this._clearClosingDialogs();
		const restoreImage = this._entries.find(
			({ trigger }) => this.ownerDocument.activeElement === trigger,
		)?.image;
		this._clearEntries();
		if (!this.isConnected) return;
		try {
			const images = this._images();
			ImgEnlargeElement._installStyles(this.ownerDocument, this.nonce);
			if (this.closest('a, button, label')) {
				throw new Error(
					'Place image links inside img-enlarge, not around it.',
				);
			}
			const controls = this.getAttribute('controls') ?? 'auto';
			if (!['auto', 'buttons'].includes(controls)) {
				throw new Error('controls must be "auto" or "buttons".');
			}
			this._labels = this._resolveLabels();
			const dialog = this.ownerDocument.createElement('dialog');
			if (typeof dialog.showModal !== 'function') {
				throw new Error(
					'img-enlarge requires the native modal dialog API.',
				);
			}
			this._entries = images.map((image) => {
				const label = this._labels['open-label'];
				const trigger = this._button(
					'open',
					images.length > 1 && image.alt.trim()
						? `${label}: ${image.alt}`
						: label,
				);
				trigger.className = 'img-enlarge-trigger';
				trigger.setAttribute('aria-haspopup', 'dialog');
				const anchor = this.ownerDocument.createElement('span');
				anchor.className = 'img-enlarge-anchor';
				anchor.append(trigger);
				return { image, trigger, anchor, eligible: false };
			});
			this._observeLayout();
			this._syncLayout(restoreImage);
			const replacement = this._entries.find(
				({ image }) => image === restoreImage,
			)?.trigger;
			if (replacement?.isConnected)
				replacement.focus({ preventScroll: true });
		} catch (error) {
			this._stopLayout();
			this._clearEntries();
			this._state = 'error';
			this._error(error, 'configuration');
		}
	}

	_button(action, text) {
		const button = this.ownerDocument.createElement('button');
		button.type = 'button';
		button.dataset.action = action;
		button.className = `img-enlarge-${action}`;
		const direction =
			this.ownerDocument.defaultView.getComputedStyle(this).direction;
		const icons = {
			open: '⤢',
			close: '×',
			previous: direction === 'rtl' ? '→' : '←',
			next: direction === 'rtl' ? '←' : '→',
		};
		if (icons[action]) {
			button.setAttribute('aria-label', text);
			const icon = this.ownerDocument.createElement('span');
			icon.setAttribute('aria-hidden', 'true');
			icon.textContent = icons[action];
			button.append(icon);
		} else button.textContent = text;
		return button;
	}

	static _installStyles(document, nonce) {
		let style = document.head.querySelector('style[data-img-enlarge]');
		if (!style) {
			style = document.createElement('style');
			style.dataset.imgEnlarge = '';
			if (nonce) style.nonce = nonce;
			style.textContent = styles;
			document.head.append(style);
		}
		if (!style.sheet) {
			style.remove();
			throw new Error(
				'img-enlarge styles were blocked; supply an allowed nonce for your style policy.',
			);
		}
	}

	_observeLayout() {
		const window = this.ownerDocument.defaultView;
		const abort = new window.AbortController();
		this._layoutAbort = abort;
		const schedule = () => this._scheduleLayout();
		this._resizeObserver = new window.ResizeObserver(schedule);
		this._resizeObserver.observe(this);
		window.addEventListener('resize', schedule, { signal: abort.signal });
		window.visualViewport?.addEventListener('resize', schedule, {
			signal: abort.signal,
		});
		for (const entry of this._entries) {
			const { image, trigger } = entry;
			this._resizeObserver.observe(image);
			trigger.addEventListener('click', () => this._open(entry), {
				signal: abort.signal,
			});
			image.addEventListener('load', schedule, { signal: abort.signal });
			image.addEventListener('error', schedule, { signal: abort.signal });
			trigger.addEventListener('blur', schedule, {
				signal: abort.signal,
			});
		}
	}

	_stopLayout() {
		this._layoutAbort?.abort();
		this._layoutAbort = null;
		this._resizeObserver?.disconnect();
		this._resizeObserver = null;
		if (this._layoutFrame !== null) {
			this.ownerDocument.defaultView.cancelAnimationFrame(
				this._layoutFrame,
			);
			this._layoutFrame = null;
		}
	}

	_scheduleLayout() {
		if (!this._layoutAbort || this._layoutFrame !== null) return;
		this._layoutFrame =
			this.ownerDocument.defaultView.requestAnimationFrame(() => {
				this._layoutFrame = null;
				if (this.isConnected && this._entries.length)
					this._syncLayout();
			});
	}

	_syncLayout(restoreImage) {
		try {
			const host = this.getBoundingClientRect();
			const style = this.ownerDocument.defaultView.getComputedStyle(this);
			// offsetWidth/offsetHeight round fractional grid and flex layouts.
			const extra = (properties) =>
				style.boxSizing === 'border-box'
					? 0
					: properties.reduce(
							(sum, property) =>
								sum + parseFloat(style[property]),
							0,
						);
			const width =
				parseFloat(style.width) +
				extra([
					'paddingLeft',
					'paddingRight',
					'borderLeftWidth',
					'borderRightWidth',
				]);
			const height =
				parseFloat(style.height) +
				extra([
					'paddingTop',
					'paddingBottom',
					'borderTopWidth',
					'borderBottomWidth',
				]);
			const scaleX = width ? host.width / width : 1;
			const scaleY = height ? host.height / height : 1;
			for (const entry of this._entries) {
				const { image, anchor, trigger } = entry;
				const rect = image.getBoundingClientRect();
				Object.assign(anchor.style, {
					left: `${(rect.left - host.left) / (scaleX || 1) - this.clientLeft + this.scrollLeft}px`,
					top: `${(rect.top - host.top) / (scaleY || 1) - this.clientTop + this.scrollTop}px`,
					width: `${rect.width / (scaleX || 1)}px`,
					height: `${rect.height / (scaleY || 1)}px`,
				});
				const hidden = image.closest('[hidden], [inert]');
				entry.eligible =
					image.isConnected &&
					image.closest('img-enlarge') === this &&
					(!hidden || hidden === this.closest('[hidden], [inert]')) &&
					(this.hasAttribute('force') ||
						image === restoreImage ||
						this._viewer?.opener === trigger ||
						this.ownerDocument.activeElement === trigger ||
						this._canEnlarge(image, rect));
				if (entry.eligible) {
					if (!anchor.isConnected) this.append(anchor);
				} else anchor.remove();
			}
			if (!this._viewer)
				this._state = this._entries.some(({ eligible }) => eligible)
					? 'ready'
					: 'inactive';
		} catch (error) {
			this._stopLayout();
			this._clearEntries();
			this._state = 'error';
			this._error(error, 'configuration');
		}
	}

	_canEnlarge(image, rect) {
		if (!rect.width || !rect.height) return false;
		const responsive = this._responsive(image);
		if (
			responsive &&
			(responsive.largest <= responsive.current ||
				responsive.largest <= rect.width + 1)
		)
			return false;
		const width = image.naturalWidth || rect.width;
		const height = image.naturalHeight || rect.height;
		const frame = this._frame([{ element: this }]);
		const preview = this.ownerDocument.createElement('img');
		preview.className = 'img-enlarge-image';
		ImgEnlargeElement._sizeImage(
			preview,
			Math.round(width),
			Math.round(height),
		);
		preview.alt = '';
		const caption = this.ownerDocument.createElement('figcaption');
		caption.className = 'img-enlarge-caption';
		caption.textContent = ImgEnlargeElement._caption(this, image);
		caption.hidden = !caption.textContent.trim();
		frame.slides[0].append(preview, caption);
		frame.status.textContent = this._labels['position-label']
			.replaceAll('{current}', '1')
			.replaceAll('{total}', '1');
		frame.close.autofocus = false;
		frame.dialog.setAttribute('aria-hidden', 'true');
		frame.dialog.inert = true;
		frame.dialog.style.visibility = 'hidden';
		frame.dialog.style.pointerEvents = 'none';
		frame.dialog.open = true;
		frame.dialog.popover = 'manual';
		try {
			this.append(frame.dialog);
			// Top-layer measurement preserves scoped styles without a transformed
			// ancestor becoming the fixed-position containing block.
			frame.dialog.showPopover?.();
			const available = preview.getBoundingClientRect();
			const factor = Math.min(
				available.width / width,
				available.height / height,
			);
			return (
				width * factor > rect.width + 1 ||
				height * factor > rect.height + 1
			);
		} finally {
			frame.dialog.remove();
		}
	}

	_collection() {
		if (this.closest('[hidden], [inert]')) return [];
		const name = this.getAttribute('name') ?? '';
		const elements = name
			? [...this.ownerDocument.querySelectorAll('img-enlarge')]
			: [this];
		return elements
			.flatMap((element) => {
				if (
					!(element instanceof ImgEnlargeElement) ||
					element.closest('[hidden], [inert]') ||
					(name && element.getAttribute('name') !== name)
				)
					return [];
				if (!element._entries.length && element._pending)
					element.refresh();
				if (element.state === 'error') return [];
				return element._entries
					.filter(
						({ image }) =>
							image.isConnected &&
							image.closest('img-enlarge') === element &&
							!image.closest('[hidden], [inert]'),
					)
					.map(({ image }) => ({ element, image }));
			})
			.sort((a, b) => {
				if (a.image === b.image) return 0;
				return a.image.compareDocumentPosition(b.image) &
					this.ownerDocument.defaultView.Node
						.DOCUMENT_POSITION_FOLLOWING
					? -1
					: 1;
			});
	}

	static _candidates(text, baseURI) {
		const candidates = [];
		const values = new Set();
		let kind;
		while (text) {
			const token = /^[\t\n\f\r ,]*([^\t\n\f\r ,][^\t\n\f\r ]*)/.exec(
				text,
			);
			if (!token) break;
			let url = token[1];
			text = text.slice(token[0].length);
			let descriptor = '';
			if (url.endsWith(',')) url = url.replace(/,+$/, '');
			else {
				const end = text.indexOf(',');
				descriptor = end < 0 ? text : text.slice(0, end);
				text = end < 0 ? '' : text.slice(end + 1);
			}
			const parsed =
				/^[\t\n\f\r ]*(?:(\d+)w|((?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)x)?[\t\n\f\r ]*$/.exec(
					descriptor,
				);
			if (!parsed) return null;
			const type = parsed[1] ? 'w' : 'x';
			const value = Number(parsed[1] ?? parsed[2] ?? 1);
			if (
				!Number.isFinite(value) ||
				value <= 0 ||
				(kind && kind !== type) ||
				values.has(value)
			)
				return null;
			kind = type;
			values.add(value);
			candidates.push({ url: new URL(url, baseURI).href, value, kind });
		}
		return candidates.length ? candidates : null;
	}

	_linkedSource(image) {
		if (this.hasAttribute('src') || this.hasAttribute('srcset'))
			return null;
		const link = image.closest('a[href]');
		if (!link || !this.contains(link)) return null;
		const href = link.getAttribute('href')?.trim();
		if (!href) return null;
		const type = link.getAttribute('type')?.trim();
		const isImage = type
			? /^image\/[a-z0-9.+-]+(?:\s*;|$)/i.test(type)
			: /\.(apng|avif|bmp|gif|ico|jfif|jpe?g|png|svg|webp)$/i.test(
					link.pathname,
				);
		return isImage ? href : null;
	}

	_responsive(image) {
		if (
			this.hasAttribute('src') ||
			this.hasAttribute('srcset') ||
			this._linkedSource(image) ||
			!image.currentSrc ||
			!image.naturalWidth ||
			!image.naturalHeight
		)
			return null;
		const picture = image.parentElement;
		const sources =
			picture?.localName === 'picture'
				? [...picture.children].filter(
						(source) => source.localName === 'source',
					)
				: [];
		const matches = [];
		for (const source of [...sources, image]) {
			const candidates = ImgEnlargeElement._candidates(
				source.getAttribute('srcset') ?? '',
				source.baseURI,
			);
			if (!candidates) {
				if (
					source === image &&
					image.getAttribute('src') &&
					image.src === image.currentSrc
				)
					matches.push(null);
				continue;
			}
			if (
				source === image &&
				candidates[0].kind === 'x' &&
				!candidates.some((candidate) => candidate.value === 1) &&
				image.getAttribute('src')
			) {
				candidates.push({ url: image.src, value: 1, kind: 'x' });
			}
			const current = candidates.find(
				(candidate) => candidate.url === image.currentSrc,
			);
			if (!current) continue;
			const width = (candidate) =>
				candidate.kind === 'w'
					? candidate.value
					: Math.round(candidate.value * image.naturalWidth);
			matches.push({
				srcset: candidates
					.map((candidate) => `${candidate.url} ${width(candidate)}w`)
					.join(', '),
				current: width(current),
				largest: Math.max(...candidates.map(width)),
			});
		}
		// A shared URL cannot identify which art-directed branch the browser chose.
		return matches.length === 1 ? matches[0] : null;
	}

	static _sizeImage(image, width, height) {
		image.width = width;
		image.height = height;
		image.style.setProperty(
			'--_img-enlarge-image-aspect-ratio',
			`${width} / ${height}`,
		);
	}

	static _source(element, image) {
		const linked = element._linkedSource(image);
		const responsive = linked ? null : element._responsive(image);
		const source =
			element.getAttribute('src') ??
			linked ??
			(image.currentSrc || image.getAttribute('src'));
		if (!source?.trim()) throw new Error('An image source is required.');
		const url = new URL(source, element.baseURI);
		if (
			!['http:', 'https:', 'blob:'].includes(url.protocol) &&
			!(url.protocol === 'data:' && /^data:image\//i.test(source))
		) {
			throw new Error(
				'The image source must use HTTP(S), blob, or image data.',
			);
		}
		const width = image.naturalWidth || image.width;
		const height = image.naturalHeight || image.height;
		const dimensions = width && height ? { width, height } : null;
		return {
			element,
			image,
			src: url.href,
			srcset: element.getAttribute('srcset') ?? responsive?.srcset,
			sizes: element.getAttribute('sizes'),
			dimensions,
			inferred: responsive ? dimensions : null,
			alt: image.getAttribute('alt') ?? '',
			altLanguage: ImgEnlargeElement._language(image),
			referrerPolicy: image.getAttribute('referrerpolicy'),
			crossOrigin: image.getAttribute('crossorigin'),
			caption: ImgEnlargeElement._caption(element, image),
			captionLanguage: ImgEnlargeElement._language(
				element.hasAttribute('caption')
					? element
					: (image.closest('figure')?.querySelector('figcaption') ??
							element),
			),
		};
	}

	static _language(element) {
		return element.closest('[lang]')?.getAttribute('lang') ?? '';
	}

	static _caption(element, image) {
		return (
			element.getAttribute('caption') ??
			image.closest('figure')?.querySelector('figcaption')?.textContent ??
			''
		);
	}

	/** Open a collection snapshot, preserving authored image request policies. */
	open() {
		if (!this.isConnected || this._viewer) return;
		if (!this._entries.length) this.refresh();
		if (this._entries[0]) this._open(this._entries[0]);
	}

	_open(entry) {
		if (!this.isConnected || this._viewer || !entry.eligible) return;
		try {
			const items = this._collection().map(({ element, image }) =>
				ImgEnlargeElement._source(element, image),
			);
			const index = items.findIndex((item) => item.image === entry.image);
			if (index < 0)
				throw new Error(
					'A hidden or inert image cannot open a collection.',
				);
			activeViewers.get(this.ownerDocument)?.close();
			if (
				this._viewer ||
				activeViewers.has(this.ownerDocument) ||
				!this.isConnected
			)
				return;
			const current = this._entries.find(
				(candidate) => candidate.image === entry.image,
			);
			if (!current?.eligible) return;
			this._createViewer(items, index, current.trigger);
			activeViewers.set(this.ownerDocument, this);
			this._viewer.dialog.showModal();
			this._state = 'open';
			const viewer = this._viewer;
			this._select(index, true);
			if (this._viewer !== viewer) return;
			viewer.close.focus();
			this._emit('open', this._detail());
		} catch (error) {
			this.close();
			this._error(error, 'open');
		}
	}

	_frame(items) {
		const document = this.ownerDocument;
		const dialog = document.createElement('dialog');
		dialog.className = 'img-enlarge-dialog';
		dialog.setAttribute('aria-label', this._labels['dialog-label']);
		dialog.lang =
			this.closest('[lang]')?.getAttribute('lang') ??
			document.documentElement.lang;
		dialog.dir =
			this.ownerDocument.defaultView.getComputedStyle(this).direction ||
			'ltr';
		const close = this._button('close', this._labels['close-label']);
		close.autofocus = true;
		const track = document.createElement('div');
		track.className = 'img-enlarge-track';
		track.dataset.track = '';
		track.dataset.previousLabel = this._labels['previous-label'];
		track.dataset.nextLabel = this._labels['next-label'];
		const native =
			this.getAttribute('controls') !== 'buttons' &&
			this.ownerDocument.defaultView.CSS.supports(
				'selector(::scroll-button(inline-start))',
			) &&
			this.ownerDocument.defaultView.CSS.supports(
				'content',
				'"x" / attr(data-previous-label)',
			) &&
			this.ownerDocument.defaultView
				.getComputedStyle(this)
				.getPropertyValue('--_img-enlarge-css-controls')
				.trim() === 'available';
		dialog.dataset.controls = native ? 'css' : 'buttons';
		const slides = items.map(() => {
			const figure = document.createElement('figure');
			figure.className = 'img-enlarge-slide';
			track.append(figure);
			return figure;
		});
		const navigation = document.createElement('div');
		navigation.className = 'img-enlarge-navigation';
		const previous = this._button(
			'previous',
			this._labels['previous-label'],
		);
		const next = this._button('next', this._labels['next-label']);
		navigation.append(previous, next);
		navigation.hidden = native || items.length === 1;
		track.dataset.single = String(items.length === 1);
		const status = document.createElement('p');
		status.className = 'img-enlarge-status';
		status.setAttribute('role', 'status');
		status.setAttribute('aria-atomic', 'true');
		const retry = this._button('retry', this._labels['retry-label']);
		retry.hidden = true;
		dialog.append(close, track, navigation, status, retry);
		return {
			dialog,
			close,
			track,
			slides,
			status,
			retry,
			previous,
			next,
			items,
		};
	}

	_createViewer(items, index, opener) {
		const frame = this._frame(items);
		const { dialog, close, track, slides, status, retry, previous, next } =
			frame;
		const abort = new this.ownerDocument.defaultView.AbortController();
		const { signal } = abort;
		this._viewer = {
			opener,
			dialog,
			close,
			track,
			slides,
			status,
			retry,
			previous,
			next,
			items,
			index,
			abort,
			loads: new Map(),
			frame: null,
			scrollTarget: null,
		};
		dialog.addEventListener(
			'click',
			(event) => {
				const action = event.target.closest?.('button')?.dataset.action;
				if (action === 'close') this.close();
				else if (action === 'previous') this.previous();
				else if (action === 'next') this.next();
				else if (action === 'retry')
					this._load(this._viewer.index, true);
			},
			{ signal },
		);
		dialog.addEventListener(
			'keydown',
			(event) => {
				if (
					event.defaultPrevented ||
					event.altKey ||
					event.ctrlKey ||
					event.metaKey
				)
					return;
				if (event.key === 'Escape') {
					event.preventDefault();
					this.close();
				} else if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
					event.preventDefault();
					const forward =
						event.key ===
						(dialog.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
					if (forward) this.next();
					else this.previous();
				}
			},
			{ signal },
		);
		dialog.addEventListener('close', () => this._disposeViewer(), {
			signal,
		});
		const syncSelection = () => {
			const viewer = this._viewer;
			if (viewer.frame !== null) return;
			viewer.frame = this.ownerDocument.defaultView.requestAnimationFrame(
				() => {
					viewer.frame = null;
					if (this._viewer !== viewer) return;
					if (viewer.scrollTarget !== null) return;
					const bounds = track.getBoundingClientRect();
					const edge = dialog.dir === 'rtl' ? 'right' : 'left';
					const distances = slides.map((slide) =>
						Math.abs(
							slide.getBoundingClientRect()[edge] - bounds[edge],
						),
					);
					this._select(
						distances.indexOf(Math.min(...distances)),
						false,
					);
				},
			);
		};
		track.addEventListener('scroll', syncSelection, {
			signal,
			passive: true,
		});
		track.addEventListener(
			'scrollend',
			() => {
				if (this._viewer?.track !== track) return;
				this._viewer.scrollTarget = null;
				syncSelection();
			},
			{ signal },
		);
		this.append(dialog);
	}

	_detail() {
		const { index, items } = this._viewer;
		return {
			index,
			total: items.length,
			element: items[index].element,
			image: items[index].image,
		};
	}

	_select(index, scroll) {
		const viewer = this._viewer;
		if (!viewer || index < 0 || index >= viewer.items.length) return;
		const changed = viewer.index !== index || !viewer.loads.has(index);
		const window = this.ownerDocument.defaultView;
		const edge = viewer.dialog.dir === 'rtl' ? 'right' : 'left';
		const smooth =
			scroll &&
			viewer.loads.size > 0 &&
			'onscrollend' in viewer.track &&
			!window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
			window.getComputedStyle(viewer.track).scrollBehavior === 'smooth' &&
			Math.abs(
				viewer.slides[index].getBoundingClientRect()[edge] -
					viewer.track.getBoundingClientRect()[edge],
			) > 1;
		if (scroll && viewer.scrollTarget !== null && !smooth) {
			// A no-op scrollIntoView can leave Firefox's earlier smooth scroll running.
			viewer.track.scrollTo({
				left: viewer.track.scrollLeft,
				top: viewer.track.scrollTop,
				behavior: 'instant',
			});
			viewer.scrollTarget = null;
		}
		viewer.index = index;
		viewer.previous.setAttribute('aria-disabled', String(index === 0));
		viewer.next.setAttribute(
			'aria-disabled',
			String(index === viewer.items.length - 1),
		);
		for (const [position, slide] of viewer.slides.entries()) {
			slide.setAttribute('aria-hidden', String(position !== index));
		}
		this._load(index);
		if (this._viewer !== viewer) return;
		this._updateStatus();
		if (scroll) {
			viewer.scrollTarget = smooth ? index : null;
			viewer.slides[index].scrollIntoView({
				block: 'nearest',
				inline: 'start',
				behavior: smooth ? 'smooth' : 'instant',
			});
		}
		if (changed) this._emit('change', this._detail());
	}

	_load(index, retry = false) {
		const viewer = this._viewer;
		if (viewer.loads.has(index) && !retry) return;
		viewer.loads.get(index)?.abort.abort();
		const abort = new this.ownerDocument.defaultView.AbortController();
		const record = { state: 'loading', abort };
		viewer.loads.set(index, record);
		const item = viewer.items[index];
		const image = this.ownerDocument.createElement('img');
		image.className = 'img-enlarge-image';
		image.alt = item.alt;
		image.lang = item.altLanguage;
		image.decoding = 'async';
		if (item.referrerPolicy !== null)
			image.setAttribute('referrerpolicy', item.referrerPolicy);
		if (item.crossOrigin !== null)
			image.setAttribute('crossorigin', item.crossOrigin);
		const caption = this.ownerDocument.createElement('figcaption');
		caption.className = 'img-enlarge-caption';
		caption.textContent = item.caption;
		caption.lang = item.captionLanguage;
		caption.hidden = !item.caption.trim();
		const complete = (state) => {
			if (
				this._viewer !== viewer ||
				viewer.loads.get(index) !== record ||
				record.state === state
			)
				return;
			record.state = state;
			if (state === 'loaded')
				image.style.removeProperty('--_img-enlarge-image-aspect-ratio');
			if (viewer.index === index) this._updateStatus();
			if (state === 'error') {
				this._error(
					new Error(`Unable to load enlarged image ${index + 1}.`),
					'load',
					item.element,
				);
			}
		};
		image.addEventListener('load', () => complete('loaded'), {
			signal: abort.signal,
		});
		image.addEventListener('error', () => complete('error'), {
			signal: abort.signal,
		});
		if (item.dimensions) {
			ImgEnlargeElement._sizeImage(
				image,
				item.dimensions.width,
				item.dimensions.height,
			);
		}
		viewer.slides[index].replaceChildren(image, caption);
		if (item.sizes !== null) image.sizes = item.sizes;
		else if (item.inferred) {
			const update = () => {
				if (abort.signal.aborted || record.state === 'error') return;
				const width = Math.min(
					image.clientWidth,
					(image.clientHeight * item.inferred.width) /
						item.inferred.height,
				);
				const sizes = `${Math.ceil(width)}px`;
				if (image.sizes !== sizes) image.sizes = sizes;
			};
			update();
			const observer = new this.ownerDocument.defaultView.ResizeObserver(
				update,
			);
			observer.observe(image);
			abort.signal.addEventListener(
				'abort',
				() => observer.disconnect(),
				{ once: true },
			);
		}
		if (item.srcset) image.srcset = item.srcset;
		image.src = item.src;
		this._updateStatus();
		if (image.complete) complete(image.naturalWidth ? 'loaded' : 'error');
	}

	_updateStatus() {
		const viewer = this._viewer;
		const state = viewer.loads.get(viewer.index)?.state;
		const position = this._labels['position-label']
			.replaceAll('{current}', String(viewer.index + 1))
			.replaceAll('{total}', String(viewer.items.length));
		viewer.status.textContent =
			state === 'loading'
				? `${position}. ${this._labels['loading-label']}`
				: state === 'error'
					? `${position}. ${this._labels['error-label']}`
					: position;
		const hadRetryFocus = this.ownerDocument.activeElement === viewer.retry;
		viewer.retry.hidden = state !== 'error';
		if (hadRetryFocus && viewer.retry.hidden) viewer.close.focus();
	}

	next() {
		if (this._viewer) this._select(this._viewer.index + 1, true);
	}

	previous() {
		if (this._viewer) this._select(this._viewer.index - 1, true);
	}

	close() {
		if (!this._viewer) return;
		if (this._viewer.dialog.open) this._viewer.dialog.close();
		this._disposeViewer();
	}

	_disposeViewer() {
		const viewer = this._viewer;
		if (!viewer) return;
		this._viewer = null;
		viewer.abort.abort();
		for (const record of viewer.loads.values()) record.abort.abort();
		if (viewer.frame !== null)
			this.ownerDocument.defaultView.cancelAnimationFrame(viewer.frame);
		const window = this.ownerDocument.defaultView;
		const exits = (viewer.dialog.getAnimations?.() ?? []).filter(
			(animation) =>
				window.CSSTransition &&
				animation instanceof window.CSSTransition &&
				['opacity', 'transform', 'overlay', 'display'].includes(
					animation.transitionProperty,
				) &&
				animation.playState === 'running',
		);
		if (this.isConnected && exits.length) {
			viewer.dialog.inert = true;
			viewer.dialog.setAttribute('aria-hidden', 'true');
			this._closingDialogs.add(viewer.dialog);
			Promise.all(exits.map((animation) => animation.finished))
				.catch((error) => {
					if (error.name !== 'AbortError')
						this._error(error, 'configuration');
				})
				.finally(() => {
					viewer.dialog.remove();
					this._closingDialogs.delete(viewer.dialog);
				});
		} else viewer.dialog.remove();
		if (activeViewers.get(this.ownerDocument) === this)
			activeViewers.delete(this.ownerDocument);
		this._state =
			this.isConnected && this._entries.length ? 'ready' : 'idle';
		if (viewer.opener?.isConnected)
			viewer.opener.focus({ preventScroll: true });
		this._emit('close', {});
		this._scheduleLayout();
	}

	_emit(name, detail) {
		this.dispatchEvent(
			new CustomEvent(`img-enlarge:${name}`, { bubbles: true, detail }),
		);
	}

	_error(error, phase, element = this) {
		this._emit('error', { error, phase, element });
	}
}
import { styles } from './img-enlarge-styles.js';
