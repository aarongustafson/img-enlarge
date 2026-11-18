import { defineImgEnlarge } from '@aarongustafson/img-enlarge/define.js';

const registered: boolean = defineImgEnlarge();
const image = document.createElement('img-enlarge');
image.open();
image.dataset.registration = String(registered);
image.addEventListener('img-enlarge:change', (event) => {
	image.dataset.position = `${event.detail.index}/${event.detail.total}`;
});
document.addEventListener('img-enlarge:error', (event) => {
	console.error(event.detail.phase, event.detail.error.message);
});
