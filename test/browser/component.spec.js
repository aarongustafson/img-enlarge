import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { expectNativeFocus } from './demo-fixture.js';

test.beforeEach(async ({ page }) => {
	await page.route(
		'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/**',
		(route) => route.abort(),
	);
});

const files = new Map(
	await Promise.all(
		[
			'img-enlarge.js',
			'index.js',
			'define.js',
			'img-enlarge-styles.js',
			'demo/index.html',
			'demo/labels-flat.html',
			'demo/styles.css',
			'demo/demo-shell.css',
			'demo/mountains.svg',
			'demo/mountains-large.svg',
			'demo/bicycle.svg',
			'demo/bicycle-basket.svg',
			'demo/bicycle-wheel.svg',
		].map(async (path) => [
			`/${path}`,
			await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'),
		]),
	),
);

// Runtime fixtures stay independent of the authored demo's gallery examples.
files.set(
	'/demo/index.html',
	files.get('/demo/index.html').replace(
		'</main>',
		`
<div class="demo collection-thumbnails">
  <img-enlarge id="mountains" name="landscapes-and-bikes">
    <figure>
      <a href="./mountains-large.svg"><img src="./mountains.svg" width="800" height="400" alt="A trail between two green mountains beneath a golden sun."></a>
      <figcaption>A trail through the mountains.</figcaption>
    </figure>
  </img-enlarge>
  <img-enlarge id="bicycle" name="landscapes-and-bikes" caption="A bicycle ready for an afternoon ride.">
    <img src="./bicycle.svg" width="640" height="360" alt="A red bicycle with a basket beside a pale stone path.">
  </img-enlarge>
</div>
</main>`,
	),
);

async function addFailureFixture(page) {
	await page.evaluate(() => {
		const element = document.createElement('img-enlarge');
		element.id = 'failure';
		element.setAttribute('force', '');
		element.setAttribute('src', './missing-image.svg');
		element.innerHTML =
			'<img src="./mountains.svg" width="800" height="400" alt="A trail through green mountains.">';
		document.querySelector('main').append(element);
	});
	await expect(page.locator('#failure .img-enlarge-trigger')).toBeVisible();
}

async function serve(page, controls = 'auto', enhanced = true) {
	await page.route('http://enlarge.test/**', (route) => {
		const path = new URL(route.request().url()).pathname;
		const body = files.get(path);
		return route.fulfill({
			status: body ? 200 : 404,
			contentType: path.endsWith('.js')
				? 'text/javascript'
				: path.endsWith('.css')
					? 'text/css'
					: path.endsWith('.svg')
						? 'image/svg+xml'
						: 'text/html',
			body: body ?? 'Not found',
		});
	});
	await page.goto('http://enlarge.test/demo/index.html');
	if (controls === 'buttons') {
		await page.locator('img-enlarge').evaluateAll((elements) => {
			for (const element of elements)
				element.setAttribute('controls', 'buttons');
		});
	}
	if (enhanced)
		await expect(
			page.locator('#mountains .img-enlarge-trigger'),
		).toBeVisible();
}

test.describe('multi-image wrappers', () => {
	for (const controls of ['auto', 'buttons']) {
		test(`${controls}: isolates a wrapper gallery, opens the clicked picture, and restores its opener`, async ({
			page,
		}) => {
			await serve(page);
			await page.evaluate((controls) => {
				const gallery = document.createElement('img-enlarge');
				gallery.id = 'wrapper-gallery';
				gallery.setAttribute('force', '');
				gallery.setAttribute('controls', controls);
				gallery.innerHTML =
					'<figure><img src="/demo/mountains.svg" alt="Mountains" style="width:160px"><figcaption>Mountain view</figcaption></figure><figure><picture><source srcset="/demo/bicycle.svg" type="image/svg+xml"><img src="/demo/bicycle.svg" alt="Bicycle" style="width:160px"></picture><figcaption>Bicycle view</figcaption></figure>';
				document.body.append(gallery);
			}, controls);
			const gallery = page.locator('#wrapper-gallery');
			const triggers = gallery.locator('.img-enlarge-trigger');
			await expect(triggers).toHaveCount(2);
			await expect(triggers.nth(1)).toHaveAccessibleName(
				'Enlarge image: Bicycle',
			);
			await expectNativeFocus(triggers.nth(1));
			await triggers.nth(1).click();
			await expectNativeFocus(gallery.locator('.img-enlarge-close'));
			await expect(page.getByRole('status')).toHaveText('2 of 2');
			await expect(
				gallery.locator('.img-enlarge-slide').nth(1).locator('img'),
			).toHaveAttribute('alt', 'Bicycle');
			await expect(
				gallery
					.locator('.img-enlarge-slide')
					.nth(1)
					.locator('.img-enlarge-caption'),
			).toHaveText('Bicycle view');
			await page.keyboard.press('ArrowLeft');
			await expect(page.getByRole('status')).toHaveText('1 of 2');
			await page.keyboard.press('Escape');
			await expect(triggers.nth(1)).toBeFocused();
			await page.locator('#basic-image .img-enlarge-trigger').click();
			await expect(page.getByRole('status')).toHaveText('1 of 1');
		});
	}

	test('reevaluates each image independently when its rendered size changes', async ({
		page,
	}) => {
		await serve(page);
		await page.evaluate(() => {
			const gallery = document.createElement('img-enlarge');
			gallery.id = 'sized-gallery';
			gallery.innerHTML =
				'<img src="/demo/mountains.svg" alt="Small" style="width:160px"><img src="/demo/bicycle.svg" alt="Large" style="width:1600px">';
			document.body.append(gallery);
		});
		const gallery = page.locator('#sized-gallery');
		await expect(gallery.locator('.img-enlarge-trigger')).toHaveCount(1);
		await gallery
			.locator('img')
			.nth(1)
			.evaluate((image) => (image.style.width = '160px'));
		await expect(gallery.locator('.img-enlarge-trigger')).toHaveCount(2);
		await gallery
			.locator('img')
			.nth(0)
			.evaluate((image) => (image.style.width = '1600px'));
		await expect(gallery.locator('.img-enlarge-trigger')).toHaveCount(1);
		await gallery.evaluate((element) => element.open());
		await expect(gallery.locator('dialog')).toHaveCount(0);
		await gallery.locator('.img-enlarge-trigger').click();
		await expect(page.getByRole('status')).toHaveText('2 of 2');
	});
});

test('uses authored accessible names in default and translated opener templates', async ({
	page,
}) => {
	await serve(page);
	await page.evaluate(() => {
		const gallery = document.createElement('img-enlarge');
		gallery.id = 'named-images';
		gallery.setAttribute('force', '');
		gallery.innerHTML =
			'<span id="image-label" hidden>Mountain <strong>trail</strong></span><img src="/demo/mountains.svg" aria-labelledby="missing image-label" aria-label="Ignored" alt="Ignored" style="width:160px"><img src="/demo/bicycle.svg" aria-label="City bicycle" alt="Ignored" style="width:160px"><img src="/demo/bicycle.svg" alt="Basket" style="width:160px"><img src="/demo/bicycle.svg" title="Rear wheel" style="width:160px"><img src="/demo/bicycle.svg" alt="" title="Ignored" style="width:160px">';
		document.body.append(gallery);
	});
	const gallery = page.locator('#named-images');
	const names = ['Mountain trail', 'City bicycle', 'Basket', 'Rear wheel'];
	for (const [index, name] of names.entries()) {
		await expect(gallery.locator('img').nth(index)).toHaveAccessibleName(
			name,
		);
		await expect(
			gallery.locator('.img-enlarge-trigger').nth(index),
		).toHaveAccessibleName(`Enlarge image: ${name}`);
	}
	await expect(
		gallery.locator('.img-enlarge-trigger').nth(4),
	).toHaveAccessibleName('Enlarge image');
	await gallery.evaluate((element) =>
		element.setAttribute('open-label', 'Agrandir : {name}'),
	);
	for (const [index, name] of [...names, 'image'].entries()) {
		await expect(
			gallery.locator('.img-enlarge-trigger').nth(index),
		).toHaveAccessibleName(`Agrandir : ${name}`);
	}
	await gallery.locator('.img-enlarge-trigger').nth(1).click();
	await expect(gallery.locator('.img-enlarge-close')).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(gallery.locator('.img-enlarge-trigger').nth(1)).toBeFocused();
});

test('preserves line breaks, title fallbacks, and ancestor-hidden label content', async ({
	page,
}) => {
	await serve(page);
	await page.evaluate(() => {
		const gallery = document.createElement('img-enlarge');
		gallery.id = 'referenced-names';
		gallery.setAttribute('force', '');
		gallery.innerHTML = `
			<span id="line-break-label">Mountain<br>trail</span>
			<button id="title-label" title="Mountains"><svg aria-hidden="true"></svg></button>
			<div hidden><span id="ancestor-hidden-label">Mountain <span hidden>trail</span></span></div>
			<div aria-hidden="true"><span id="aria-hidden-label">Mountain <span hidden>trail</span></span></div>
			<div style="visibility:hidden"><span id="visible-label" style="visibility:visible">Mountain <span hidden>Excluded</span>trail</span></div>
		`;
		for (const label of [
			'line-break-label',
			'title-label',
			'ancestor-hidden-label',
			'aria-hidden-label',
			'visible-label',
		]) {
			const image = document.createElement('img');
			image.src = '/demo/mountains.svg';
			image.alt = 'Ignored';
			image.style.width = '160px';
			image.setAttribute('aria-labelledby', label);
			gallery.append(image);
		}
		document.body.append(gallery);
	});
	const gallery = page.locator('#referenced-names');
	for (const [index, name] of [
		'Mountain trail',
		'Mountains',
		'Mountain trail',
		'Mountain trail',
		'Mountain trail',
	].entries()) {
		await expect(gallery.locator('img').nth(index)).toHaveAccessibleName(
			name,
		);
		await expect(
			gallery.locator('.img-enlarge-trigger').nth(index),
		).toHaveAccessibleName(`Enlarge image: ${name}`);
	}
});

test('includes hidden label content through a shadow-tree slot ancestor', async ({
	page,
}) => {
	await serve(page);
	await page.evaluate(() => {
		const host = document.createElement('div');
		host.innerHTML =
			'<span id="slotted-label">Mountain <span hidden>trail</span></span>';
		host.attachShadow({ mode: 'open' }).innerHTML =
			'<div hidden><slot></slot></div>';
		document.body.append(host);
		const element = document.createElement('img-enlarge');
		element.id = 'slotted-image';
		element.setAttribute('force', '');
		element.innerHTML =
			'<img src="/demo/mountains.svg" alt="Ignored" aria-labelledby="slotted-label" style="width:160px">';
		document.body.append(element);
	});
	await expect(
		page.locator('#slotted-image .img-enlarge-trigger'),
	).toHaveAccessibleName('Enlarge image: Mountain trail');
});

test('demo navigation preserves unclipped native focus', async ({ page }) => {
	await serve(page);
	await expectNativeFocus(page.locator('header a').first());
});

test('organizes styles, attributes, labels, and the final galleries without duplicate IDs or demo initialization errors', async ({
	page,
}) => {
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await serve(page);
	expect(await page.locator('main > section > h2').allTextContents()).toEqual(
		[
			'One-off image enlargement',
			'Force enlargement',
			'Alternate enlarged versions',
			'Captions',
			'Rewrite or translate the labels',
			'Galleries',
			'Styling',
		],
	);
	expect(
		await page.locator('#styling-examples h3').allTextContents(),
	).toEqual([
		'Basic styling',
		'Gallery styling',
		'Hide disabled navigation arrows',
	]);
	await expect(page.locator('#product-other, #failure')).toHaveCount(0);
	const ids = await page
		.locator('[id]')
		.evaluateAll((elements) => elements.map((element) => element.id));
	expect(new Set(ids).size).toBe(ids.length);
	expect(errors).toEqual([]);
});

test('demonstrates caption overrides, rewritten labels, and styled gallery navigation', async ({
	page,
}) => {
	await serve(page);
	await page.locator('#caption-override .img-enlarge-trigger').click();
	await expect(
		page.locator('#caption-override dialog figcaption'),
	).toHaveText('An afternoon on the mountain trail.');
	await page.keyboard.press('Escape');
	await expect(
		page.locator('#caption-override > figure > figcaption'),
	).toHaveText('A view from the trail.');
	const rewritten = page.getByRole('button', {
		name: 'View the trail photo',
		exact: true,
	});
	await page.keyboard.press('Tab');
	await expectNativeFocus(rewritten);
	await page.keyboard.press('Enter');
	await expect(
		page.getByRole('button', { name: 'Back to the page', exact: true }),
	).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(rewritten).toBeFocused();
	const gallery = page.locator('#styled-gallery');
	await gallery.locator('.img-enlarge-trigger').nth(1).click();
	await expect(page.getByRole('status')).toHaveText('2 of 2');
	await expect(
		gallery.locator(
			'dialog .img-enlarge-slide[aria-hidden="false"] figcaption',
		),
	).toHaveText('The basket has room for a small bag.');
	expect(
		await gallery
			.locator('dialog .img-enlarge-slide[aria-hidden="false"]')
			.evaluate(
				(el) =>
					getComputedStyle(el).gridTemplateColumns.split(' ').length,
			),
	).toBe(1);
	await page.keyboard.press('ArrowLeft');
	await expect(page.getByRole('status')).toHaveText('1 of 2');
});

for (const reduced of [false, true]) {
	test(`styled gallery animates only with motion enabled (${reduced}) and keeps logical close immediate`, async ({
		page,
	}) => {
		await page.emulateMedia({
			reducedMotion: reduced ? 'reduce' : 'no-preference',
		});
		await serve(page, 'buttons');
		const gallery = page.locator('#styled-gallery');
		const opener = gallery.locator('.img-enlarge-trigger').first();
		await opener.click();
		const dialog = gallery.locator('dialog');
		const entry = await dialog.evaluate((el) => ({
			animations: el.getAnimations().map((animation) => ({
				property: animation.transitionProperty,
				keyframes: animation.effect.getKeyframes(),
			})),
			control: (() => {
				const style = getComputedStyle(
					el.querySelector('.img-enlarge-close'),
				);
				return [style.backgroundColor, style.borderTopWidth];
			})(),
			columns: getComputedStyle(el.querySelector('.img-enlarge-slide'))
				.gridTemplateColumns,
			imageAnimations: el
				.querySelector('.img-enlarge-image')
				.getAnimations()
				.map((animation) => animation.animationName),
		}));
		expect(entry.control).toEqual(['rgba(0, 0, 0, 0)', '0px']);
		expect(entry.columns).toBe('none');
		if (reduced) {
			expect(entry.animations).toHaveLength(0);
			expect(entry.imageAnimations).toHaveLength(0);
		} else {
			const fade = entry.animations.find(
				(animation) => animation.property === 'opacity',
			);
			expect(fade).toBeDefined();
			expect(fade.keyframes[0].opacity).toBe('0');
			expect(fade.keyframes.at(-1).opacity).toBe('1');
		}
		await expect(dialog).toHaveCSS('opacity', '1');
		await page.keyboard.press('Tab');
		await expectNativeFocus(dialog.locator('.img-enlarge-close'));
		await gallery.evaluate((el) => {
			el.dataset.changes = '';
			el.addEventListener('img-enlarge:change', (event) => {
				el.dataset.changes += `${event.detail.index},`;
			});
		});
		const track = dialog.locator('.img-enlarge-track');
		const distance = await track.evaluate((el) => {
			const slides = el.querySelectorAll('.img-enlarge-slide');
			return (
				slides[1].getBoundingClientRect().left -
				slides[0].getBoundingClientRect().left
			);
		});
		await page.keyboard.press('ArrowRight');
		if (reduced) {
			expect(
				await dialog
					.locator(
						'.img-enlarge-slide[aria-hidden="false"] .img-enlarge-image',
					)
					.evaluate((el) => el.getAnimations().length),
			).toBe(0);
		}
		if (!reduced) {
			await expect
				.poll(
					() =>
						track.evaluate(
							(el, distance) =>
								el.scrollLeft > 0 &&
								el.scrollLeft < distance - 1,
							distance,
						),
					{ intervals: [16] },
				)
				.toBe(true);
		}
		await expect
			.poll(() => track.evaluate((el) => el.scrollLeft))
			.toBeCloseTo(distance, 0);
		await expect(gallery).toHaveAttribute('data-changes', '1,');
		const supportsExit = await page.evaluate(() =>
			CSS.supports('transition-behavior: allow-discrete'),
		);
		await page.keyboard.press('Escape');
		await expect(opener).toBeFocused();
		expect(await gallery.evaluate((el) => el.state)).toBe('ready');
		if (!reduced && supportsExit) {
			expect(await dialog.count()).toBe(1);
			const exit = await dialog.evaluate((el) => ({
				display: getComputedStyle(el).display,
				fade: el
					.getAnimations()
					.find(
						(animation) =>
							animation.transitionProperty === 'opacity',
					)
					?.effect.getKeyframes(),
			}));
			expect(exit.display).not.toBe('none');
			expect(exit.fade[0].opacity).toBe('1');
			expect(exit.fade.at(-1).opacity).toBe('0');
			expect(
				await dialog.evaluate((el) => ({
					open: el.open,
					inert: el.inert,
					hidden: el.getAttribute('aria-hidden'),
				})),
			).toEqual({ open: false, inert: true, hidden: 'true' });
		} else {
			expect(await dialog.count()).toBe(0);
		}
		await expect(dialog).toHaveCount(0);
	});
}

test('styled gallery exit cleanup survives canceled transitions and disconnection without affecting a new viewer', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await serve(page, 'buttons');
	const gallery = page.locator('#styled-gallery');
	await gallery.locator('.img-enlarge-trigger').first().click();
	await expect(gallery.locator('dialog')).toHaveCSS('opacity', '1');
	await gallery.evaluate((el) => {
		el.dataset.errors = '';
		el.addEventListener(
			'img-enlarge:error',
			(event) => (el.dataset.errors += event.detail.phase),
		);
	});
	await page.keyboard.press('Escape');
	await page.locator('#basic-image .img-enlarge-trigger').click();
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(gallery.locator('dialog')).toHaveCount(0);
	await expect(page.locator('#basic-image dialog')).toBeVisible();
	await expect(gallery).toHaveAttribute('data-errors', '');
	await page.keyboard.press('Escape');
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await gallery.locator('.img-enlarge-trigger').first().click();
	await expect(gallery.locator('dialog')).toHaveCSS('opacity', '1');
	await page.keyboard.press('Escape');
	expect(
		await gallery.evaluate((el) => {
			el.remove();
			const retained = el.querySelectorAll('dialog').length;
			document.querySelector('#gallery-styling-example .demo').append(el);
			return retained;
		}),
	).toBe(0);
	await expect(gallery.locator('.img-enlarge-trigger')).toHaveCount(2);
	await expect(gallery).toHaveAttribute('data-errors', '');
});

for (const duringScroll of [false, true]) {
	test(`styled gallery honors a rapid reversal (${duringScroll}) without another forward selection`, async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await serve(page, 'buttons');
		const gallery = page.locator('#styled-gallery');
		await gallery.locator('.img-enlarge-trigger').first().click();
		await expect(gallery.locator('dialog')).toHaveCSS('opacity', '1');
		await gallery.evaluate((el) => {
			el.dataset.changes = '';
			el.addEventListener('img-enlarge:change', (event) => {
				el.dataset.changes += `${event.detail.index},`;
			});
		});
		if (duringScroll) {
			await gallery.evaluate((el) => el.next());
			await expect
				.poll(() =>
					gallery
						.locator('.img-enlarge-track')
						.evaluate((el) => el.scrollLeft),
				)
				.toBeGreaterThan(0);
			await gallery.evaluate((el) => el.previous());
		} else {
			await gallery.evaluate((el) => {
				el.next();
				el.previous();
			});
		}
		// A canceled no-op reversal may not emit scrollend.
		await page.waitForTimeout(1000);
		await expect
			.poll(() => gallery.evaluate((el) => el._viewer.scrollTarget))
			.toBeNull();
		await expect(gallery).toHaveAttribute('data-changes', '1,0,');
		await expect(gallery.locator('[role="status"]')).toHaveText('1 of 2');
		await expect
			.poll(() =>
				gallery
					.locator('.img-enlarge-track')
					.evaluate((el) => el.scrollLeft),
			)
			.toBeCloseTo(0, 0);
	});
}

test('closing restores the replacement opener after an earlier close callback refreshes the requested wrapper', async ({
	page,
}) => {
	await serve(page, 'buttons');
	await page.evaluate(() => {
		const first = document.querySelector('#mountains');
		const second = document.querySelector('#bicycle');
		first.open();
		first.addEventListener('img-enlarge:close', () => second.refresh(), {
			once: true,
		});
		second.open();
	});
	await expect(page.locator('#bicycle dialog')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('#bicycle .img-enlarge-trigger')).toBeFocused();
});

test('opening from a previous viewer’s close callback leaves exactly one modal and restores focus', async ({
	page,
}) => {
	await serve(page, 'buttons');
	await page.locator('#mountains').evaluate((first) => {
		const second = document.querySelector('#bicycle');
		first.open();
		first.addEventListener('img-enlarge:close', () => second.open(), {
			once: true,
		});
		second.open();
	});
	await expect(page.locator('dialog')).toHaveCount(1);
	await expect(page.locator('dialog [data-action="close"]')).toBeFocused();
	await page.locator('dialog [data-action="close"]').click();
	await expect(page.locator('dialog')).toHaveCount(0);
	await expect(page.locator('#bicycle .img-enlarge-trigger')).toBeFocused();
});

test('generated image requests retain no-referrer and anonymous CORS policies before loading', async ({
	page,
}) => {
	await page.route('https://images.test/enlarged.svg', (route) =>
		route.fulfill({
			contentType: 'image/svg+xml',
			headers: { 'access-control-allow-origin': '*' },
			body: files.get('/demo/mountains-large.svg'),
		}),
	);
	await serve(page, 'buttons');
	const host = page.locator('#mountains');
	await host.evaluate((element) => {
		const original = element.querySelector('img');
		original.setAttribute('referrerpolicy', 'no-referrer');
		original.setAttribute('crossorigin', 'anonymous');
		element.setAttribute('src', 'https://images.test/enlarged.svg');
		element.refresh();
	});
	const [request] = await Promise.all([
		page.waitForRequest('https://images.test/enlarged.svg'),
		host.evaluate((element) => element.open()),
	]);
	expect(await request.headerValue('referer')).toBeNull();
	expect(await request.headerValue('origin')).toBe('http://enlarge.test');
	const image = page.locator('dialog img');
	await expect(image).toHaveAttribute('crossorigin', 'anonymous');
	await expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
	await expect
		.poll(() => image.evaluate((element) => element.naturalWidth))
		.toBeGreaterThan(0);
});

test('refresh preserves focused openers and closes viewers back to a focused replacement', async ({
	page,
}) => {
	await serve(page);
	const host = page.locator('#bicycle');
	const trigger = host.locator('.img-enlarge-trigger');
	await trigger.focus();
	await host.evaluate((element) => {
		element.querySelector('img').style.width = '2000px';
		element.querySelector('img').style.maxInlineSize = 'none';
		element.refresh();
	});
	await expect(trigger).toBeFocused();
	await host.evaluate((element) =>
		element.setAttribute('open-label', 'Inspect image'),
	);
	await expect(trigger).toBeFocused();
	await trigger.click();
	await expect(page.locator('dialog')).toBeVisible();
	await host.evaluate((element) => element.refresh());
	await expect(page.locator('dialog')).toHaveCount(0);
	await expect(trigger).toBeFocused();
	await page.locator('h1').evaluate((heading) => {
		heading.tabIndex = -1;
		heading.focus();
	});
	await expect(trigger).toHaveCount(0);
});

test('eligibility preview matches viewport modal geometry inside transformed scoped ancestors without moving focus', async ({
	page,
}) => {
	await serve(page, 'buttons');
	const host = page.locator('#bicycle');
	await host.evaluate((element) => {
		const style = document.createElement('style');
		style.textContent =
			'#bicycle .img-enlarge-dialog { --img-enlarge-dialog-padding: 4rem; }';
		document.head.append(style);
		element.style.width = '320px';
		element.style.transform = 'translateZ(0)';
		const image = element.querySelector('img');
		image.style.width = '300px';
		image.style.maxInlineSize = 'none';
		element.removeAttribute('force');
		document.querySelector('h1').tabIndex = -1;
		document.querySelector('h1').focus();
		element.refresh();
	});
	await expect(page.locator('h1')).toBeFocused();
	const trigger = host.locator('.img-enlarge-trigger');
	await expect(trigger).toBeVisible();
	await trigger.click();
	const image = page.locator('dialog img');
	await expect(image).toBeVisible();
	expect((await image.boundingBox()).width).toBeGreaterThan(300);
	await expect(page.locator('dialog')).toHaveCSS('padding-left', '64px');
	await page.keyboard.press('Escape');
	await page.locator('h1').focus();
	await host.evaluate((element) => {
		element.style.setProperty('--img-enlarge-dialog-inline-size', '260px');
		element.refresh();
	});
	await expect(trigger).toHaveCount(0);
});

for (const controls of ['auto', 'buttons']) {
	for (const direction of ['ltr', 'rtl']) {
		test(`${controls}, ${direction}: keeps neighboring slides outside the viewport at fractional widths`, async ({
			page,
		}) => {
			await serve(page, controls);
			const element = page.locator('#product-main');
			await element.evaluate(
				(node, dir) => node.setAttribute('dir', dir),
				direction,
			);
			await element.locator('.img-enlarge-trigger').click();
			for (const gap of [null, '1.5rem']) {
				await element.evaluate((node, value) => {
					if (value === null)
						node.style.removeProperty('--img-enlarge-slide-gap');
					else
						node.style.setProperty(
							'--img-enlarge-slide-gap',
							value,
						);
				}, gap);
				for (const width of ['413.5px', '730.25px']) {
					await element.evaluate(
						(node, value) =>
							node.style.setProperty(
								'--img-enlarge-dialog-inline-size',
								value,
							),
						width,
					);
					for (const index of [0, 1, 2]) {
						await element.evaluate((node) => node.previous());
						await element.evaluate((node) => node.previous());
						for (let step = 0; step < index; step += 1)
							await page.keyboard.press(
								direction === 'rtl'
									? 'ArrowLeft'
									: 'ArrowRight',
							);
						const slide = element
							.locator('.img-enlarge-slide')
							.nth(index);
						await expect(slide).toHaveAttribute(
							'aria-hidden',
							'false',
						);
						await expect
							.poll(() =>
								element.locator('dialog').evaluate((dialog) => {
									const viewport = dialog
										.querySelector('.img-enlarge-track')
										.getBoundingClientRect();
									return Math.min(
										...[
											...dialog.querySelectorAll(
												'.img-enlarge-slide[aria-hidden="true"]',
											),
										].map((other) => {
											const bounds =
												other.getBoundingClientRect();
											return Math.max(
												viewport.left - bounds.right,
												bounds.left - viewport.right,
											);
										}),
									);
								}),
							)
							.toBeGreaterThanOrEqual(gap === null ? 4 : 20);
						const offset = await slide.evaluate((node, dir) => {
							const edge = dir === 'rtl' ? 'right' : 'left';
							return Math.abs(
								node.getBoundingClientRect()[edge] -
									node.parentElement.getBoundingClientRect()[
										edge
									],
							);
						}, direction);
						expect(offset).toBeLessThanOrEqual(1);
					}
				}
			}
		});
	}
}

test('opens unnamed images independently and layers page and named gallery configuration', async ({
	page,
}) => {
	await serve(page);
	await page.evaluate(() => {
		for (const [scope, labels] of [
			['', { 'close-label': 'Close page image' }],
			['landscapes-and-bikes', { 'close-label': 'Close this gallery' }],
		]) {
			const script = document.createElement('script');
			script.type = 'application/json';
			script.dataset.imgEnlargeConfig = scope;
			script.textContent = JSON.stringify(labels);
			document.head.append(script);
		}
		for (const element of document.querySelectorAll('img-enlarge'))
			element.refresh();
	});
	const basic = page.locator('#basic-image');
	await basic.locator('.img-enlarge-trigger').click();
	await expect(page.getByRole('status')).toHaveText('1 of 1');
	await expect(basic.locator('.img-enlarge-navigation')).toBeHidden();
	await expect(
		page.getByRole('button', { name: 'Close page image' }),
	).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(page.getByRole('status')).toHaveText('1 of 1');
	await page.keyboard.press('Escape');
	await expect(basic.locator('.img-enlarge-trigger')).toBeFocused();
	await page.locator('#mountains .img-enlarge-trigger').click();
	await expect(
		page.getByRole('button', { name: 'Close this gallery' }),
	).toBeFocused();
	await expect(page.getByRole('status')).toHaveText('1 of 2');
	await page.keyboard.press('ArrowRight');
	await expect(page.getByRole('status')).toHaveText('2 of 2');
	await page.keyboard.press('Escape');
	await page.locator('#localized .img-enlarge-trigger').click();
	await expect(
		page.getByRole('button', { name: 'Fermer', exact: true }),
	).toBeFocused();
	await expect(page.getByRole('status')).toHaveText('1 sur 2');
});

async function responsiveFixture(page, srcset, sizes = '200px') {
	await serve(page);
	await page.route('http://enlarge.test/responsive-*.svg', (route) => {
		const width = Number(
			new URL(route.request().url()).pathname.match(/\d+/)[0],
		);
		return route.fulfill({
			contentType: 'image/svg+xml',
			body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width / 2}"><rect width="100%" height="100%" fill="green"/></svg>`,
		});
	});
	await page.evaluate(
		({ srcset, sizes }) => {
			const element = document.createElement('img-enlarge');
			element.id = 'inferred';
			element.style.setProperty(
				'--img-enlarge-dialog-inline-size',
				'800px',
			);
			element.style.setProperty(
				'--img-enlarge-image-max-block-size',
				'300px',
			);
			const image = document.createElement('img');
			image.alt = 'Responsive image';
			image.style.width = '200px';
			image.style.height = 'auto';
			image.sizes = sizes;
			image.srcset = srcset;
			image.src = '/responsive-400.svg';
			element.append(image);
			document.body.append(element);
		},
		{ srcset, sizes },
	);
	await expect
		.poll(() =>
			page
				.locator('#inferred > img')
				.evaluate((image) => image.naturalWidth),
		)
		.toBeGreaterThan(0);
}

test('reports a later responsive resource failure and retries after a successful load', async ({
	page,
}) => {
	await responsiveFixture(
		page,
		'/responsive-400.svg 400w, /responsive-800.svg 800w',
	);
	await page.setViewportSize({ width: 320, height: 640 });
	await page.route('http://enlarge.test/later-missing.svg', (route) =>
		route.fulfill({ status: 404, body: 'Missing image' }),
	);
	await page.locator('#inferred').evaluate((element) => {
		element.setAttribute('force', '');
		element.setAttribute(
			'srcset',
			'/responsive-800.svg 800w, /later-missing.svg 4000w',
		);
		element.setAttribute('sizes', '100vw');
		element.addEventListener('img-enlarge:error', (event) => {
			if (event.detail.phase === 'load')
				element.dataset.loadErrors = String(
					Number(element.dataset.loadErrors ?? 0) + 1,
				);
		});
	});
	await page.locator('#inferred .img-enlarge-trigger').click();
	await expect(page.getByRole('status')).toHaveText('1 of 1');
	await expect(page.locator('dialog img')).toHaveJSProperty(
		'currentSrc',
		'http://enlarge.test/responsive-800.svg',
	);
	await page.locator('dialog img').evaluate((image) => {
		image.srcset = '/later-missing.svg 4000w';
	});
	await expect(page.getByRole('status')).toContainText('could not be loaded');
	await expect(page.locator('#inferred')).toHaveAttribute(
		'data-load-errors',
		'1',
	);
	await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
	await page.route('http://enlarge.test/later-missing.svg', (route) =>
		route.fulfill({
			contentType: 'image/svg+xml',
			body: files.get('/demo/mountains-large.svg'),
		}),
	);
	await page.getByRole('button', { name: 'Try again' }).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('status')).toHaveText('1 of 1');
	await expect(
		page.getByRole('button', { name: 'Close', exact: true }),
	).toBeFocused();
});

test('uses an image link ahead of an exhausted srcset without preloading or changing navigation', async ({
	page,
}) => {
	const linkedURL = 'http://enlarge.test/demo/mountains-large.svg?linked=1';
	const requests = [];
	page.on('request', (request) => requests.push(request.url()));
	await responsiveFixture(page, '/responsive-400.svg 400w');
	const element = page.locator('#inferred');
	await element.evaluate((node) => {
		const image = node.querySelector('img');
		const link = document.createElement('a');
		link.href = '/demo/mountains-large.svg?linked=1';
		node.prepend(link);
		link.append(image);
		node.refresh();
	});
	await expect(element.locator('.img-enlarge-trigger')).toBeVisible();
	expect(requests).not.toContain(linkedURL);
	await element.locator('.img-enlarge-trigger').click();
	const enlarged = element.locator('dialog img');
	await expect(enlarged).toHaveJSProperty('currentSrc', linkedURL);
	await expect(enlarged).not.toHaveAttribute('srcset');
	await expect(element.locator('a img')).toHaveAttribute(
		'srcset',
		'/responsive-400.svg 400w',
	);
	await expect(
		page.getByRole('button', { name: 'Close', exact: true }),
	).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(element.locator('.img-enlarge-trigger')).toBeFocused();
	await element.locator('a').click();
	await expect(page).toHaveURL(linkedURL);
});

for (const descriptors of [
	'400w, /responsive-800.svg 800w, /responsive-1600.svg 1600w',
	'1x, /responsive-800.svg 2x, /responsive-1600.svg 4x',
]) {
	test(`infers responsive ${descriptors.startsWith('400w') ? 'width' : 'density'} sources without preloading and sizes them to the painted viewer image`, async ({
		page,
	}) => {
		const srcset = `/responsive-400.svg ${descriptors}`;
		const requests = [];
		page.on('request', (request) => {
			if (request.url().includes('/responsive-'))
				requests.push(new URL(request.url()).pathname);
		});
		await responsiveFixture(page, srcset);
		const element = page.locator('#inferred');
		const originalSource = await element
			.locator('> img')
			.evaluate((image) => image.currentSrc);
		expect(originalSource).toMatch(
			descriptors.startsWith('400w')
				? /responsive-400\.svg$/
				: /responsive-(400|800)\.svg$/,
		);
		await expect(element.locator('.img-enlarge-trigger')).toBeVisible();
		expect(requests.length).toBeGreaterThan(0);
		expect(
			requests.every((path) => /responsive-(400|800)\.svg$/.test(path)),
		).toBe(true);
		await element.locator('.img-enlarge-trigger').click();
		const enlarged = element.locator('dialog img');
		const density = await page.evaluate(() => devicePixelRatio);
		const expectedWidth =
			[400, 800, 1600].find((width) => width >= 600 * density) ?? 1600;
		await expect(enlarged).toHaveJSProperty(
			'currentSrc',
			`http://enlarge.test/responsive-${expectedWidth}.svg`,
		);
		await expect(enlarged).toHaveAttribute('sizes', '600px');
		await expect(element.locator('> img')).toHaveAttribute(
			'srcset',
			srcset,
		);
		await expect(element.locator('> img')).toHaveAttribute(
			'sizes',
			'200px',
		);
		await element.evaluate((node) => {
			node.style.setProperty(
				'--img-enlarge-dialog-inline-size',
				'1100px',
			);
			node.style.setProperty(
				'--img-enlarge-image-max-block-size',
				'600px',
			);
		});
		await expect(enlarged).toHaveJSProperty(
			'currentSrc',
			'http://enlarge.test/responsive-1600.svg',
		);
		const expectedSize = await enlarged.evaluate(
			(image) =>
				`${Math.ceil(Math.min(image.clientWidth, image.clientHeight * 2))}px`,
		);
		await expect(enlarged).toHaveAttribute('sizes', expectedSize);
		await page.keyboard.press('Escape');
		await expect(element.locator('dialog')).toHaveCount(0);
	});
}

test('inherits only the active picture branch and honors explicit viewer sizes', async ({
	page,
}) => {
	await responsiveFixture(
		page,
		'/responsive-400.svg 400w, /responsive-800.svg 800w',
	);
	const element = page.locator('#inferred');
	await element.evaluate((node) => {
		const image = node.querySelector('img');
		const picture = document.createElement('picture');
		const source = document.createElement('source');
		source.media = '(min-width: 40rem)';
		source.type = 'image/svg+xml';
		source.sizes = '200px';
		source.srcset =
			'/responsive-400-wide.svg 400w, /responsive-1600-wide.svg 1600w';
		picture.append(source, image);
		node.prepend(picture);
		node.setAttribute('sizes', '500px');
		node.refresh();
	});
	await expect(element.locator('picture img')).toHaveJSProperty(
		'currentSrc',
		'http://enlarge.test/responsive-400-wide.svg',
	);
	await element.locator('.img-enlarge-trigger').click();
	await expect(element.locator('dialog img')).toHaveJSProperty(
		'currentSrc',
		'http://enlarge.test/responsive-1600-wide.svg',
	);
	await expect(element.locator('dialog img')).toHaveAttribute(
		'sizes',
		'500px',
	);
	await expect(element.locator('picture img')).toHaveAttribute(
		'sizes',
		'200px',
	);
	await expect(element.locator('picture source')).toHaveAttribute(
		'media',
		'(min-width: 40rem)',
	);
});

test('suppresses inferred enlargement when the largest candidate is selected, while force and explicit enlargement still work', async ({
	page,
}) => {
	await responsiveFixture(
		page,
		'/responsive-400.svg 400w, /responsive-1600.svg 1600w',
		'1600px',
	);
	const element = page.locator('#inferred');
	await expect(element.locator('> img')).toHaveJSProperty(
		'currentSrc',
		'http://enlarge.test/responsive-1600.svg',
	);
	await expect
		.poll(() => element.evaluate((node) => node.state))
		.toBe('inactive');
	await expect(element.locator('.img-enlarge-trigger')).toHaveCount(0);
	await element.evaluate((node) => node.setAttribute('force', ''));
	await element.locator('.img-enlarge-trigger').click();
	await expect(element.locator('dialog')).toBeVisible();
	await page.keyboard.press('Escape');
	await element.evaluate((node) => {
		node.removeAttribute('force');
		node.setAttribute('src', '/responsive-800.svg');
	});
	await element.locator('.img-enlarge-trigger').click();
	await expect(element.locator('dialog img')).not.toHaveAttribute(
		'srcset',
		/./,
	);
	await expect(element.locator('dialog img')).toHaveJSProperty(
		'currentSrc',
		'http://enlarge.test/responsive-800.svg',
	);
});

for (const controls of ['auto', 'buttons']) {
	test(`${controls}: shares language dictionaries and regional fallbacks across a translated collection`, async ({
		page,
	}) => {
		await serve(page, controls);
		const trigger = page.locator('#localized .img-enlarge-trigger');
		await expect(trigger).toHaveAccessibleName('Agrandir le paysage');
		await expect(
			page.locator('#localized-detail .img-enlarge-trigger'),
		).toHaveAccessibleName(
			'Agrandir la photo : Un vélo rouge avec un panier.',
		);
		await trigger.click();
		const dialog = page.getByRole('dialog', { name: 'Images agrandies' });
		await expect(dialog).toHaveAttribute('lang', 'fr-CA');
		await expect(
			dialog.getByRole('button', { name: 'Fermer', exact: true }),
		).toBeFocused();
		await expect(dialog.getByRole('status')).toHaveText('1 sur 2');
		await page.keyboard.press('ArrowRight');
		await expect(dialog.getByRole('status')).toHaveText('2 sur 2');
		if ((await dialog.getAttribute('data-controls')) === 'css') {
			expect(
				await dialog
					.locator('[data-track]')
					.evaluate(
						(track) =>
							getComputedStyle(
								track,
								'::scroll-button(inline-start)',
							).content,
					),
			).toContain('Image précédente');
		} else {
			await expect(
				dialog.getByRole('button', { name: 'Image précédente' }),
			).toBeVisible();
		}
		await page.keyboard.press('Escape');
		await expect(trigger).toBeFocused();
	});

	test(`${controls}: modal keyboard navigation, boundaries, and focus restoration`, async ({
		page,
		browserName,
	}) => {
		await serve(page, controls);
		const trigger = page.locator('#mountains .img-enlarge-trigger');
		await trigger.focus();
		await page.keyboard.press('Enter');
		const dialog = page.getByRole('dialog', { name: 'Enlarged images' });
		await expect(dialog).toBeVisible();
		await expect(
			dialog.getByRole('button', { name: 'Close', exact: true }),
		).toBeFocused();
		await expect(dialog.getByRole('status')).toHaveText('1 of 2');
		const expectedMode = await page.evaluate(
			() =>
				CSS.supports('selector(::scroll-button(inline-start))') &&
				CSS.supports('content', '"x" / attr(data-previous-label)'),
		);
		await expect(dialog).toHaveAttribute(
			'data-controls',
			controls === 'auto' && expectedMode ? 'css' : 'buttons',
		);
		await page.keyboard.press('ArrowRight');
		await expect(dialog.getByRole('status')).toHaveText('2 of 2');
		await page.keyboard.press('ArrowRight');
		await expect(dialog.getByRole('status')).toHaveText('2 of 2');
		await page.keyboard.press('ArrowLeft');
		await expect(dialog.getByRole('status')).toHaveText('1 of 2');
		if (controls === 'buttons') {
			await expect(
				dialog.getByRole('button', { name: 'Previous image' }),
			).toHaveAttribute('aria-disabled', 'true');
			await dialog.getByRole('button', { name: 'Next image' }).focus();
			await page.keyboard.press('Enter');
			await expect(
				dialog.getByRole('button', { name: 'Next image' }),
			).toBeFocused();
			await expect(dialog.getByRole('status')).toHaveText('2 of 2');
		} else if (expectedMode) {
			if (browserName === 'chromium') {
				// Playwright's DOM-based snapshot omits CSS-generated controls.
				const session = await page.context().newCDPSession(page);
				const { nodes } = await session.send(
					'Accessibility.getFullAXTree',
				);
				const buttons = nodes.filter(
					(node) => !node.ignored && node.role?.value === 'button',
				);
				expect(buttons.map((node) => node.name?.value)).toEqual(
					expect.arrayContaining(['Previous image', 'Next image']),
				);
				await expect
					.poll(async () => {
						const tree = await session.send(
							'Accessibility.getFullAXTree',
						);
						return tree.nodes
							.filter(
								(node) =>
									!node.ignored &&
									node.role?.value === 'button',
							)
							.map((node) => ({
								name: node.name?.value,
								disabled:
									node.properties?.some(
										(property) =>
											property.name === 'disabled' &&
											property.value.value === true,
									) ?? false,
							}));
					})
					.toEqual(
						expect.arrayContaining([
							{ name: 'Previous image', disabled: true },
							{ name: 'Next image', disabled: false },
						]),
					);
				await dialog
					.getByRole('button', { name: 'Close', exact: true })
					.focus();
				let nextFocused = false;
				for (let attempt = 0; attempt < 6; attempt += 1) {
					await page.keyboard.press('Tab');
					const tree = await session.send(
						'Accessibility.getFullAXTree',
					);
					nextFocused = tree.nodes.some(
						(node) =>
							node.name?.value === 'Next image' &&
							node.properties?.some(
								(property) =>
									property.name === 'focused' &&
									property.value.value === true,
							),
					);
					if (nextFocused) break;
				}
				await session.detach();
				expect(nextFocused).toBe(true);
				await page.keyboard.press('Enter');
				await expect(dialog.getByRole('status')).toHaveText('2 of 2');
			}
		}
		for (let index = 0; index < 6; index += 1) {
			await page.keyboard.press('Tab');
			// Native modal traversal may visit browser chrome, but not background controls.
			expect(
				await dialog.evaluate(
					(node) =>
						document.activeElement === document.body ||
						node.contains(document.activeElement),
				),
			).toBe(true);
		}
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		await expect(trigger).toBeFocused();
	});

	test(`${controls}: close and arrow icons share the enlarge icon size`, async ({
		page,
	}) => {
		await serve(page, controls);
		const trigger = page.locator('#mountains .img-enlarge-trigger');
		const size = await trigger.evaluate(
			(button) => getComputedStyle(button).fontSize,
		);
		await trigger.click();
		const dialog = page.getByRole('dialog', { name: 'Enlarged images' });
		await expect(
			dialog
				.getByRole('button', { name: 'Close', exact: true })
				.locator('span'),
		).toHaveCSS('font-size', size);
		const arrows = await dialog.evaluate((element) => {
			if (element.dataset.controls === 'css') {
				const track = element.querySelector('[data-track]');
				return ['inline-start', 'inline-end'].map(
					(direction) =>
						getComputedStyle(track, `::scroll-button(${direction})`)
							.fontSize,
				);
			}
			return ['previous', 'next'].map(
				(action) =>
					getComputedStyle(
						element.querySelector(`[data-action="${action}"] span`),
					).fontSize,
			);
		});
		expect(arrows).toEqual([size, size]);
	});

	test(`${controls}: uses system colors for disabled navigation at both boundaries`, async ({
		page,
		browserName,
	}) => {
		await serve(page, controls);
		await page.locator('#mountains .img-enlarge-trigger').click();
		await expect(page.getByRole('status')).toHaveText('1 of 2');
		const colors = () =>
			page.locator('dialog').evaluate((dialog) => {
				const read = (element, pseudo) => {
					const style = getComputedStyle(element, pseudo);
					return {
						color: style.color,
						border: style.borderTopColor,
						background: style.backgroundColor,
					};
				};
				const probe = document.createElement('span');
				Object.assign(probe.style, {
					position: 'absolute',
					forcedColorAdjust: 'none',
					color: 'GrayText',
					border: '1px solid GrayText',
					background: 'ButtonFace',
				});
				dialog.append(probe);
				const disabled = read(probe);
				probe.style.color = 'ButtonText';
				probe.style.borderColor = 'ButtonBorder';
				const enabled = read(probe);
				probe.remove();
				const native = dialog.dataset.controls === 'css';
				const track = dialog.querySelector('[data-track]');
				return {
					disabled,
					enabled,
					previous: native
						? read(track, '::scroll-button(inline-start)')
						: read(
								dialog.querySelector(
									'[data-action="previous"]',
								),
							),
					next: native
						? read(track, '::scroll-button(inline-end)')
						: read(dialog.querySelector('[data-action="next"]')),
				};
			});
		const palettes = [
			{ colorScheme: 'light', forcedColors: 'none' },
			{ colorScheme: 'dark', forcedColors: 'none' },
		];
		if (browserName !== 'webkit')
			palettes.push({ colorScheme: 'light', forcedColors: 'active' });
		for (const palette of palettes) {
			await page.emulateMedia(palette);
			const { disabled, enabled } = await colors();
			await page.keyboard.press('ArrowLeft');
			await expect(page.getByRole('status')).toHaveText('1 of 2');
			await expect
				.poll(async () => {
					const sample = await colors();
					return { previous: sample.previous, next: sample.next };
				})
				.toEqual({ previous: disabled, next: enabled });
			await page.keyboard.press('ArrowRight');
			await expect(page.getByRole('status')).toHaveText('2 of 2');
			await expect
				.poll(async () => {
					const sample = await colors();
					return { previous: sample.previous, next: sample.next };
				})
				.toEqual({ previous: enabled, next: disabled });
		}
	});
}

test('preserves image links, demonstrates explicit JavaScript collection controls, and supports failure recovery', async ({
	page,
}) => {
	await serve(page);
	await expect(page.locator('#mountains a')).toHaveAttribute(
		'href',
		'./mountains-large.svg',
	);
	await page.locator('#grouped .img-enlarge-trigger').click();
	await expect(page.locator('dialog')).toHaveAttribute(
		'data-controls',
		'buttons',
	);
	await expect(page.getByRole('status')).toHaveText('1 of 2');
	await expect(
		page.getByRole('button', { name: 'Previous image' }),
	).toBeVisible();
	await page.getByRole('button', { name: 'Next image' }).click();
	await expect(page.getByRole('status')).toHaveText('2 of 2');
	await expect(
		page.locator('dialog .img-enlarge-slide[aria-hidden="false"] img'),
	).toHaveAttribute('alt', 'A woven basket above the front wheel.');
	await page.keyboard.press('Escape');
	await addFailureFixture(page);
	await page.locator('#failure .img-enlarge-trigger').click();
	await expect(page.getByRole('status')).toContainText('could not be loaded');
	await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByRole('status')).toContainText('could not be loaded');
	await page.getByRole('button', { name: 'Close', exact: true }).click();
	await expect(page.locator('#failure .img-enlarge-trigger')).toBeFocused();
});

test('uses flat page labels without language-code keys and refreshes edited JSON without inserting HTML', async ({
	page,
}) => {
	await serve(page);
	await page.goto('http://enlarge.test/demo/labels-flat.html');
	const trigger = page.locator('#flat-first .img-enlarge-trigger');
	await expect(trigger).toHaveAccessibleName(
		'Agrandir l’image : Un vélo rouge avec un panier.',
	);
	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Images agrandies' });
	await expect(dialog).toHaveAttribute('lang', 'fr');
	await expect(
		dialog.getByRole('button', { name: 'Fermer', exact: true }),
	).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(dialog.getByRole('status')).toHaveText('2 sur 2');
	await page.keyboard.press('Escape');
	await page.locator('#flat-first').evaluate((element) => {
		const script = document.querySelector(
			'script[data-img-enlarge-config]',
		);
		const labels = JSON.parse(script.textContent);
		labels['close-label'] = '<b>Fermer</b>';
		script.textContent = JSON.stringify(labels);
		element.refresh();
	});
	await trigger.click();
	await expect(
		page.getByRole('button', { name: '<b>Fermer</b>', exact: true }),
	).toBeFocused();
	await expect(page.locator('dialog b')).toHaveCount(0);
});

test('keeps the original linked image usable without JavaScript', async ({
	browser,
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	try {
		const page = await context.newPage();
		await serve(page, 'auto', false);
		await expect(page.locator('#mountains img')).toBeVisible();
		await expect(page.locator('img-enlarge button')).toHaveCount(0);
		await page.locator('#mountains a').click();
		await expect(page).toHaveURL(
			'http://enlarge.test/demo/mountains-large.svg',
		);
	} finally {
		await context.close();
	}
});

test('fits a narrow viewport and respects reduced motion and forced colors', async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 640 });
	await page.emulateMedia({
		reducedMotion: 'reduce',
		forcedColors: 'active',
	});
	await serve(page, 'buttons', false);
	await page.locator('#mountains, #bicycle').evaluateAll((elements) => {
		for (const element of elements) element.setAttribute('force', '');
	});
	await page.locator('#mountains .img-enlarge-trigger').click();
	await expect(page.getByRole('status')).toHaveText('1 of 2');
	const geometry = await page.locator('dialog').evaluate((dialog) => ({
		width: dialog.getBoundingClientRect().width,
		scrollWidth: document.documentElement.scrollWidth,
		behavior: getComputedStyle(dialog.querySelector('[data-track]'))
			.scrollBehavior,
	}));
	expect(geometry.width).toBeLessThanOrEqual(320);
	expect(geometry.scrollWidth).toBeLessThanOrEqual(320);
	expect(geometry.behavior).toBe('auto');
});

test('preserves the image box through failure and retry, then uses the recovered image proportions', async ({
	page,
}) => {
	await serve(page);
	let releaseFailure;
	const failure = new Promise((resolve) => {
		releaseFailure = resolve;
	});
	let releaseRecovery;
	const recovery = new Promise((resolve) => {
		releaseRecovery = resolve;
	});
	let attempts = 0;
	await page.route('http://enlarge.test/recover-image.svg', async (route) => {
		attempts += 1;
		if (attempts === 1) {
			await failure;
			await route.fulfill({ status: 404, body: 'Not found' });
		} else {
			await recovery;
			await route.fulfill({
				contentType: 'image/svg+xml',
				body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200"><rect width="100%" height="100%" fill="green"/></svg>',
			});
		}
	});
	await addFailureFixture(page);
	const element = page.locator('#failure');
	await element.evaluate((node) => {
		node.setAttribute('src', '/recover-image.svg');
		node.setAttribute('force', '');
		node.style.setProperty('--img-enlarge-dialog-inline-size', '600px');
		node.style.setProperty('--img-enlarge-image-max-block-size', '200px');
	});
	try {
		await element.locator('.img-enlarge-trigger').click();
		const image = element.locator('dialog img');
		await expect(page.getByRole('status')).toContainText('Loading image');
		const loading = await image.boundingBox();
		expect(loading.height).toBeGreaterThan(100);
		expect(loading.height).toBeCloseTo(Math.min(loading.width / 2, 200), 0);
		releaseFailure();
		await expect(page.getByRole('status')).toContainText(
			'could not be loaded',
		);
		await expect(image).toBeVisible();
		await expect(image).toHaveAttribute(
			'alt',
			'A trail through green mountains.',
		);
		await expect(image).toHaveJSProperty('naturalWidth', 0);
		const failed = await image.boundingBox();
		expect(failed.width).toBeCloseTo(loading.width, 0);
		expect(failed.height).toBeCloseTo(loading.height, 0);
		await page.getByRole('button', { name: 'Try again' }).focus();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('status')).toContainText('Loading image');
		const retrying = await image.boundingBox();
		expect(retrying.height).toBeCloseTo(loading.height, 0);
		await expect(
			page.getByRole('button', { name: 'Close', exact: true }),
		).toBeFocused();
		releaseRecovery();
		await expect(page.getByRole('status')).toHaveText('1 of 1');
		const loaded = await image.boundingBox();
		expect(loaded.height).toBeCloseTo(loaded.width / 4, 0);
		await expect(
			page.getByRole('button', { name: 'Try again' }),
		).toBeHidden();
		await page.keyboard.press('Escape');
		await expect(element.locator('.img-enlarge-trigger')).toBeFocused();
	} finally {
		releaseFailure();
		releaseRecovery();
	}
});

test('loads only visited enlarged images and keeps pending loads dismissible', async ({
	page,
}) => {
	await serve(page, 'buttons');
	const requested = [];
	page.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith('/enlarged-')) requested.push(path);
	});
	await page.route('http://enlarge.test/enlarged-*.svg', (route) =>
		route.fulfill({
			contentType: 'image/svg+xml',
			body: files.get('/demo/bicycle.svg'),
		}),
	);
	await page
		.locator('#mountains')
		.evaluate((element) =>
			element.setAttribute('src', '/enlarged-one.svg'),
		);
	await page
		.locator('#bicycle')
		.evaluate((element) =>
			element.setAttribute('src', '/enlarged-two.svg'),
		);
	await page.locator('#mountains .img-enlarge-trigger').click();
	await expect(page.getByRole('status')).toHaveText('1 of 2');
	expect(requested).toEqual(['/enlarged-one.svg']);
	await page.getByRole('button', { name: 'Next image' }).click();
	await expect(page.getByRole('status')).toHaveText('2 of 2');
	expect(requested).toEqual(['/enlarged-one.svg', '/enlarged-two.svg']);
	await page.keyboard.press('Escape');

	let release;
	const pending = new Promise((resolve) => {
		release = resolve;
	});
	await page.route('http://enlarge.test/pending.svg', async (route) => {
		await pending;
		await route.fulfill({
			contentType: 'image/svg+xml',
			body: files.get('/demo/bicycle.svg'),
		});
	});
	await page
		.locator('#mountains')
		.evaluate((element) => element.setAttribute('src', '/pending.svg'));
	await page.locator('#mountains .img-enlarge-trigger').click();
	await expect(page.getByRole('status')).toContainText('Loading image');
	await page.keyboard.press('Escape');
	release();
	await expect(page.locator('dialog')).toHaveCount(0);
	await expect(page.locator('#mountains .img-enlarge-trigger')).toBeFocused();
});

test('supports right-to-left navigation and translated generated-control names', async ({
	page,
}) => {
	await serve(page);
	await page.locator('#mountains').evaluate((element) => {
		element.dir = 'rtl';
		element.lang = 'ar';
		element.setAttribute('previous-label', 'السابق');
		element.setAttribute('next-label', 'التالي');
	});
	await page.locator('#mountains .img-enlarge-trigger').click();
	await expect(page.locator('dialog')).toHaveAttribute('dir', 'rtl');
	await expect(page.locator('dialog')).toHaveAttribute('lang', 'ar');
	await page.keyboard.press('ArrowLeft');
	await expect(page.getByRole('status')).toHaveText('2 of 2');
	await page.keyboard.press('ArrowRight');
	await expect(page.getByRole('status')).toHaveText('1 of 2');
	const native =
		(await page.locator('dialog').getAttribute('data-controls')) === 'css';
	if (native) {
		expect(
			await page
				.locator('[data-track]')
				.evaluate(
					(track) =>
						getComputedStyle(track, '::scroll-button(inline-end)')
							.content,
				),
		).toContain('التالي');
	} else {
		await expect(
			page.getByRole('button', { name: 'التالي' }),
		).toBeVisible();
	}
});

test('does not request a separate component stylesheet', async ({ page }) => {
	const stylesheets = [];
	page.on('request', (request) => {
		if (request.resourceType() === 'stylesheet')
			stylesheets.push(new URL(request.url()).pathname);
	});
	await serve(page);
	expect(stylesheets.sort()).toEqual([
		'/demo/demo-shell.css',
		'/demo/styles.css',
	]);
});

test('carries styles without an author stylesheet link and positions icon controls over the image and dialog', async ({
	page,
}) => {
	await serve(page);
	await page.route('http://enlarge.test/demo/index.html', (route) =>
		route.fulfill({
			contentType: 'text/html',
			body: files
				.get('/demo/index.html')
				.replace(
					'<link rel="stylesheet" href="../img-enlarge.css" />',
					'',
				),
		}),
	);
	await page.reload();
	await page
		.locator('#mountains')
		.evaluate((element) => element.setAttribute('controls', 'buttons'));
	const trigger = page.locator('#mountains .img-enlarge-trigger');
	await expect(trigger).toHaveAccessibleName(
		'Enlarge image: A trail between two green mountains beneath a golden sun.',
	);
	const imageBox = await page
		.locator('#mountains > figure img')
		.boundingBox();
	const triggerBox = await trigger.boundingBox();
	expect(triggerBox.y).toBeGreaterThanOrEqual(imageBox.y);
	expect(triggerBox.y + triggerBox.height).toBeLessThan(
		imageBox.y + imageBox.height,
	);
	expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(
		imageBox.x + imageBox.width,
	);
	expect(
		imageBox.x + imageBox.width - triggerBox.x - triggerBox.width,
	).toBeCloseTo(8, 0);
	expect(await trigger.textContent()).toBe('⤢');
	await trigger.click();
	const dialog = page.locator('#mountains .img-enlarge-dialog');
	const box = await dialog.boundingBox();
	const close = dialog.getByRole('button', { name: 'Close', exact: true });
	expect(await close.textContent()).toBe('×');
	const closeBox = await close.boundingBox();
	expect(closeBox.x).toBeGreaterThan(box.x + box.width / 2);
	expect(closeBox.y).toBeLessThan(box.y + box.height / 2);
	const previous = await dialog
		.getByRole('button', { name: 'Previous image' })
		.boundingBox();
	const next = await dialog
		.getByRole('button', { name: 'Next image' })
		.boundingBox();
	expect(previous.x).toBeLessThan(box.x + box.width / 4);
	expect(next.x).toBeGreaterThan(box.x + (box.width * 3) / 4);
	expect(previous.y).toBeCloseTo(next.y, 0);
});

test('suppresses equal-size enlargement, responds to image/container and viewport changes, and supports force', async ({
	page,
}) => {
	await serve(page);
	await page.evaluate(() => {
		const element = document.createElement('img-enlarge');
		element.id = 'responsive';
		element.setAttribute('force', '');
		const image = document.createElement('img');
		image.src = './mountains.svg';
		image.alt = 'Responsive trail';
		image.style.width = '120px';
		image.style.height = 'auto';
		element.append(image);
		document.body.append(element);
	});
	const element = page.locator('#responsive');
	const trigger = element.locator('.img-enlarge-trigger');
	await trigger.click();
	await expect(page.getByRole('status')).toHaveText('1 of 1');
	const painted = await page.locator('dialog img').evaluate((image) => {
		const box = image.getBoundingClientRect();
		const scale = Math.min(
			box.width / image.naturalWidth,
			box.height / image.naturalHeight,
		);
		return {
			width: image.naturalWidth * scale,
			height: image.naturalHeight * scale,
		};
	});
	await page.keyboard.press('Escape');
	await element.evaluate((node, size) => {
		const heading = document.querySelector('h1');
		heading.tabIndex = -1;
		heading.focus();
		node.querySelector('img').style.width = `${size.width}px`;
		node.removeAttribute('force');
	}, painted);
	await expect(trigger).toHaveCount(0);
	await element.locator('img').evaluate((image) => {
		image.style.width = '120px';
	});
	await expect(trigger).toBeVisible();
	await page.setViewportSize({ width: 320, height: 640 });
	await element.locator('img').evaluate((image) => {
		image.style.width = '280px';
	});
	await expect(trigger).toHaveCount(0);
	await element.evaluate((node) => node.setAttribute('force', ''));
	await expect(trigger).toBeVisible();
});

test('demonstrates scoped layout/caption overrides and independent product image groups', async ({
	page,
}) => {
	await serve(page, 'buttons');
	await page.locator('#styled .img-enlarge-trigger').click();
	const dialog = page.locator('#styled .img-enlarge-dialog');
	await expect(dialog).toBeVisible();
	const layout = await dialog.evaluate((node) => ({
		padding: getComputedStyle(node).paddingInlineStart,
		gap: getComputedStyle(node.querySelector('figcaption'))
			.marginBlockStart,
		columns: getComputedStyle(
			node.querySelector('figure'),
		).gridTemplateColumns.split(' ').length,
	}));
	expect(layout.padding).toBe('64px');
	expect(layout.gap).toBe('24px');
	expect(layout.columns).toBe(2);
	await page.keyboard.press('Escape');
	await page.locator('#product-main .img-enlarge-trigger').click();
	await expect(page.getByRole('status')).toHaveText('1 of 3');
	await page.getByRole('button', { name: 'Next image' }).click();
	await expect(page.getByRole('status')).toHaveText('2 of 3');
	await expect(
		page.locator(
			'dialog .img-enlarge-slide[aria-hidden="false"] figcaption',
		),
	).toContainText('basket');
	await page.keyboard.press('Escape');
	await page.locator('#basic-image .img-enlarge-trigger').click();
	await expect(page.getByRole('status')).toHaveText('1 of 1');
});

test('recovers from a blocked bundled stylesheet when an allowed nonce is supplied', async ({
	page,
}) => {
	await serve(page);
	await page.route('http://enlarge.test/demo/index.html', (route) =>
		route.fulfill({
			contentType: 'text/html',
			headers: {
				'Content-Security-Policy':
					"style-src 'self' 'nonce-viewer-test'",
			},
			body: files.get('/demo/index.html'),
		}),
	);
	await page.reload();
	await expect(page.locator('#mountains .img-enlarge-trigger')).toHaveCount(
		0,
	);
	expect(
		await page.locator('#mountains').evaluate((element) => element.state),
	).toBe('error');
	await page.locator('#mountains').evaluate((element) => {
		element.nonce = 'viewer-test';
		element.refresh();
	});
	await expect(page.locator('#mountains .img-enlarge-trigger')).toBeVisible();
	await page.locator('#mountains .img-enlarge-trigger').click();
	await expect(page.locator('dialog')).toBeVisible();
});

test('positions the opener precisely on fractional hosts with padding, borders, and scaling', async ({
	page,
}) => {
	await serve(page, 'buttons');
	const host = page.locator('#bicycle');
	await host.evaluate((element) => {
		element.setAttribute('force', '');
		Object.assign(element.style, {
			width: '333.3px',
			height: '200.75px',
			padding: '11.25px',
			border: '3px solid',
		});
		Object.assign(element.querySelector('img').style, {
			maxInlineSize: 'none',
			width: '250.25px',
		});
	});
	for (const boxSizing of ['content-box', 'border-box']) {
		for (const scale of [1, 1.25]) {
			await host.evaluate(
				(element, { boxSizing, scale }) => {
					element.style.boxSizing = boxSizing;
					element.style.transform = `scale(${scale})`;
					element.refresh();
				},
				{ boxSizing, scale },
			);
			await expect
				.poll(async () =>
					host.evaluate((element, scale) => {
						const image = element
							.querySelector('img')
							.getBoundingClientRect();
						const trigger = element
							.querySelector('button')
							.getBoundingClientRect();
						const anchor = element
							.querySelector('.img-enlarge-anchor')
							.getBoundingClientRect();
						return Math.max(
							Math.abs(anchor.x - image.x),
							Math.abs(anchor.y - image.y),
							Math.abs(anchor.width - image.width),
							Math.abs(anchor.height - image.height),
							Math.abs(image.right - trigger.right - scale * 8),
						);
					}, scale),
				)
				.toBeLessThan(0.05);
		}
	}
});

test('retains the focused opener through resizing and removes it after focus leaves', async ({
	page,
}) => {
	await serve(page);
	await page.locator('#bicycle .img-enlarge-trigger').focus();
	await page.locator('#bicycle > img').evaluate((image) => {
		image.style.maxInlineSize = 'none';
		image.style.width = '2000px';
	});
	await expect
		.poll(async () => {
			const image = await page.locator('#bicycle > img').boundingBox();
			const trigger = await page
				.locator('#bicycle .img-enlarge-trigger')
				.boundingBox();
			return Math.round(
				image.x + image.width - trigger.x - trigger.width,
			);
		})
		.toBe(8);
	await expect(page.locator('#bicycle .img-enlarge-trigger')).toBeFocused();
	await page.locator('h1').evaluate((heading) => {
		heading.tabIndex = -1;
		heading.focus();
	});
	await expect(page.locator('#bicycle .img-enlarge-trigger')).toHaveCount(0);
});

test('keeps grouped product images in navigation when only their entry button is suppressed', async ({
	page,
}) => {
	await page.setViewportSize({ width: 640, height: 800 });
	await serve(page, 'buttons', false);
	await expect(
		page.locator('#product-main .img-enlarge-trigger'),
	).toHaveCount(0);
	await page
		.locator('.product-gallery img-enlarge')
		.nth(1)
		.locator('.img-enlarge-trigger')
		.click();
	await expect(page.getByRole('status')).toHaveText('2 of 3');
	await page.getByRole('button', { name: 'Previous image' }).click();
	await expect(page.getByRole('status')).toHaveText('1 of 3');
	await expect(
		page.locator('dialog .img-enlarge-slide[aria-hidden="false"] img'),
	).toHaveAttribute('alt', 'A red city bicycle with a basket.');
});

for (const controls of ['auto', 'buttons']) {
	test(`${controls}: controls disabled arrow visibility with a custom property without losing focus`, async ({
		page,
	}) => {
		await serve(page, controls);
		await page.locator('#hide-disabled-first .img-enlarge-trigger').click();
		await expect(page.getByRole('status')).toHaveText('1 of 2');
		const visibility = () =>
			page.locator('dialog').evaluate((dialog) => {
				const track = dialog.querySelector('[data-track]');
				const native = dialog.dataset.controls === 'css';
				return {
					previous: native
						? getComputedStyle(
								track,
								'::scroll-button(inline-start)',
							).visibility
						: getComputedStyle(
								dialog.querySelector(
									'[data-action="previous"]',
								),
							).visibility,
					next: native
						? getComputedStyle(track, '::scroll-button(inline-end)')
								.visibility
						: getComputedStyle(
								dialog.querySelector('[data-action="next"]'),
							).visibility,
					width: track.getBoundingClientRect().width,
				};
			});
		await expect
			.poll(visibility)
			.toMatchObject({ previous: 'hidden', next: 'visible' });
		const first = await visibility();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('status')).toHaveText('2 of 2');
		await expect.poll(visibility).toEqual({
			previous: 'visible',
			next: 'hidden',
			width: first.width,
		});
		if (
			(await page.locator('dialog').getAttribute('data-controls')) ===
			'buttons'
		) {
			await page.keyboard.press('ArrowLeft');
			const next = page.getByRole('button', { name: 'Next image' });
			await next.focus();
			await page.keyboard.press('Enter');
			await expect(page.getByRole('status')).toHaveText('2 of 2');
			await expect(next).toBeFocused();
			await expect(next).toBeVisible();
			await page
				.getByRole('button', { name: 'Close', exact: true })
				.focus();
			await expect(next).toBeHidden();
		}
		const host = page.locator('#hide-disabled-first');
		await host.evaluate((element) =>
			element.classList.remove('hide-disabled'),
		);
		await expect.poll(visibility).toEqual({
			previous: 'visible',
			next: 'visible',
			width: first.width,
		});
		await host.evaluate((element) =>
			element.style.setProperty('--disabled-button-visibility', 'hidden'),
		);
		await expect.poll(visibility).toEqual({
			previous: 'visible',
			next: 'hidden',
			width: first.width,
		});
		await host.evaluate((element) =>
			element.style.setProperty(
				'--disabled-button-visibility',
				'visible',
			),
		);
		await expect.poll(visibility).toEqual({
			previous: 'visible',
			next: 'visible',
			width: first.width,
		});
		await page.keyboard.press('Escape');
		await expect(
			page.locator('#hide-disabled-first .img-enlarge-trigger'),
		).toBeFocused();
	});
}
