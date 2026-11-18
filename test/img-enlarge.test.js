import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const settle = () => new Promise((resolve) => queueMicrotask(resolve));

function configureLabels(value, name = '') {
	const script = document.createElement('script');
	script.dataset.imgEnlargeConfig = name;
	script.type = 'application/json';
	script.textContent =
		typeof value === 'string' ? value : JSON.stringify(value);
	document.body.prepend(script);
	return script;
}

function append(
	attributes = '',
	content = '<img src="/small.svg" alt="Mountains">',
) {
	const wrapper = document.createElement('div');
	wrapper.innerHTML = `<img-enlarge force ${attributes}>${content}</img-enlarge>`;
	const element = wrapper.firstElementChild;
	document.body.append(element);
	return element;
}

describe('img-enlarge', () => {
	beforeEach(() => {
		vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(
			false,
		);
		vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(
			function () {
				this.setAttribute('open', '');
			},
		);
		vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(
			function () {
				this.removeAttribute('open');
				this.dispatchEvent(new Event('close'));
			},
		);
		vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(
			() => {},
		);
	});

	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it('shares flat labels across openers while preserving attribute overrides and a grouped viewer snapshot', async () => {
		configureLabels({
			'open-label': 'Agrandir',
			'close-label': 'Fermer',
			'position-label': '{current} sur {total}',
		});
		const first = append('name="translated" open-label="Détails"');
		const second = append(
			'name="translated" close-label="Fermer autrement"',
		);
		await settle();
		expect(first.querySelector('button').getAttribute('aria-label')).toBe(
			'Détails',
		);
		expect(second.querySelector('button').getAttribute('aria-label')).toBe(
			'Agrandir',
		);
		first.open();
		first.next();
		document
			.querySelector('dialog .img-enlarge-slide[aria-hidden="false"] img')
			.dispatchEvent(new Event('load'));
		expect(
			document
				.querySelector('[data-action="close"]')
				.getAttribute('aria-label'),
		).toBe('Fermer');
		expect(document.querySelector('[role="status"]').textContent).toBe(
			'2 sur 2',
		);
		first.close();
		second.open();
		expect(
			document
				.querySelector('[data-action="close"]')
				.getAttribute('aria-label'),
		).toBe('Fermer autrement');
	});

	it('layers page and named labels per key without changing the opener labels during navigation', async () => {
		configureLabels({
			fr: {
				'position-label': '{current} sur {total}',
				'retry-label': 'Réessayer',
			},
			'fr-CA': { 'close-label': 'Page canadienne' },
		});
		configureLabels(
			{
				fr: { 'close-label': 'Fermer le vélo' },
				'fr-CA': { 'previous-label': 'Photo précédente' },
			},
			'city-bike',
		);
		const first = append(
			'name="city-bike" lang="fr-CA" next-label="Détail suivant"',
		);
		const second = append(
			'name="city-bike" lang="fr-CA" close-label="Autre fermeture"',
		);
		const other = append('name="other" lang="fr-CA"');
		await settle();
		first.open();
		first.next();
		const dialog = first.querySelector('dialog');
		expect(
			dialog
				.querySelector('[data-action="close"]')
				.getAttribute('aria-label'),
		).toBe('Fermer le vélo');
		expect(
			dialog
				.querySelector('[data-action="previous"]')
				.getAttribute('aria-label'),
		).toBe('Photo précédente');
		expect(
			dialog
				.querySelector('[data-action="next"]')
				.getAttribute('aria-label'),
		).toBe('Détail suivant');
		expect(dialog.querySelector('[data-action="retry"]').textContent).toBe(
			'Réessayer',
		);
		expect(dialog.querySelector('[role="status"]').textContent).toContain(
			'2 sur 2',
		);
		second.open();
		expect(
			second
				.querySelector('[data-action="close"]')
				.getAttribute('aria-label'),
		).toBe('Autre fermeture');
		other.open();
		expect(
			other
				.querySelector('[data-action="close"]')
				.getAttribute('aria-label'),
		).toBe('Page canadienne');
	});

	it.each(['', 'city-bike'])(
		'reports duplicate configuration in scope "%s" and recovers after removal',
		async (name) => {
			configureLabels({ 'close-label': 'First' }, name);
			const duplicate = configureLabels(
				{ 'close-label': 'Second' },
				name,
			);
			const element = append('name="city-bike"');
			const errors = vi.fn();
			element.addEventListener('img-enlarge:error', errors);
			await settle();
			expect(element.state).toBe('error');
			expect(element.querySelector('button')).toBeNull();
			expect(errors.mock.lastCall[0].detail.phase).toBe('configuration');
			if (name) {
				const other = append('name="other"');
				await settle();
				expect(other.state).toBe('ready');
			}
			duplicate.remove();
			element.refresh();
			element.open();
			expect(
				element
					.querySelector('[data-action="close"]')
					.getAttribute('aria-label'),
			).toBe('First');
		},
	);

	it('resolves inherited language dictionaries with regional, base-language, and built-in fallbacks', async () => {
		configureLabels({
			fr: {
				'open-label': 'Agrandir',
				'close-label': 'Fermer',
				'next-label': 'Suivante',
			},
			'fr-CA': { 'close-label': 'Fermer ici' },
		});
		const container = document.createElement('section');
		container.lang = 'FR-ca';
		document.body.append(container);
		const first = append();
		container.append(first);
		const second = append('lang="de"');
		await settle();
		expect(first.querySelector('button').getAttribute('aria-label')).toBe(
			'Agrandir',
		);
		expect(second.querySelector('button').getAttribute('aria-label')).toBe(
			'Enlarge image',
		);
		first.open();
		expect(document.querySelector('dialog').lang).toBe('FR-ca');
		expect(
			document
				.querySelector('[data-action="close"]')
				.getAttribute('aria-label'),
		).toBe('Fermer ici');
		expect(
			document
				.querySelector('[data-action="next"]')
				.getAttribute('aria-label'),
		).toBe('Suivante');
	});

	it('parses unchanged page labels once and picks up edits or removal through refresh', async () => {
		const script = configureLabels({ 'close-label': 'Cached close' });
		const parse = vi.spyOn(JSON, 'parse');
		const first = append();
		append();
		await settle();
		expect(parse).toHaveBeenCalledTimes(1);
		script.textContent = '{"close-label":"Updated close"}';
		first.refresh();
		first.open();
		expect(parse).toHaveBeenCalledTimes(2);
		expect(
			document
				.querySelector('[data-action="close"]')
				.getAttribute('aria-label'),
		).toBe('Updated close');
		script.remove();
		first.refresh();
		first.open();
		expect(
			document
				.querySelector('[data-action="close"]')
				.getAttribute('aria-label'),
		).toBe('Close');
	});

	it.each([
		'{',
		'[]',
		'{"next-label":false}',
		'{"close-lable":"Fermer"}',
		'{"position-label":"{current}"}',
		'{"fr_CA":{"close-label":"Fermer"}}',
		'{"fr":{},"FR":{}}',
		'{"__proto__":{"close-label":"Fermer"}}',
	])(
		'reports invalid page labels and recovers after correction: %s',
		async (value) => {
			const script = configureLabels(value);
			const element = append();
			const errors = vi.fn();
			element.addEventListener('img-enlarge:error', errors);
			await settle();
			expect(element.state).toBe('error');
			expect(element.querySelector('button')).toBeNull();
			expect(errors.mock.lastCall[0].detail.phase).toBe('configuration');
			script.textContent = '{"close-label":"Fermer"}';
			element.refresh();
			element.open();
			expect(
				document
					.querySelector('[data-action="close"]')
					.getAttribute('aria-label'),
			).toBe('Fermer');
		},
	);

	it('preserves picture sources and image links and adds a separate button', async () => {
		const element = append(
			'',
			'<a href="/article"><picture><source srcset="/wide.svg" media="(min-width: 40em)"><img src="/small.svg" srcset="/small.svg 400w" sizes="50vw" alt="Mountains"></picture></a>',
		);
		const link = element.querySelector('a');
		const image = element.querySelector('img');
		await settle();
		expect(element.shadowRoot).toBeNull();
		expect(element.querySelector('a')).toBe(link);
		expect(image.getAttribute('srcset')).toBe('/small.svg 400w');
		expect(element.querySelector('button').closest('a')).toBeNull();
		expect(element.querySelector('button').getAttribute('aria-label')).toBe(
			'Enlarge image',
		);
		element.open();
		expect(element.querySelector('a').getAttribute('href')).toBe(
			'/article',
		);
		expect(
			document.querySelector('dialog img').getAttribute('src'),
		).toContain('/small.svg');
	});

	it('uses explicit responsive enlarged sources and keeps caption separate from alt', async () => {
		const element = append(
			'src="/large.svg" srcset="/huge.svg 1600w" sizes="100vw"',
			'<figure><a href="/linked.svg"><img src="/small.svg" alt="A mountain trail"></a><figcaption>A walk in June</figcaption></figure>',
		);
		await settle();
		element.open();
		const image = document.querySelector('dialog img');
		expect(image.getAttribute('src')).toContain('/large.svg');
		expect(image.getAttribute('srcset')).toBe('/huge.svg 1600w');
		expect(image.alt).toBe('A mountain trail');
		expect(document.querySelector('dialog figcaption').textContent).toBe(
			'A walk in June',
		);
	});

	it('chains matching names in document order without wrapping and excludes other or unnamed images', async () => {
		const first = append('name="details"');
		append('name="other"');
		const second = append('name="details"');
		append();
		append('name="details" hidden');
		await settle();
		const changes = vi.fn();
		first.addEventListener('img-enlarge:change', changes);
		first.open();
		expect(
			document
				.querySelector('[data-action="previous"]')
				.getAttribute('aria-disabled'),
		).toBe('true');
		first.next();
		expect(changes.mock.lastCall[0].detail).toMatchObject({
			index: 1,
			total: 2,
			element: second,
		});

		expect(
			document
				.querySelector('[data-action="next"]')
				.getAttribute('aria-disabled'),
		).toBe('true');
		first.next();
		expect(changes).toHaveBeenCalledTimes(2);
		first.previous();
		expect(changes.mock.lastCall[0].detail.index).toBe(0);
	});

	it.each([
		['/large.JPG?download=1#detail', ''],
		['/large.svg', ''],
		['/render?id=1', 'type="image/svg+xml"'],
	])(
		'uses the enclosing image link %s ahead of authored responsive candidates',
		async (href, attributes) => {
			const element = append(
				'',
				`<a href="${href}" ${attributes}><picture><img src="/small.svg" srcset="/small.svg 400w, /larger.svg 1600w" alt="Mountains"></picture></a>`,
			);
			const original = element.querySelector('img');
			vi.spyOn(original, 'currentSrc', 'get').mockReturnValue(
				new URL('/small.svg', document.baseURI).href,
			);
			vi.spyOn(original, 'naturalWidth', 'get').mockReturnValue(400);
			vi.spyOn(original, 'naturalHeight', 'get').mockReturnValue(200);
			await settle();
			element.open();
			const enlarged = element.querySelector('dialog img');
			expect(enlarged.src).toBe(new URL(href, document.baseURI).href);
			expect(enlarged.hasAttribute('srcset')).toBe(false);
			expect(enlarged.hasAttribute('sizes')).toBe(false);
			expect(element.querySelector('a').getAttribute('href')).toBe(href);
			expect(element.querySelector('picture img')).toBe(original);
			expect(original.getAttribute('srcset')).toBe(
				'/small.svg 400w, /larger.svg 1600w',
			);
		},
	);

	it.each([
		['/article', ''],
		['/download?file=large.jpg', ''],
		['/large.jpg', 'type="text/html"'],
	])(
		'keeps responsive inference for non-image link %s %s',
		async (href, attributes) => {
			const element = append(
				'',
				`<a href="${href}" ${attributes}><img src="/small.svg" srcset="/small.svg 400w, /large.svg 1200w" alt="Mountains"></a>`,
			);
			const original = element.querySelector('img');
			vi.spyOn(original, 'currentSrc', 'get').mockReturnValue(
				new URL('/small.svg', document.baseURI).href,
			);
			vi.spyOn(original, 'naturalWidth', 'get').mockReturnValue(400);
			vi.spyOn(original, 'naturalHeight', 'get').mockReturnValue(200);
			await settle();
			element.open();
			expect(element.querySelector('dialog img').srcset).toContain(
				'/large.svg 1200w',
			);
			expect(element.querySelector('a').getAttribute('href')).toBe(href);
		},
	);

	it.each(['javascript:alert(1)', 'data:text/html,not-an-image'])(
		'rejects unsafe inferred image-link source %s with an observable error',
		async (href) => {
			const element = append(
				'',
				`<a href="${href}" type="image/png"><img src="/small.svg" alt="Mountains"></a>`,
			);
			const errors = vi.fn();
			element.addEventListener('img-enlarge:error', errors);
			await settle();
			element.open();
			expect(element.querySelector('dialog')).toBeNull();
			expect(errors.mock.lastCall[0].detail.phase).toBe('open');
			expect(errors.mock.lastCall[0].detail.error.message).toContain(
				'source',
			);
			expect(element.querySelector('a').getAttribute('href')).toBe(href);
		},
	);

	it('inherits the selected picture branch without mixing art-directed candidates', async () => {
		const element = append(
			'',
			'<picture><source srcset="/wide-small.svg 400w, /wide-large.svg 1600w"><img src="/small.svg" srcset="/small.svg 400w, /large.svg 1200w" alt="Mountains"></picture>',
		);
		const original = element.querySelector('img');
		vi.spyOn(original, 'currentSrc', 'get').mockReturnValue(
			new URL('/wide-small.svg', document.baseURI).href,
		);
		vi.spyOn(original, 'naturalWidth', 'get').mockReturnValue(400);
		vi.spyOn(original, 'naturalHeight', 'get').mockReturnValue(200);
		await settle();
		element.open();
		expect(element.querySelector('dialog img').srcset).toContain(
			'/wide-large.svg 1600w',
		);
		expect(element.querySelector('dialog img').srcset).not.toContain(
			'/large.svg',
		);
	});

	it.each([
		[
			'/small.svg 1x, data:image/svg+xml,%3Csvg%3E%3C/svg%3E 2x',
			'data:image/svg+xml,%3Csvg%3E%3C/svg%3E 800w',
		],
		['/large.svg 2x', '/small.svg 400w'],
	])(
		'infers density candidates, including implicit src and comma-containing URLs: %s',
		async (srcset, expected) => {
			const element = append(
				'',
				`<img src="/small.svg" srcset="${srcset}" alt="Mountains">`,
			);
			const original = element.querySelector('img');
			vi.spyOn(original, 'currentSrc', 'get').mockReturnValue(
				new URL('/small.svg', document.baseURI).href,
			);
			vi.spyOn(original, 'naturalWidth', 'get').mockReturnValue(400);
			vi.spyOn(original, 'naturalHeight', 'get').mockReturnValue(200);
			await settle();
			const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
			element.open();
			expect(element.querySelector('dialog img').srcset).toContain(
				expected,
			);
			element.close();
			expect(disconnect).toHaveBeenCalledOnce();
		},
	);

	it('keeps explicit enlargement srcset and sizes separate from the authored candidates', async () => {
		const element = append(
			'srcset="/explicit.svg 2000w" sizes="75vw"',
			'<a href="/linked.svg"><img src="/small.svg" srcset="/small.svg 400w, /large.svg 1200w" sizes="200px" alt="Mountains"></a>',
		);
		await settle();
		element.open();
		expect(element.querySelector('dialog img').src).toBe(
			new URL('/small.svg', document.baseURI).href,
		);
		expect(element.querySelector('dialog img').srcset).toBe(
			'/explicit.svg 2000w',
		);
		expect(element.querySelector('dialog img').sizes).toBe('75vw');
	});

	it('shows recoverable image errors and retries without losing the close control', async () => {
		const element = append(
			'src="/missing.svg"',
			'<img src="/small.svg" width="800" height="400" alt="Mountains">',
		);
		const errors = vi.fn();
		element.addEventListener('img-enlarge:error', errors);
		await settle();
		element.open();
		const image = document.querySelector('dialog img');
		image.dispatchEvent(new Event('error'));
		expect(image.hidden).toBe(false);
		expect(image.getAttribute('width')).toBe('800');
		expect(image.getAttribute('height')).toBe('400');
		expect(document.querySelector('[role="status"]').textContent).toContain(
			'could not be loaded',
		);
		expect(document.querySelector('[data-action="retry"]').hidden).toBe(
			false,
		);
		expect(errors.mock.lastCall[0].detail.phase).toBe('load');
		document.querySelector('[data-action="retry"]').click();
		const retried = document.querySelector('dialog img');
		expect(retried).not.toBe(image);
		expect(retried.getAttribute('width')).toBe('800');
		expect(retried.getAttribute('height')).toBe('400');
		retried.dispatchEvent(new Event('load'));
		expect(document.querySelector('[role="status"]').textContent).toBe(
			'1 of 1',
		);
		expect(document.querySelector('[data-action="close"]').hidden).toBe(
			false,
		);
	});

	it('renders translations as text, closes on Escape, and restores trigger focus', async () => {
		const element = append(
			'open-label="Agrandir" close-label="Fermer" dialog-label="Images" position-label="{current} sur {total}" caption="&lt;b&gt;Texte&lt;/b&gt;"',
		);
		await settle();
		const trigger = element.querySelector('button');
		trigger.focus();
		trigger.click();
		document.querySelector('dialog img').dispatchEvent(new Event('load'));
		expect(
			document.querySelector('dialog').getAttribute('aria-label'),
		).toBe('Images');
		expect(document.querySelector('dialog figcaption').textContent).toBe(
			'<b>Texte</b>',
		);
		expect(document.querySelector('dialog b')).toBeNull();
		expect(document.querySelector('[role="status"]').textContent).toBe(
			'1 sur 1',
		);
		document.querySelector('dialog').dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'Escape',
				bubbles: true,
				cancelable: true,
			}),
		);
		expect(document.querySelector('dialog')).toBeNull();
		expect(document.activeElement).toBe(trigger);
	});

	it('removes generated UI and stale load handlers on disconnect and reconnects once', async () => {
		const element = append();
		await settle();
		element.open();
		const image = document.querySelector('dialog img');
		const changes = vi.fn();
		element.addEventListener('img-enlarge:change', changes);
		element.remove();
		image.dispatchEvent(new Event('error'));
		expect(document.querySelector('dialog')).toBeNull();
		expect(element.querySelector('button')).toBeNull();
		document.body.append(element);
		await settle();
		expect(element.querySelectorAll('button')).toHaveLength(1);
		expect(changes).not.toHaveBeenCalled();
	});

	it('reports invalid configuration without replacing the authored image and recovers via refresh', async () => {
		const element = append('controls="invalid"');
		const error = vi.fn();
		element.addEventListener('img-enlarge:error', error);
		await settle();
		expect(element.state).toBe('error');
		expect(error.mock.lastCall[0].detail.error.message).toContain(
			'controls',
		);
		expect(element.querySelector('img')).not.toBeNull();
		expect(element.querySelector('button')).toBeNull();
		element.setAttribute('controls', 'buttons');
		await settle();
		expect(element.state).toBe('ready');
	});

	it('rejects empty translations and unsafe source protocols with observable errors', async () => {
		const element = append('next-label=" "');
		const errors = vi.fn();
		element.addEventListener('img-enlarge:error', errors);
		await settle();
		expect(element.state).toBe('error');
		element.removeAttribute('next-label');
		element.setAttribute('src', 'javascript:alert(1)');
		await settle();
		element.open();
		expect(errors.mock.lastCall[0].detail.error.message).toContain(
			'source',
		);
		expect(document.querySelector('dialog')).toBeNull();
	});

	it('keeps synchronously opened viewers through the pending connection microtask', async () => {
		const element = append();
		element.open();
		await settle();
		expect(element.state).toBe('open');
		expect(document.querySelectorAll('dialog')).toHaveLength(1);
	});

	it('keeps unnamed and empty-name images independent, and reevaluates a changed name', async () => {
		const first = append();
		const second = append('name=""');
		append('name="details"');
		await settle();
		first.open();
		first.next();
		expect(first.querySelectorAll('.img-enlarge-slide')).toHaveLength(1);
		expect(first.querySelector('.img-enlarge-navigation').hidden).toBe(
			true,
		);
		second.open();
		expect(document.querySelectorAll('dialog')).toHaveLength(1);
		expect(second.querySelectorAll('.img-enlarge-slide')).toHaveLength(1);
		expect(first.state).toBe('ready');
		second.setAttribute('name', 'details');
		await settle();
		expect(document.querySelector('dialog')).toBeNull();
		second.open();
		expect(second.querySelectorAll('.img-enlarge-slide')).toHaveLength(2);
	});

	it('does not turn a consumer closing on initial change into an opening error', async () => {
		const element = append();
		await settle();
		const errors = vi.fn();
		element.addEventListener('img-enlarge:error', errors);
		element.addEventListener('img-enlarge:change', () => element.close());
		element.open();
		expect(document.querySelector('dialog')).toBeNull();
		expect(errors).not.toHaveBeenCalled();
	});

	it('does not let an unnamed image bypass hidden collection eligibility', async () => {
		const element = append('hidden');
		const errors = vi.fn();
		element.addEventListener('img-enlarge:error', errors);
		await settle();
		element.open();
		expect(document.querySelector('dialog')).toBeNull();
		expect(errors.mock.lastCall[0].detail.phase).toBe('open');
	});

	it('carries one shared stylesheet and supplies named, decorative icon controls', async () => {
		const element = append();
		append();
		await settle();
		expect(
			document.head.querySelectorAll('style[data-img-enlarge]'),
		).toHaveLength(1);
		const trigger = element.querySelector('button');
		expect(trigger.getAttribute('aria-label')).toBe('Enlarge image');
		expect(trigger.querySelector('[aria-hidden="true"]').textContent).toBe(
			'⤢',
		);
		element.open();
		const close = document.querySelector('[data-action="close"]');
		expect(close.getAttribute('aria-label')).toBe('Close');
		expect(close.querySelector('[aria-hidden="true"]').textContent).toBe(
			'×',
		);
		expect(element.querySelector('.img-enlarge-dialog')).not.toBeNull();
	});

	it('disconnects responsive observation and reconnects without leaving generated image anchors', async () => {
		const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
		const element = append();
		await settle();
		element.remove();
		expect(disconnect).toHaveBeenCalled();
		expect(element.querySelector('.img-enlarge-anchor')).toBeNull();
		document.body.append(element);
		await settle();
		expect(element.querySelectorAll('.img-enlarge-anchor')).toHaveLength(1);
	});
});
