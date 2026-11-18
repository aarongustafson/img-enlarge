import { ImgEnlargeElement } from './img-enlarge.js';

export function defineImgEnlarge() {
	const hasWindow = typeof window !== 'undefined';
	const registry = hasWindow ? window.customElements : undefined;

	if (!registry || typeof registry.define !== 'function') {
		return false;
	}

	if (!registry.get('img-enlarge')) {
		registry.define('img-enlarge', ImgEnlargeElement);
	}

	return true;
}

defineImgEnlarge();
