import { ImgEnlargeElement } from '@aarongustafson/img-enlarge';
import type {
	ImgEnlargeChangeDetail,
	ImgEnlargeErrorDetail,
} from '@aarongustafson/img-enlarge';
import { defineImgEnlarge } from '@aarongustafson/img-enlarge/define.js';

const registered: boolean = defineImgEnlarge();
const element: ImgEnlargeElement = document.createElement('img-enlarge');
element.setAttribute('controls', registered ? 'auto' : 'buttons');
element.open();
element.next();
element.previous();
element.close();
element.refresh();
const state: 'idle' | 'inactive' | 'ready' | 'open' | 'error' = element.state;
element.dataset.state = state;
element.addEventListener('img-enlarge:change', (event) => {
	const detail: ImgEnlargeChangeDetail = event.detail;
	detail.element.dataset.position = `${detail.index}/${detail.total}`;
});
document.addEventListener('img-enlarge:error', (event) => {
	const detail: ImgEnlargeErrorDetail = event.detail;
	console.error(detail.phase, detail.error.message);
});
