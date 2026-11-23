# img-enlarge

[![npm version](https://img.shields.io/npm/v/@aarongustafson/img-enlarge.svg)](https://www.npmjs.com/package/@aarongustafson/img-enlarge)
[![CI status](https://img.shields.io/github/actions/workflow/status/aarongustafson/img-enlarge/ci.yml?branch=main&label=CI)](https://github.com/aarongustafson/img-enlarge/actions/workflows/ci.yml)
[![Minified + gzipped size](https://img.shields.io/bundlejs/size/@aarongustafson/img-enlarge?format=minzip&label=min%2Bgzip)](https://bundlejs.com/?q=@aarongustafson/img-enlarge)
[![License](https://img.shields.io/npm/l/@aarongustafson/img-enlarge)](https://github.com/aarongustafson/img-enlarge/blob/main/LICENSE)
[![Type definitions](https://img.shields.io/npm/types/@aarongustafson/img-enlarge)](https://github.com/aarongustafson/img-enlarge/blob/main/img-enlarge.d.ts)

`<img-enlarge>` adds an Enlarge button when an image has room to appear larger.
The button opens a viewport-fitting dialog for one image or a gallery.
Authored images, responsive sources, and links remain usable without JavaScript.
The component uses light DOM, includes default styles, and has no runtime dependencies.

## Demos

- [Live demo](https://aarongustafson.github.io/img-enlarge/demo/) ([Source](./demo/index.html)): sources, captions, galleries, labels, and styling.
- [Unpkg demo](https://aarongustafson.github.io/img-enlarge/demo/unpkg.html) ([Source](./demo/unpkg.html)).
- [ESM.sh demo](https://aarongustafson.github.io/img-enlarge/demo/esm.html) ([Source](./demo/esm.html)).
- [Single-language configuration](https://aarongustafson.github.io/img-enlarge/demo/labels-flat.html) ([Source](./demo/labels-flat.html)).

## Installation

```sh
npm install @aarongustafson/img-enlarge
```

## Usage

### Option 1: Register automatically

Import the registration module:

```js
import '@aarongustafson/img-enlarge/define.js';
```

For a plain HTML page, use a module script:

```html
<script
  type="module"
  src="https://unpkg.com/@aarongustafson/img-enlarge/define.js?module"
></script>
```

### Option 2: Import the class and register manually

The package root exports the class without registering it:

```js
import { ImgEnlargeElement } from '@aarongustafson/img-enlarge';

customElements.define('img-enlarge', ImgEnlargeElement);
```

Keep the `img-enlarge` tag name; gallery discovery relies on it.
`define.js` also exports `defineImgEnlarge()`, a guarded registration helper
that returns `false` without a browser registry. TypeScript declarations are bundled.

Default CSS is inserted once per document; no separate stylesheet import is needed.
If your Content Security Policy requires a style nonce, set `nonce` on the first
component before it connects. A blocked stylesheet emits a configuration error
and leaves the authored content unenhanced.

### Basic example

Wrap one or more images, including images inside `<picture>`, figures, or links:

```html
<img-enlarge>
  <img
    src="./trail.jpg"
    width="800"
    height="400"
    alt="A narrow trail between green mountains."
  />
</img-enlarge>
```

Put image links inside the component, not around it. Image clicks still follow
the link; the separate Enlarge button opens the viewer. Nested components own
their own images.

Use the Enlarge button to open the image. Close or Escape returns focus to that
button. Without JavaScript, the original image and any link remain available.

### Use a different enlarged image

Set `src` on the component when the thumbnail and enlargement use different files:

```html
<img-enlarge src="./trail-large.jpg">
  <img
    src="./trail.jpg"
    width="800"
    height="400"
    alt="A narrow trail between green mountains."
  />
</img-enlarge>
```

The thumbnail stays unchanged. Alternatively, put a link to the larger image
inside the wrapper or keep responsive sources on the image. See the
[source examples](https://aarongustafson.github.io/img-enlarge/demo/#responsive-sources-example)
for links, `<picture>`, and separate viewer `srcset` options.

### Add a caption

An image inside a `<figure>` uses its `<figcaption>` in the viewer. Set `caption`
on the component to use different text:

```html
<img-enlarge caption="An afternoon on the mountain trail.">
  <figure>
    <img src="./trail.jpg" alt="A narrow trail between green mountains." />
    <figcaption>A view from the trail.</figcaption>
  </figure>
</img-enlarge>
```

The original caption stays in place. Set `caption=""` to omit the viewer caption.
Captions are plain text; keep meaningful alternative text on the image.

### Connect images in a gallery

Put several images in one wrapper, or give separate wrappers the same `name`:

```html
<img-enlarge name="ride">
  <img src="./trail.jpg" alt="A narrow trail between green mountains." />
</img-enlarge>
<img-enlarge name="ride">
  <img src="./bicycle.jpg" alt="A red bicycle with a front basket." />
</img-enlarge>
```

Open either image to start there. Previous/Next buttons and the Left/Right keys
move through the gallery without wrapping. A wrapper without a `name` opens only
its own images. See the
[gallery examples](https://aarongustafson.github.io/img-enlarge/demo/#gallery-examples)
for both arrangements and navigation options.

## Behavior

### When the Enlarge button appears

Each image gets a button when the styled viewer can paint it
more than one CSS pixel wider or taller. Resizing and image loading update
eligibility. Inferred responsive sources also need a larger candidate available.
Use `force` to bypass these checks, including for art-directed enlargements.
A focused opener remains until focus leaves; an open viewer keeps its opener.

### Choosing the enlarged image

Keep thumbnail `src`, `srcset`, and `sizes` on the authored image.
Viewer sources use component `src`/`srcset` overrides, then an enclosing image
link, then inferred responsive candidates, then `currentSrc`/`src`.
Ambiguous candidates use the fallback source. Image links need an image MIME
`type` or a recognized image-file extension; use explicit `src` otherwise.
A non-image `type` prevents link inference.
Viewer `sizes` describes the enlarged image, not the thumbnail.
URLs accept HTTP(S), blob, and image data URLs. The viewer preserves authored
`referrerpolicy` and `crossorigin`.

### Gallery membership

An unnamed wrapper opens only its own images. Matching,
nonempty, case-sensitive `name` values connect wrappers and groups in image
document order. Invalid or hidden/inert members are excluded. Each opening
snapshots the collection; clicking an opener starts at that image.

### Navigation

Previous/Next, Left/Right keys, and scrolling navigate without
wrapping. Arrow directions follow the opener’s text direction. `controls="auto"`
uses native CSS scroll buttons when supported, otherwise HTML buttons.
`controls="buttons"` forces HTML buttons. Single-image viewers have no arrows.

### Captions and alternative text

Alternative text comes from the original image’s `alt`.
Captions come from `caption`, then an enclosing figure’s `figcaption`; an empty
`caption` suppresses the fallback. Captions are plain text, separate from alt
text, and retain their source language.

### Loading and errors

Only visited enlarged images load. Visible status
reports position, loading, and errors. Failed images retain their reserved
space and native fallback rendering; Retry and Close remain available.
Invalid configuration leaves authored content unenhanced and emits an error.

### Focus and closing

Close receives initial focus; the native modal contains
keyboard focus. Escape or Close dismisses it and restores the original opener.
Backdrop clicks don’t dismiss it. Only one viewer is open per document.
If you remove or hide the opener, manage the next useful focus location.

## Attributes

Configure the component through HTML attributes. Source and caption overrides
apply to every image in a wrapper; use separate named wrappers for per-image overrides.

| Attribute  | Default                                                     | Purpose                                                                                                          |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src`      | Inferred source                                             | Enlargement URL; overrides image-link and responsive inference.                                                  |
| `srcset`   | Inferred candidates                                         | Enlargement candidates. Without component `src`, fallback is the authored `currentSrc`/`src`, not an image link. |
| `sizes`    | Measured for inferred candidates; browser default otherwise | Viewer image sizing hint. Doesn’t change the thumbnail’s `sizes`.                                                |
| `caption`  | Enclosing `figcaption`                                      | Plain-text caption override; an empty value hides the caption.                                                   |
| `name`     | Isolated wrapper                                            | Connect wrappers with the same nonempty name.                                                                    |
| `controls` | `auto`                                                      | `auto` or `buttons`.                                                                                             |
| `force`    | Absent (`false`)                                            | Boolean attribute that keeps enlargement available regardless of size or source hints.                           |

Changes to these attributes or label attributes refresh the component in a
microtask and close its open viewer.

## Labels and localization

Every generated label can be rewritten or translated:

For a one-off change, use label attributes on the wrapper:

```html
<img-enlarge open-label="View the trail photo" close-label="Back to the page">
  <img src="./trail.jpg" alt="A narrow trail between green mountains." />
</img-enlarge>
```

The same attributes accept translated text. Set the appropriate `lang` on the
wrapper or an ancestor; use shared JSON configuration when several wrappers
need the same labels.

| Attribute        | Default                          |
| ---------------- | -------------------------------- |
| `open-label`     | `Enlarge image: {name}`          |
| `dialog-label`   | `Enlarged images`                |
| `close-label`    | `Close`                          |
| `previous-label` | `Previous image`                 |
| `next-label`     | `Next image`                     |
| `loading-label`  | `Loading image`                  |
| `error-label`    | `The image could not be loaded.` |
| `retry-label`    | `Try again`                      |
| `position-label` | `{current} of {total}`           |

Labels must contain non-whitespace text; `position-label` requires both
placeholders. Displayed positions are one-based.

In `open-label`, every `{name}` is replaced with the original image’s accessible
name, for both single images and galleries. Names come from `aria-labelledby`
(referenced labels in ID order), then a nonempty `aria-label`, then `alt`, then
`title` when `alt` is absent. Whitespace is normalized; an explicitly empty `alt`
does not fall back to `title`. Names are inserted as plain text.
Referenced labels preserve word boundaries at line breaks and use their own
`title` when their content supplies no name. Labels hidden by themselves or
ancestors can still supply text, including hidden descendants.
Referenced content includes open shadow roots and assigned slots (or their
fallback content), and button inputs supply their nonempty `value` before `title`.
For example, `open-label="View photo: {name}"` uses the image’s name in your
own wording. Templates work in attributes and shared JSON, including translations.
Overrides without `{name}` stay literal; gallery openers no longer append `alt`
automatically. If the name is empty, the default becomes `Enlarge image`;
custom templates substitute `image`, so translate that fallback explicitly
with a literal label when needed.

For shared labels, use an inline `script[type="application/json"]` with
`data-img-enlarge-config`. An empty marker sets page defaults; a nonempty
marker targets the matching gallery name. Use one script per scope, containing
either a flat label object or language-keyed dictionaries. Partial dictionaries
are supported; unsupported keys or invalid configuration emit an error.

Precedence is **component attributes → named configuration → page configuration
→ built-in English labels**, merged per label. Language dictionaries use the
nearest authored `lang`, with more specific tags falling back to their parent
language (`fr-CA` to `fr`). The opener supplies labels, language, and direction
for the whole viewer; navigation doesn’t switch them.

Call `refresh()` after editing shared JSON or inherited language. When serializing
dynamic JSON into a script, escape `<` as `\u003c`. See the
[label examples](https://aarongustafson.github.io/img-enlarge/demo/#localization-example)
for runnable configurations.

## Properties and methods

| Member                  | Behavior                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`                 | Read-only `idle`, `inactive` (no eligible images), `ready` (any image eligible), `open`, or configuration `error`.                                                                          |
| `open()`                | Takes no arguments. Opens at this wrapper’s first authored image only when that image is eligible. Otherwise does nothing, even if another image is eligible. Does nothing if already open. |
| `close()`               | Closes the modal and restores opener focus immediately. Authored CSS exit visuals are removed when their transitions finish.                                                                |
| `next()` / `previous()` | Navigates an open viewer; stops at collection boundaries.                                                                                                                                   |
| `refresh()`             | Closes the viewer and rebuilds image membership, openers, labels, and language. Preserves focus by original image identity when refreshing a focused opener or open viewer.                 |

Call `refresh()` after adding, removing, or reordering images, editing an image
link’s `href`/`type`, changing an image’s accessible name or referenced label text,
or changing dialog-only layout without a resize.
Membership isn’t automatically observed. Existing images’ sources and captions
are reread on reopening.

Disconnecting a component closes its viewer, removes generated controls and
pending exit visuals, and cleans up listeners, observers, and scheduled work.
Reconnecting initializes it again. The shared stylesheet remains for other instances.

## Events

Events bubble from the component that opened the viewer:

| Event                | Detail                             |
| -------------------- | ---------------------------------- |
| `img-enlarge:open`   | `{ index, total, element, image }` |
| `img-enlarge:change` | `{ index, total, element, image }` |
| `img-enlarge:close`  | `{}`                               |
| `img-enlarge:error`  | `{ error, phase, element }`        |

`index` is zero-based within the opening’s snapshot. `element` identifies the
selected or affected wrapper; `image` is the original `HTMLImageElement`, not
the viewer copy. Error `phase` is `configuration`, `open`, or `load`.
Initial selection emits `change` before `open`. Loading errors don’t change
the viewer’s `open` state.

## Styling

Generated controls and the dialog remain inside the opener’s light DOM; these
are class selectors, not shadow-DOM `::part()` hooks. Default rules use the
`img-enlarge` cascade layer, so unlayered author styles override them.
Apply styling to every wrapper that can open a gallery: the dialog inherits
from its opener, not the currently viewed image.

| Class                                         | Styled part                                                         |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `.img-enlarge-trigger`                        | Enlarge button.                                                     |
| `.img-enlarge-dialog`                         | Dialog layout, surface, and `::backdrop`.                           |
| `.img-enlarge-close`                          | Close button.                                                       |
| `.img-enlarge-track`                          | Scroll container and native scroll buttons.                         |
| `.img-enlarge-slide`                          | Image/caption figure; the selected slide has `aria-hidden="false"`. |
| `.img-enlarge-image`                          | Enlarged image, distinct from authored thumbnails.                  |
| `.img-enlarge-caption`                        | Caption.                                                            |
| `.img-enlarge-navigation`                     | HTML navigation wrapper.                                            |
| `.img-enlarge-previous` / `.img-enlarge-next` | HTML arrow buttons.                                                 |
| `.img-enlarge-status` / `.img-enlarge-retry`  | Status and retry control.                                           |

| Custom property                           | Default                         |
| ----------------------------------------- | ------------------------------- |
| `--img-enlarge-trigger-inset-block-start` | `0.5rem`                        |
| `--img-enlarge-trigger-inset-inline-end`  | `0.5rem`                        |
| `--img-enlarge-control-size`              | `2.75rem`                       |
| `--img-enlarge-control-inset`             | `0.5rem`                        |
| `--img-enlarge-dialog-padding`            | `3.5rem 3.5rem 1rem`            |
| `--img-enlarge-dialog-inline-size`        | `min(70rem, calc(100% - 2rem))` |
| `--img-enlarge-dialog-gap`                | `0.75rem`                       |
| `--img-enlarge-slide-gap`                 | `0.5rem`                        |
| `--img-enlarge-image-max-block-size`      | `65dvh`                         |
| `--img-enlarge-caption-gap`               | `0.75rem`                       |
| `--disabled-button-visibility`            | `visible`                       |

Style HTML arrows and native `.img-enlarge-track::scroll-button()` controls
separately; guard pseudo-element rules with `@supports`. HTML buttons use
`[aria-disabled="true"]`; native arrows use `:disabled`. Set
`--disabled-button-visibility: hidden` to hide unavailable arrows. A focused
HTML arrow remains visible until focus leaves.

Keep controls reachable, focus indicators visible, and enough dialog padding
for the overlaid buttons. Don’t change the positioning anchor’s geometry,
generated ARIA or wiring attributes, or hide offscreen slides with `display: none`.
Keep a positive slide gap. Style dialog layout without relying solely on `:modal`,
because eligibility uses a hidden, inert, non-modal sizing copy.

Defaults use paired system colors, forced-colors rules, and no animation.
Optional smooth track scrolling applies to navigation where `scrollend` is supported;
opening and reduced-motion navigation remain instant. Disable authored CSS motion
for reduced-motion preferences. Exit visuals are inert and hidden from assistive
technology after logical closing.

See the [styling demos](https://aarongustafson.github.io/img-enlarge/demo/#styling-examples)
and [bundled stylesheet](./img-enlarge-styles.js). Browser feature detection
doesn’t establish assistive-technology compatibility; test your supported combinations.

## Development

```sh
npm ci
npm run test:run
npm run test:types
npm run test:browser
npm run lint
```

Browser tests cover Chromium, Firefox, and WebKit. Install missing engines with
`npx playwright install chromium firefox webkit`.

## License

[MIT](LICENSE).
