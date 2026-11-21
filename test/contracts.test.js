import { afterEach, expect, it } from 'vitest';
import {
	readFile,
	mkdir,
	writeFile,
	copyFile,
	symlink,
	readdir,
	rm,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ImgEnlargeElement } from '../img-enlarge.js';
import { styles } from '../img-enlarge-styles.js';

it('trims block-edge margins inside demo sections', async () => {
	const css = await readFile('demo/demo-shell.css', 'utf8');
	expect(css).toMatch(
		/\.demo-section(?:,\s*\.api-reference)?\s*\{[^}]*\bmargin-trim:\s*block;/,
	);
});

let fixture;
afterEach(async () => {
	if (fixture) await rm(fixture, { recursive: true, force: true });
	fixture = undefined;
});

it('allows class-only and registration imports without a browser registry', () => {
	const entry = pathToFileURL(resolve('index.js')).href;
	const definition = pathToFileURL(resolve('define.js')).href;
	const result = execFileSync(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`const { ImgEnlargeElement } = await import(${JSON.stringify(entry)}); const { defineImgEnlarge } = await import(${JSON.stringify(definition)}); console.log(JSON.stringify([typeof ImgEnlargeElement, defineImgEnlarge()]));`,
		],
		{ encoding: 'utf8' },
	);
	expect(JSON.parse(result)).toEqual(['function', false]);
});

it('keeps manifest configuration and published entry points aligned', async () => {
	const manifest = JSON.parse(await readFile('custom-elements.json', 'utf8'));
	const component = manifest.modules[0].declarations[0];
	expect(component.cssProperties.map(({ name }) => name).sort()).toEqual(
		[...new Set(styles.match(/--[a-z][a-z-]+/g))].sort(),
	);
	expect(component.attributes.map(({ name }) => name).sort()).toEqual(
		[...ImgEnlargeElement.observedAttributes].sort(),
	);
	expect(
		component.members
			.filter(({ kind }) => kind === 'method')
			.map(({ name }) => name)
			.sort(),
	).toEqual(['close', 'next', 'open', 'previous', 'refresh']);
	const pkg = JSON.parse(await readFile('package.json', 'utf8'));
	const packed = JSON.parse(
		execFileSync(
			'npm',
			['pack', '--dry-run', '--json', '--ignore-scripts'],
			{ encoding: 'utf8' },
		),
	)[0];
	const files = packed.files.map(({ path }) => path);
	for (const file of [
		'img-enlarge-styles.js',
		'img-enlarge.js',
		'img-enlarge.d.ts',
		'index.js',
		'define.js',
		'define.d.ts',
		'custom-elements.json',
	]) {
		expect(files).toContain(file);
	}
	expect(
		files.some((path) => /^(test|demo|scripts|node_modules)\//.test(path)),
	).toBe(false);
	const types = await readFile(pkg.types, 'utf8');
	for (const event of component.events)
		expect(types).toContain(`'${event.name}'`);
});

it('retains the versioned demo updater and release staging/push hooks without running a release', async () => {
	const pkg = JSON.parse(await readFile('package.json', 'utf8'));
	expect(pkg.scripts.version).toBe(
		'node scripts/update-demo-versions.js && git add demo/esm.html',
	);
	expect(pkg.scripts.postversion).toBe('git push --follow-tags');
	fixture = resolve(`.test-version-${randomUUID()}`);
	await mkdir(fixture);
	await mkdir(join(fixture, 'scripts'));
	await mkdir(join(fixture, 'demo'));
	await writeFile(
		join(fixture, 'package.json'),
		JSON.stringify({ name: pkg.name, version: '9.8.7' }),
	);
	await copyFile(
		'scripts/update-demo-versions.js',
		join(fixture, 'scripts/update-demo-versions.mjs'),
	);
	await copyFile('demo/esm.html', join(fixture, 'demo/esm.html'));
	execFileSync(process.execPath, [
		join(fixture, 'scripts/update-demo-versions.mjs'),
	]);
	for (const version of ['9.8.7-beta.0+build.1', '9.8.7-rc.2', '9.8.7']) {
		await writeFile(
			join(fixture, 'package.json'),
			JSON.stringify({ name: pkg.name, version }),
		);
		execFileSync(process.execPath, [
			join(fixture, 'scripts/update-demo-versions.mjs'),
		]);
		const demo = await readFile(join(fixture, 'demo/esm.html'), 'utf8');
		expect(demo.split(`${pkg.name}@${version}/`)).toHaveLength(3);
	}
});

it('builds a self-contained Pages artifact without uploading development files', async () => {
	const workflow = await readFile('.github/workflows/pages.yml', 'utf8');
	const build = workflow.match(
		/- name: Build Pages\s+run: \|\n([\s\S]+?)\n\s+- name: Setup Pages/,
	)?.[1];
	expect(build).toBeTruthy();
	fixture = resolve(`.test-pages-${randomUUID()}`);
	await mkdir(fixture);
	await mkdir(join(fixture, 'demo'));
	for (const file of [
		'README.md',
		'LICENSE',
		'img-enlarge.js',
		'img-enlarge-styles.js',
		'define.js',
		'index.js',
		'package.json',
	]) {
		await copyFile(file, join(fixture, file));
	}
	for (const file of ['index.html', 'esm.html', 'unpkg.html'])
		await copyFile(`demo/${file}`, join(fixture, 'demo', file));
	await symlink(resolve('node_modules'), join(fixture, 'node_modules'));
	await writeFile(
		join(fixture, 'development-only.txt'),
		'Not for deployment',
	);
	execFileSync('bash', ['-e', '-c', build], {
		cwd: fixture,
		encoding: 'utf8',
	});
	expect((await readdir(join(fixture, '_site'))).sort()).toEqual([
		'LICENSE',
		'README.md',
		'define.js',
		'demo',
		'img-enlarge-styles.js',
		'img-enlarge.js',
		'index.html',
		'index.js',
	]);
	const html = await readFile(join(fixture, '_site/index.html'), 'utf8');
	expect(html).toContain('<title>img-enlarge</title>');
	expect(html).toContain('<h1');
	expect(await readFile(join(fixture, '_site/demo/index.html'), 'utf8')).toBe(
		await readFile('demo/index.html', 'utf8'),
	);
	expect(workflow).toMatch(/path: ['"]?_site['"]?/);
	for (const file of ['esm.html', 'unpkg.html']) {
		const demo = await readFile(join(fixture, '_site/demo', file), 'utf8');
		expect(demo).toContain('../README.md');
		expect(await readFile(join(fixture, '_site/README.md'), 'utf8')).toBe(
			await readFile('README.md', 'utf8'),
		);
	}
	expect(html).toContain('href="LICENSE"');
	expect(await readFile(join(fixture, '_site/LICENSE'), 'utf8')).toBe(
		await readFile('LICENSE', 'utf8'),
	);
});
