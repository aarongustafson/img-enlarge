# img-enlarge

[![npm version](https://img.shields.io/npm/v/@aarongustafson/img-enlarge.svg)](https://www.npmjs.com/package/@aarongustafson/img-enlarge)
[![CI status](https://img.shields.io/github/actions/workflow/status/aarongustafson/img-enlarge/ci.yml?branch=main&label=CI)](https://github.com/aarongustafson/img-enlarge/actions/workflows/ci.yml)
[![Minified + gzipped size](https://img.shields.io/bundlejs/size/@aarongustafson/img-enlarge?format=minzip&label=min%2Bgzip)](https://bundlejs.com/?q=@aarongustafson/img-enlarge)
[![License](https://img.shields.io/npm/l/@aarongustafson/img-enlarge)](https://github.com/aarongustafson/img-enlarge/blob/main/LICENSE)
[![Type definitions](https://img.shields.io/npm/types/@aarongustafson/img-enlarge)](https://github.com/aarongustafson/img-enlarge/blob/main/img-enlarge.d.ts)

`<img-enlarge>` adds a separate enlarge-icon button to an authored image when
the viewer has room to show it larger. The button
opens a native modal dialog with a viewport-fitting image and optional named
gallery navigation. The original image, link, `<picture>`, and responsive sources stay
in place.

This is an unpublished draft. The local [demo](demo/index.html) works without
an npm publication; package badges and CDN examples may not resolve yet.
There are no runtime dependencies, shadow roots, automatic slideshows, or
zoom/pan gestures.

## Load the component

For local use, serve this repository and include the registration module.
The component carries its default styles:

```html
<script type="module" src="./define.js"></script>

<img-enlarge>
  <figure>
    <a href="./large.jpg">
      <img
        src="./thumbnail.jpg"
        alt="A narrow trail between green mountains."
      />
    </a>
    <figcaption>The trail on a clear afternoon.</figcaption>
  </figure>
</img-enlarge>
```

One shared stylesheet supplies the scrolling and viewport-fitting layout. The
component inserts it when the first instance connects; no CSS import is needed.
Without JavaScript, the image and its link remain available.
Image clicks retain their authored behavior; the separate button opens the dialog.
Put image links **inside** the component, not around it.
Each component opens independently by default. Give components matching,
nonempty `name` values to connect them into a gallery; see
[collections and controls](#collections-and-controls). No opt-out attribute is needed.

Once published, install with `npm install @aarongustafson/img-enlarge`. Import
`@aarongustafson/img-enlarge/define.js` for automatic registration.
Importing the package root or `img-enlarge.js` exports the class **without**
registering it:

```js
import { ImgEnlargeElement } from '@aarongustafson/img-enlarge';

customElements.define('img-enlarge', ImgEnlargeElement);
```

Use the `img-enlarge` tag name; collection discovery relies on it.
`define.js` also exports `defineImgEnlarge()`, which returns `false` without a
browser registry and otherwise registers the tag if needed.

If your Content Security Policy requires a style nonce, put the allowed nonce
on the first component before it connects: `<img-enlarge nonce="your-nonce">`.
The shared style element copies that nonce. A blocked stylesheet produces a
configuration error and leaves the authored image unchanged.

## Image sources and captions

Each component requires exactly one `<img>`, optionally inside `<picture>`, a
link, or a figure. Nested components aren’t counted as the parent’s image.

### Keep responsive attributes on the image

**Put `src`, `srcset`, and `sizes` on the authored `<img>` as usual.**
You don’t need to repeat them on `<img-enlarge>`. This keeps the thumbnail
responsive before JavaScript runs and when enhancement isn’t available.

```html
<img-enlarge>
  <img
    src="./trail-small.jpg"
    srcset="./trail-small.jpg 400w, ./trail-large.jpg 1600w"
    sizes="(max-width: 40rem) 100vw, 20rem"
    alt="A trail between green mountains."
  />
</img-enlarge>
```

Without explicit enlargement overrides or an identified image link, the viewer
can reuse those candidates. It offers automatic enlargement only when a
larger candidate than `currentSrc` remains available and the viewer has room.
The browser chooses a candidate for the enlarged image; the component doesn’t
always request the largest file.

Width descriptors (`400w`, `1200w`) provide candidate widths directly. Density
descriptors (`1x`, `2x`) are converted to width hints using the loaded image’s
density-corrected natural width. A `<picture>` can supply candidates from the
branch identified by `currentSrc`; candidates from different crops aren’t mixed.
If the selected branch is ambiguous, dimensions aren’t available, or descriptors
can’t be interpreted, the viewer keeps the `currentSrc` fallback instead.

For inferred candidates, the viewer calculates `sizes` from its contained
image’s painted width and updates it when that image’s layout changes. It
doesn’t copy the original `sizes`, which describes the thumbnail’s layout.
The original image, `<picture>`, `srcset`, and `sizes` aren’t changed.

### Use an existing image link

When the image is linked to a larger image, as in the opening example, that
link supplies the enlargement URL instead of inferred responsive candidates.
There’s no need to repeat the link URL on the component.

- An image MIME hint, such as `type="image/jpeg"`, identifies an image link,
  including extensionless URLs. A nonempty, non-image `type` prevents inference.
- Without a MIME hint, the URL’s pathname must end in `.apng`, `.avif`, `.bmp`,
  `.gif`, `.ico`, `.jfif`, `.jpg`, `.jpeg`, `.png`, `.svg`, or `.webp`.
  Matching is case-insensitive; query strings and fragments don’t affect it.

Other links keep the existing image-source behavior; the component doesn’t
fetch a URL to discover its content type. Use explicit `src` for ambiguous URLs.
Image clicks still follow the authored link.

### Optional: separate enlargement sources

Only put `src` or `srcset` on `<img-enlarge>` when you want to override the
normal image-link and responsive-source inference. For example, a thumbnail
might use 400px and 800px files while the viewer uses separate 1600px and
3200px files:

```html
<img-enlarge
  src="./trail-enlarged.jpg"
  srcset="./trail-enlarged.jpg 1600w, ./trail-enlarged-large.jpg 3200w"
>
  <img
    src="./trail-thumbnail.jpg"
    srcset="./trail-thumbnail.jpg 400w, ./trail-thumbnail-large.jpg 800w"
    sizes="(max-width: 40rem) 100vw, 20rem"
    alt="A trail winding between two green mountains."
  />
</img-enlarge>
```

The attributes on `<img>` still configure only the authored thumbnail. The
attributes on `<img-enlarge>` configure only the generated viewer image;
those separate enlargement files aren’t requested until their slide is visited.
This override isn’t needed when both views can use the authored image’s candidates.

Explicit component `src` and `srcset` take precedence over image links and
candidate inference. The fallback URL is the authored image’s `currentSrc`,
then its `src`. Explicit component `srcset` uses that fallback when no component
`src` is provided, not the link URL.

A component-level `sizes` overrides the viewer’s measured `sizes` for inferred
candidates. With explicit enlargement sources, it describes the viewer’s
layout, not the thumbnail’s; the browser’s default applies when it’s absent.
It doesn’t change the authored image’s `sizes`.

All resolved enlargement URLs use the same validation: HTTP(S), blob, and image
data URLs only. Relative URLs resolve against the component’s base URL.

### Alternative text and captions

Alternative text comes from the original image’s `alt`. A caption comes from
the component’s `caption`, then the image’s enclosing figure’s `figcaption`.
An empty `caption` suppresses that fallback. Captions are copied as plain text,
not HTML, and alt text isn’t displayed as a caption. Supply meaningful alt text
and captions for your content.

### Loading and recovery

Only visited enlarged images load. Loading and errors appear in visible status
text. A failed image stays visible in its reserved box so the browser can show
its broken-image indicator and alternative text; it also gets a retry button.
Close remains available. The placeholder uses the original image’s natural
aspect ratio, or its rendered/authored dimensions when natural dimensions
aren’t available, within the viewer’s normal size limits. Supplying `width`
and `height` on the original `<img>` helps reserve space before it loads.
Without known dimensions, the browser supplies its normal fallback sizing.
A successfully loaded enlargement uses its own proportions, which may differ
from the thumbnail. Retrying
uses the same URL and normal browser caching rules. A new opening rereads sources,
image links, and captions. After editing a link’s `href` or `type`, call
`refresh()` to reevaluate whether its image should get an enlarge button.
The component doesn’t send HEAD availability probes: CORS restrictions or
servers rejecting HEAD can make working images appear unavailable, and a
successful HEAD doesn’t establish that an image will decode. See the
[intentional missing-image demo](demo/index.html#failure) to test recovery.

## Responsive enhancement

The component measures the image and a hidden, inert copy of the styled viewer
layout. It adds the button only when the viewer would paint the image more than
one CSS pixel wider or taller, allowing for rounding at equal sizes. Measuring
doesn’t fetch the enlarged source. The estimate uses the original image’s aspect
ratio; use `force` when an art-directed enlarged source has a different ratio.

Image and container resizing, image loading, and viewport changes update the
decision. A focused button stays available until focus leaves; an open viewer
also keeps its opener. This avoids dropping focus during a layout change.
No useful enlargement means `state === 'inactive'` and no added button.
For inferred responsive sources, the button also stays absent when the largest
candidate is already selected or no candidate is wider than the displayed image.
This decision uses resource hints, not a guarantee of sharpness or extra detail.
Browser caching, display density, and resource-selection choices can affect it.
The image still belongs to its authored collection and can appear when another
image opens that collection.

Use the boolean `force` attribute to keep enlargement available, including when
the largest responsive candidate is already selected:

```html
<img-enlarge force>
  <img src="./map.jpg" alt="A trail map with the station at its lower edge." />
</img-enlarge>
```

Changing image markup or changing dialog-only styling without a resize requires
`refresh()` to reevaluate eligibility. Style the documented classes rather than
relying on `:modal`-only layout rules: the sizing copy is a non-modal dialog.

## Collections and controls

- Components without a `name`, or with `name=""`, open only their own image.
- Matching, nonempty, case-sensitive `name` values opt into a shared gallery.
  Names connect images anywhere in the document, not just adjacent components.
- Components with invalid configuration or `[hidden]`/`[inert]` ancestors
  don’t join collections.
- Each opening takes a snapshot in document order. Close and reopen to pick up
  additions, removals, source changes, or reordered images.

```html
<img-enlarge name="details">
  <img src="./detail-one.jpg" alt="The bicycle’s front basket." />
</img-enlarge>
<img-enlarge name="details">
  <img src="./detail-two.jpg" alt="The bicycle’s rear wheel." />
</img-enlarge>
<img-enlarge>
  <img src="./map.jpg" alt="A map showing the trail from the station." />
</img-enlarge>
```

Previous/Next and Left/Right keys navigate without wrapping. Arrow directions
follow the opener’s computed text direction. Touch and trackpad scrolling use
the same scroll-snapping collection. There are no navigation controls for a
single-image collection.

`controls="auto"` uses CSS `::scroll-button()` controls when the required
selectors and alternative-text syntax are available.
Otherwise, JavaScript creates native buttons. `controls="buttons"` forces that
fallback, including when you need to avoid a browser’s native carousel behavior.
Only one control set is exposed at a time.

Fallback buttons use `aria-disabled` at collection boundaries so keyboard focus
stays on the control after navigation. Boundary activation does nothing. Native
CSS controls use the browser’s disabled behavior.
Both paths use `GrayText` for disabled icons and borders against `ButtonFace`,
with a dashed border as an additional non-color cue.

Set `--disabled-button-visibility: hidden` to hide unavailable arrows instead.
The default is `visible`, and the same property controls both navigation paths:

```css
.hide-disabled {
  --disabled-button-visibility: hidden;
}
```

Add `class="hide-disabled"` to each component that can open the collection.
Visibility preserves the control’s space. The focused arrow stays visible until
focus leaves, avoiding a disappearing focus indicator at a boundary.
See the [JavaScript controls](demo/index.html#javascript-controls-example) and
[hidden disabled arrows](demo/index.html#hide-disabled-example) demos.

Feature detection checks syntax support, not assistive-technology compatibility.
Test both paths in your supported browser and assistive-technology combinations.

## Labels and localization

Labels belong to the component that opens the collection and remain consistent
throughout that dialog. The dialog copies the opener’s nearest `lang` and
computed text direction. Set labels once for the page with an inline
`<script type="application/json" data-img-enlarge-config>`, target a named
gallery with `data-img-enlarge-config="gallery-name"`, or override them on
individual components. The marker is functional, not a demo-only attribute;
no script ID is required. Every generated user-facing string has an attribute:

| Attribute        | Default                          |
| ---------------- | -------------------------------- |
| `open-label`     | `Enlarge image`                  |
| `dialog-label`   | `Enlarged images`                |
| `close-label`    | `Close`                          |
| `previous-label` | `Previous image`                 |
| `next-label`     | `Next image`                     |
| `loading-label`  | `Loading image`                  |
| `error-label`    | `The image could not be loaded.` |
| `retry-label`    | `Try again`                      |
| `position-label` | `{current} of {total}`           |

Labels must contain non-whitespace text. `position-label` must contain both
placeholders; positions shown to readers are one-based. Labels and captions
are inserted as text, never interpreted as HTML. See the fully translated
[French example](demo/index.html#localized).

### One language: a flat object

A single-language page doesn’t need language-code keys. Put the labels directly
in the configuration object:

```html
<script type="application/json" data-img-enlarge-config>
  {
    "open-label": "Agrandir l’image",
    "dialog-label": "Images agrandies",
    "close-label": "Fermer",
    "previous-label": "Image précédente",
    "next-label": "Image suivante",
    "loading-label": "Chargement de l’image",
    "error-label": "Impossible de charger l’image.",
    "retry-label": "Réessayer",
    "position-label": "{current} sur {total}"
  }
</script>
```

These labels apply to every component in the document, regardless of its
language. Still identify the content’s language in HTML, such as
`<html lang="fr">`. Configuration doesn’t set or translate document language,
captions, or alternative text. See the [single-language demo](demo/labels-flat.html).

### Multiple languages: language-keyed objects

Use the same configuration marker, but nest dictionaries under language codes:

```html
<script type="application/json" data-img-enlarge-config>
  {
    "fr": {
      "open-label": "Agrandir l’image",
      "dialog-label": "Images agrandies",
      "close-label": "Fermer",
      "previous-label": "Image précédente",
      "next-label": "Image suivante",
      "loading-label": "Chargement de l’image",
      "error-label": "Impossible de charger l’image.",
      "retry-label": "Réessayer",
      "position-label": "{current} sur {total}"
    },
    "fr-CA": {
      "open-label": "Agrandir la photo"
    }
  }
</script>

<div lang="fr-CA">
  <img-enlarge name="photos">
    <img src="./trail.jpg" alt="Un sentier entre les montagnes." />
  </img-enlarge>
  <img-enlarge name="photos">
    <img src="./bicycle.jpg" alt="Un vélo rouge avec un panier." />
  </img-enlarge>
</div>
```

The component uses its nearest authored `lang`, not browser language
preferences. Language tags are canonicalized using `Intl.getCanonicalLocales`;
matching is case-insensitive. More specific dictionaries override less specific
ones one label at a time within each configuration: `fr-CA` falls back to `fr`.
An unmatched or empty language contributes no labels from that script’s
language dictionaries; lower-priority configuration and built-in labels still apply.

Precedence, from highest to lowest:

1. The individual component’s label attributes.
2. The configuration whose marker matches the opener’s `name`.
3. The page configuration, with an empty marker.
4. Built-in English labels.

Resolve language fallbacks within each scope, then merge scopes one key at a
time. A named configuration can override a page label without repeating the
rest of its dictionary. Both scopes accept flat or language-keyed objects.

The opener supplies the entire collection’s controls, even when another image
has different labels or a different language. Navigation doesn’t switch the
viewer’s language. An image-specific `open-label` can still describe each
thumbnail’s action.

### Named gallery overrides

An empty `data-img-enlarge-config` sets page defaults. A nonempty value must
match a gallery’s `name` exactly, including case:

```html
<script type="application/json" data-img-enlarge-config>
  { "close-label": "Close" }
</script>
<script type="application/json" data-img-enlarge-config="products">
  { "dialog-label": "Product photographs" }
</script>

<img-enlarge name="products">
  <img src="./bicycle.jpg" alt="A red bicycle with a basket." />
</img-enlarge>
```

The product viewer gets its dialog label from the named configuration and its
close label from the page configuration. Other galleries and unnamed images
use only page defaults and their own attribute overrides. The marker scopes
labels; it doesn’t configure image sources, styling, or gallery membership.

### Setup, updates, and invalid configuration

Use at most one page script and one script for each gallery name. Within each
script, use either a flat object or language dictionaries—not both. Put configuration
before the registration script or before connecting components. A shared site
layout can include the same configuration on every page. The component doesn’t
fetch an external configuration file, execute its contents, or expose a new
global variable.

Valid, unchanged JSON is parsed and validated once per script. Components
resolve applicable page and named scripts when connecting or refreshing.
After changing the JSON, its scope marker, or
an inherited `lang`, call `refresh()` on affected components; this closes any
viewer they opened. Existing controls don’t relabel themselves in response to
script edits. Removing a named script and refreshing restores page defaults;
removing the page script also leaves attribute overrides and built-in defaults.

Label dictionaries can be partial. Every supplied label must use a supported
name and contain non-whitespace text; `position-label` must contain `{current}`
and `{total}`. All dictionaries are validated, including unused languages.
Malformed JSON, unsupported keys, invalid language codes, duplicate canonical
language codes, wrong value types, an incorrect script type, or duplicate scripts
for an applicable scope produce an
`img-enlarge:error` with `phase: "configuration"` and leave the authored image
unenhanced. Invalid or duplicate configuration for a different gallery name
doesn’t affect this component. Correct the configuration and call `refresh()` to recover.

When generating an inline JSON script from dynamic content, use a serializer
that escapes `<` as `\u003c` so a value containing a closing script tag cannot
end the data block.

## Methods, state, and events

Configuration uses the attributes above, plus `src`, `srcset`, `sizes`, `caption`,
`name`, `controls`, and `force`. Changes to these attributes close an open
viewer and refresh its trigger in a microtask. After replacing the image markup,
call `refresh()` explicitly. Image attributes and caption text are reread on
the next opening. Shared label configuration and inherited language changes
require `refresh()`.

| Member                  | Behavior                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `open()`                | Open this image’s collection when eligible; do nothing if inactive or already open. |
| `close()`               | Close and remove the viewer.                                                        |
| `next()` / `previous()` | Navigate an open viewer; stop at collection boundaries.                             |
| `refresh()`             | Close the viewer and reread markup, page labels, and inherited language.            |
| `state`                 | Read-only `idle`, `inactive`, `ready`, `open`, or configuration `error`.            |

All events bubble from the component that opened the viewer:

| Event                | `detail`                    |
| -------------------- | --------------------------- |
| `img-enlarge:open`   | `{ index, total, element }` |
| `img-enlarge:change` | `{ index, total, element }` |
| `img-enlarge:close`  | `{}`                        |
| `img-enlarge:error`  | `{ error, phase, element }` |

Event indexes are zero-based. `element` identifies the selected or affected
component. `phase` is `configuration`, `open`, or `load`. Initial selection emits
`change` before `open`; later selection changes emit `change` only. Image loading
errors don’t change the component’s `open` state.

Invalid configuration leaves the authored markup in place and emits an error;
it doesn’t add a working-looking trigger. Opening errors leave the trigger
available. Listen for error events if your application needs logging:

```js
document.addEventListener('img-enlarge:error', ({ detail }) => {
  console.error(detail.phase, detail.error);
});
```

Disconnecting the opener closes its dialog, removes generated controls and their
positioning anchor, disconnects resize observation, aborts listeners, and cancels
pending layout and scroll work. Reconnecting reevaluates whether to add a fresh
trigger. The shared stylesheet stays available for other instances. Only one
viewer from this package is open per document.
Inferred-source resize observers also disconnect on closing, retrying, or removal.
An open viewer keeps its source snapshot, including the selected picture branch;
close and reopen to pick up a different art-directed branch.

## Styling and accessibility

Both the generated trigger and dialog stay inside the component’s light DOM.
The modal enters the browser’s top layer while open. Use scoped class selectors
and custom properties for styling; these are **not** shadow-DOM `::part()` hooks.
Defaults live in the `img-enlarge` cascade layer, so unlayered author rules can
override them even when the component injects its stylesheet later.

### Generated HTML

The following is the complete host structure for an open, left-to-right,
two-image collection using JavaScript navigation buttons. The first image has
loaded; the second hasn’t been visited. The first figure is authored markup.
The positioning span and dialog are generated siblings, not wrappers around
that markup. The other component in the collection remains elsewhere in the
document; only the opener contains the dialog.

URLs, labels, and inline positioning values are examples. The component measures
the positioning span at runtime; don’t copy those values into your styles.

```html
<img-enlarge class="product-images" name="products" controls="buttons">
  <figure>
    <a href="./large-one.jpg">
      <img
        src="./small-one.jpg"
        width="320"
        height="180"
        alt="A red bicycle with a basket."
      />
    </a>
    <figcaption>The city bicycle.</figcaption>
  </figure>

  <span
    class="img-enlarge-anchor"
    style="left: 0px; top: 0px; width: 320px; height: 180px"
  >
    <button
      type="button"
      class="img-enlarge-trigger"
      data-action="open"
      aria-label="Enlarge image"
      aria-haspopup="dialog"
    >
      <span aria-hidden="true">⤢</span>
    </button>
  </span>

  <dialog
    class="img-enlarge-dialog"
    aria-label="Enlarged images"
    lang="en"
    dir="ltr"
    data-controls="buttons"
    open
  >
    <button
      type="button"
      class="img-enlarge-close"
      data-action="close"
      aria-label="Close"
      autofocus
    >
      <span aria-hidden="true">×</span>
    </button>

    <div
      class="img-enlarge-track"
      data-track=""
      data-previous-label="Previous image"
      data-next-label="Next image"
      data-single="false"
    >
      <figure class="img-enlarge-slide" aria-hidden="false">
        <img
          class="img-enlarge-image"
          alt="A red bicycle with a basket."
          decoding="async"
          width="320"
          height="180"
          src="https://example.com/large-one.jpg"
        />
        <figcaption class="img-enlarge-caption">The city bicycle.</figcaption>
      </figure>
      <figure class="img-enlarge-slide" aria-hidden="true"></figure>
    </div>

    <div class="img-enlarge-navigation">
      <button
        type="button"
        class="img-enlarge-previous"
        data-action="previous"
        aria-label="Previous image"
        aria-disabled="true"
      >
        <span aria-hidden="true">←</span>
      </button>
      <button
        type="button"
        class="img-enlarge-next"
        data-action="next"
        aria-label="Next image"
        aria-disabled="false"
      >
        <span aria-hidden="true">→</span>
      </button>
    </div>

    <p class="img-enlarge-status" role="status" aria-atomic="true">1 of 2</p>
    <button type="button" class="img-enlarge-retry" data-action="retry" hidden>
      Try again
    </button>
  </dialog>
</img-enlarge>
```

The component also inserts one shared `<style data-img-enlarge>` into the
document’s head, outside this tree. It contains the
[bundled stylesheet](./img-enlarge-styles.js) and copies the first component’s
style nonce when provided. It stays in place after components disconnect.
The modal backdrop is the dialog’s `::backdrop` pseudo-element, not an HTML node.

#### Native CSS navigation

The native control path uses the same HTML tree, with
`data-controls="css"` on the dialog and `hidden` on the existing
`.img-enlarge-navigation` wrapper. Its two real buttons remain in the DOM but
aren’t displayed or exposed as controls. The browser instead generates
`::scroll-button(inline-start)` and `::scroll-button(inline-end)` on
`.img-enlarge-track`; these pseudo-elements aren’t additional `<button>` nodes.
Their accessible names come from the track’s `data-previous-label` and
`data-next-label` values.

Style both paths separately when changing navigation buttons:

```css
.product-images .img-enlarge-navigation button {
  border-radius: 50%;
}

@supports selector(::scroll-button(inline-start)) {
  .product-images .img-enlarge-track::scroll-button(*) {
    border-radius: 50%;
  }
}
```

Native arrows use `:disabled`; JavaScript buttons use `[aria-disabled='true']`,
not the HTML `disabled` attribute. Both honor
`--disabled-button-visibility`. In right-to-left layouts the arrow glyphs swap
directions; the Previous/Next actions and class names stay the same. Preserve
the native arrows’ generated content and accessible alternatives when styling.

#### Loading, errors, and collection changes

The structure changes as follows:

- **Before enhancement or while inactive:** only authored content is present.
  An eligible component adds the positioning span and trigger; it adds the
  dialog only when opened. Layout measurement also briefly creates a hidden,
  inert, non-modal copy of the dialog, then removes it.
- **Unvisited image:** its slide is an empty figure, as shown above. Visiting
  it inserts an `.img-enlarge-image` followed by an `.img-enlarge-caption`.
  Previously visited slides retain those children.
- **Offscreen slide:** `aria-hidden="true"` changes to `"false"` on the selected
  figure. This isn’t the `hidden` attribute: offscreen figures keep their layout
  boxes for scrolling.
- **No caption:** the generated `figcaption` is empty and has `hidden`.
- **Dimensions:** when known, the original image’s dimensions supply generated
  `width` and `height` attributes. Loading and failed images also carry an
  internal `--_img-enlarge-image-aspect-ratio` hint in their `style` attribute.
  The hint is removed after loading so the enlarged file’s actual proportions
  take over.
- **Responsive source:** the generated image also receives `srcset` and `sizes`
  when applicable.
- **Loading:** the image and caption are inserted immediately, Retry remains
  hidden, and the same status paragraph reads, for example,
  `1 of 2. Loading image`.
- **Load error:** the image stays visible with its reserved space and native
  browser fallback rendering. Its caption remains in place, the
  status reads `1 of 2. The image could not be loaded.`, and Retry loses
  `hidden`. Retry replaces the failed image and caption, hides the retry
  button, and returns the status to loading. Close remains available.
- **Collection boundary:** the previous button’s `aria-disabled` is `"true"` at
  the start; the next button’s is `"true"` at the end. Otherwise each is `"false"`.
  Native pseudo-elements reflect the boundary through `:disabled`.
- **Single-image collection:** there is one slide, the track has
  `data-single="true"`, and the navigation wrapper has `hidden` in either mode.
  Native arrow pseudo-elements aren’t generated.
- **Closing:** the whole dialog is removed; the trigger remains while eligible.
  Disconnecting the component also removes its positioning span and trigger.

The component doesn’t add loading/error classes or reflect its `state` property
as an HTML attribute. Use the documented classes and custom properties for
presentation. Leave generated ARIA attributes, `hidden`, `data-*` wiring, and
the anchor’s measured geometry under component control.

For the example above, `.product-images > figure img` selects the authored
thumbnail, while `.product-images .img-enlarge-image` selects the viewer image.
A broad `.product-images img` rule affects both. Apply your styling class to
every component that can open a collection, because the dialog inherits styles
and custom properties from its opener, not the image currently being viewed.

### Classes and custom properties

| Class                                         | Styled part                                                     |
| --------------------------------------------- | --------------------------------------------------------------- |
| `.img-enlarge-trigger`                        | Enlarge icon button, positioned relative to the original image. |
| `.img-enlarge-dialog`                         | Dialog layout, surface, and `::backdrop`.                       |
| `.img-enlarge-close`                          | Close icon button.                                              |
| `.img-enlarge-track`                          | Scroll container and native `::scroll-button()` controls.       |
| `.img-enlarge-slide`                          | Each image/caption figure.                                      |
| `.img-enlarge-image`                          | Enlarged image.                                                 |
| `.img-enlarge-caption`                        | Plain-text caption.                                             |
| `.img-enlarge-navigation`                     | Fallback navigation wrapper.                                    |
| `.img-enlarge-previous` / `.img-enlarge-next` | Fallback arrow buttons.                                         |
| `.img-enlarge-status` / `.img-enlarge-retry`  | Status and retry control.                                       |

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

The default enlarge icon (`⤢`) sits at the image’s block-start/inline-end. Close
(`×`) sits at the dialog’s block-start/inline-end; Previous/Next sit at its inline
edges. The icons are hidden from assistive technology; the label attributes
provide their accessible names in both control paths.

Full-width gallery slides have a `0.5rem` gap so a neighboring panel doesn’t
peek into view when scroll positions round at fractional widths. Adjust
`--img-enlarge-slide-gap` to change this separation; keep a small positive gap.
This is separate from the dialog’s row gap and the caption’s spacing.

For example, change the slide and caption spacing and dialog padding:

```css
.product-images {
  --img-enlarge-dialog-padding: 4rem;
  --img-enlarge-caption-gap: 1.5rem;
  --img-enlarge-slide-gap: 1rem;
}

.product-images .img-enlarge-caption {
  text-align: start;
}
```

See the [layout customization](demo/index.html#styling-example) and
[grouped product gallery](demo/index.html#product-example) demos. Keep controls
reachable and leave enough padding for the overlaid buttons. Don’t hide offscreen
slides with `display: none`; scrolling needs their layout boxes. The generated
`.img-enlarge-anchor` owns image-relative geometry and isn’t a layout hook.

The stylesheet uses paired system colors, visible focus outlines, scroll snap,
and no animated transitions or smooth scrolling. It includes forced-colors
styling. `--_img-enlarge-css-controls` and
`--_img-enlarge-image-aspect-ratio` are internal readiness and sizing hints,
not customization APIs. Override the image class’s `aspect-ratio` in author CSS
if you need different sizing behavior.

Close receives initial focus. Native modal behavior contains keyboard focus;
Escape and Close dismiss the viewer. Focus returns to the opener if it’s still
connected. Offscreen slides are hidden from the accessibility tree, and a polite
status reports position, loading, and failures. The dialog doesn’t dismiss on
backdrop clicks.

Provide distinct opener labels where several identical “Enlarge image” controls
would be hard to distinguish. If your application removes the opener or hides
its container while the dialog is open, manage the next useful focus location.
Automated browser checks aren’t a substitute for assistive-technology review.

## Development

```sh
npm ci
npm run test:run
npm run test:browser
npm run lint
```

Browser tests run in Chromium, Firefox, and WebKit. Install missing engines with
`npx playwright install chromium firefox webkit`. The local demo reuses the
workspace’s mountain illustrations from `lazy-img` and bicycle from
`img-alt-overlay`, with cropped bicycle details for the product gallery; it
doesn’t depend on remote image services.

The retained `version` script updates and stages the versioned esm.sh demo.
`postversion` pushes tags. Don’t run release commands until you intend to
version and publish the package.

## License

[MIT](LICENSE).
