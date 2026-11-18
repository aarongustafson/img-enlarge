import { beforeAll } from 'vitest';
import { ImgEnlargeElement } from '../img-enlarge.js';

const elementName = 'img-enlarge'.toLowerCase();

// Define the custom element before tests run
beforeAll(() => {
	if (!customElements.get(elementName)) {
		customElements.define(elementName, ImgEnlargeElement);
	}
});
