import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);

it.each(['eslint', '@eslint/config-array', 'eslint-plugin-import-x'])(
	'%s rejects glob preprocessing amplification without breaking ordinary matches',
	(dependency) => {
		const dependencyRequire = createRequire(require.resolve(dependency));
		const { Minimatch } = dependencyRequire('minimatch');
		const options = { optimizationLevel: 2, braceExpandMax: 32 };

		// GHSA-g3hv-75wg-m249: six splits produce 64 patterns without the limit.
		expect(
			() =>
				new Minimatch(`root/${'**/../a/b/'.repeat(6)}file.js`, options),
		).toThrow(RangeError);
		const matcher = new Minimatch('test/**/*.js', options);
		expect(matcher.match('test/browser/component.spec.js')).toBe(true);
		expect(matcher.match('test/types.ts')).toBe(false);
	},
);
