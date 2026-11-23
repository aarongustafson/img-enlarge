import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('gives every demo example its own unique section anchor', async () => {
	for (const file of [
		'index.html',
		'esm.html',
		'unpkg.html',
		'labels-flat.html',
	]) {
		const template = document.createElement('template');
		template.innerHTML = await readFile(`demo/${file}`, 'utf8');
		const pairs = template.content.querySelectorAll('.code-demo-pair');
		expect(pairs.length).toBeGreaterThan(0);
		for (const pair of pairs) {
			const section = pair.closest('section');
			expect(section.id, `${file}: missing example anchor`).toBeTruthy();
			expect(section.querySelector('h2, h3')).not.toBeNull();
			expect(section.querySelectorAll('.code-demo-pair')).toHaveLength(1);
			expect(
				[...template.content.querySelectorAll('[id]')].filter(
					(element) => element.id === section.id,
				),
			).toHaveLength(1);
		}
	}
});

it('shows copyable module-script wrappers around the CDN registration code', async () => {
	for (const file of ['esm.html', 'unpkg.html']) {
		const template = document.createElement('template');
		template.innerHTML = await readFile(`demo/${file}`, 'utf8');
		const displayed = template.content
			.querySelector('pre code')
			.textContent.match(/<script type="module">([\s\S]*?)<\/script>/);
		expect(
			displayed,
			`${file}: include the native module wrapper`,
		).not.toBeNull();
		const actual = template.content.querySelector('script[type="module"]');
		expect(displayed[1].replace(/\s+/g, ' ').trim()).toBe(
			actual.textContent.replace(/\s+/g, ' ').trim(),
		);
	}
});

it('keeps copied gallery labels, captions, and image links aligned with the live examples', async () => {
	const template = document.createElement('template');
	template.innerHTML = await readFile('demo/index.html', 'utf8');
	for (const id of ['localization-example', 'product-example']) {
		const section = template.content.getElementById(id);
		const pair = [...section.querySelectorAll('.code-demo-pair')].at(-1);
		const copied = document.createElement('template');
		copied.innerHTML = pair.querySelector('pre code').textContent;
		const describe = (root) =>
			[...root.querySelectorAll('img-enlarge')].map((element) => ({
				name: element.getAttribute('name'),
				caption: element.getAttribute('caption'),
				openLabel: element.getAttribute('open-label'),
				image: element.querySelector('img').getAttribute('src'),
				link: element.querySelector('a')?.getAttribute('href') ?? null,
			}));
		expect(describe(copied.content), id).toEqual(
			describe(pair.querySelector('.demo')),
		);
	}
});
