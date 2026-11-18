export const styles = /* css */ `
@layer img-enlarge {
	img-enlarge {
		display: block;
		position: relative;
	}

	img-enlarge[hidden],
	.img-enlarge-dialog [hidden] {
		display: none !important;
	}

	.img-enlarge-anchor {
		position: absolute;
		pointer-events: none;
	}

	.img-enlarge-trigger,
	.img-enlarge-dialog :where(button) {
		box-sizing: border-box;
		font: inherit;
		color: ButtonText;
		background: ButtonFace;
		border: 1px solid ButtonBorder;
		border-radius: 0.25rem;
		padding: 0.25rem;
		min-block-size: var(--img-enlarge-control-size, 2.75rem);
		min-inline-size: var(--img-enlarge-control-size, 2.75rem);
		cursor: pointer;
	}

	.img-enlarge-trigger,
	.img-enlarge-close,
	.img-enlarge-previous,
	.img-enlarge-next {
		display: grid;
		place-items: center;
		font-size: 1.75rem;
		line-height: 1;
	}

	.img-enlarge-trigger {
		position: absolute;
		inset-block-start: var(--img-enlarge-trigger-inset-block-start, 0.5rem);
		inset-inline-end: var(--img-enlarge-trigger-inset-inline-end, 0.5rem);
		pointer-events: auto;
	}

	.img-enlarge-trigger:focus-visible,
	.img-enlarge-dialog button:focus-visible {
		outline: 3px solid Highlight;
		outline-offset: 3px;
	}

	.img-enlarge-dialog {
		box-sizing: border-box;
		position: fixed;
		inset: 0;
		margin: auto;
		color-scheme: light dark;
		color: CanvasText;
		background: Canvas;
		border: 2px solid ButtonBorder;
		padding: var(--img-enlarge-dialog-padding, 3.5rem 3.5rem 1rem);
		inline-size: var(--img-enlarge-dialog-inline-size, min(70rem, calc(100% - 2rem)));
		max-inline-size: calc(100% - 2rem);
		max-block-size: calc(100% - 2rem);
		overflow: auto;
	}

	.img-enlarge-dialog[open] {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--img-enlarge-dialog-gap, 0.75rem);
	}

	.img-enlarge-dialog::backdrop {
		background: rgb(0 0 0 / 75%);
	}

	.img-enlarge-close {
		position: absolute;
		inset-block-start: var(--img-enlarge-control-inset, 0.5rem);
		inset-inline-end: var(--img-enlarge-control-inset, 0.5rem);
		z-index: 1;
	}

	.img-enlarge-track {
		display: flex;
		column-gap: var(--img-enlarge-slide-gap, 0.5rem);
		min-inline-size: 0;
		overflow-x: auto;
		scroll-snap-type: inline mandatory;
		scroll-behavior: auto;
		overscroll-behavior-inline: contain;
	}

	.img-enlarge-slide {
		box-sizing: border-box;
		flex: 0 0 100%;
		min-inline-size: 0;
		margin: 0;
		scroll-snap-align: start;
		scroll-snap-stop: always;
		text-align: center;
		overflow-wrap: anywhere;
	}

	.img-enlarge-image {
		display: block;
		aspect-ratio: var(--_img-enlarge-image-aspect-ratio, auto);
		object-fit: contain;
		inline-size: 100%;
		block-size: auto;
		max-block-size: var(--img-enlarge-image-max-block-size, 65dvh);
		margin-inline: auto;
	}

	.img-enlarge-caption {
		margin-block-start: var(--img-enlarge-caption-gap, 0.75rem);
	}

	.img-enlarge-status {
		margin: 0;
		text-align: center;
	}

	.img-enlarge-dialog button[aria-disabled='true'] {
		color: GrayText;
		border-color: GrayText;
		border-style: dashed;
		cursor: not-allowed;
	}

	.img-enlarge-dialog button[aria-disabled='true']:not(:focus) {
		visibility: var(--disabled-button-visibility, visible);
	}

	.img-enlarge-navigation {
		display: contents;
	}

	.img-enlarge-previous,
	.img-enlarge-next {
		position: absolute;
		inset-block: 0;
		margin-block: auto;
		block-size: var(--img-enlarge-control-size, 2.75rem);
	}

	.img-enlarge-previous {
		inset-inline-start: var(--img-enlarge-control-inset, 0.5rem);
	}

	.img-enlarge-next {
		inset-inline-end: var(--img-enlarge-control-inset, 0.5rem);
	}

	.img-enlarge-retry {
		justify-self: center;
	}

	@supports selector(::scroll-button(inline-start)) and (content: 'x' / attr(data-previous-label)) {
		img-enlarge {
			--_img-enlarge-css-controls: available;
		}

		.img-enlarge-track::scroll-button(*) {
			box-sizing: border-box;
			position: absolute;
			inset-block: 0;
			margin-block: auto;
			block-size: var(--img-enlarge-control-size, 2.75rem);
			font: inherit;
			font-size: 1.75rem;
			line-height: 1;
			color: ButtonText;
			background: ButtonFace;
			border: 1px solid ButtonBorder;
			border-radius: 0.25rem;
			padding: 0.25rem;
			min-block-size: var(--img-enlarge-control-size, 2.75rem);
			min-inline-size: var(--img-enlarge-control-size, 2.75rem);
			cursor: pointer;
		}

		.img-enlarge-track::scroll-button(*):focus-visible {
			outline: 3px solid Highlight;
			outline-offset: 3px;
		}

		.img-enlarge-dialog[data-controls='css'] .img-enlarge-track[data-single='false']::scroll-button(inline-start) {
			content: '←' / attr(data-previous-label);
			inset-inline-start: var(--img-enlarge-control-inset, 0.5rem);
		}

		.img-enlarge-dialog[data-controls='css'] .img-enlarge-track[data-single='false']::scroll-button(inline-end) {
			content: '→' / attr(data-next-label);
			inset-inline-end: var(--img-enlarge-control-inset, 0.5rem);
		}

		.img-enlarge-track::scroll-button(*):disabled {
			color: GrayText;
			border-color: GrayText;
			border-style: dashed;
			cursor: not-allowed;
		}

		.img-enlarge-track::scroll-button(*):disabled:not(:focus) {
			visibility: var(--disabled-button-visibility, visible);
		}

		.img-enlarge-dialog[data-controls='css'][dir='rtl'] .img-enlarge-track[data-single='false']::scroll-button(inline-start) {
			content: '→' / attr(data-previous-label);
		}

		.img-enlarge-dialog[data-controls='css'][dir='rtl'] .img-enlarge-track[data-single='false']::scroll-button(inline-end) {
			content: '←' / attr(data-next-label);
		}
	}

	@media (forced-colors: active) {
		.img-enlarge-dialog::backdrop {
			background: Canvas;
			opacity: 0.8;
		}
	}
}
`;
