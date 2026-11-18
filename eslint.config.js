import eslintConfig from '@open-wc/eslint-config';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
	...eslintConfig,
	eslintConfigPrettier,
	{
		ignores: [
			'node_modules/**',
			'coverage/**',
			'demo/**',
			'**/*.ts',
			'test-results/**',
			'playwright-report/**',
		],
	},
];
