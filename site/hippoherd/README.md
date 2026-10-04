# JsonHippo on hippoherd.com

The product page for [hippoherd.com/jsonhippo](https://hippoherd.com/jsonhippo/).
It is written here and synced into a checkout of
[jfigge/hippoherd](https://github.com/jfigge/hippoherd) by `make site` — the
same arrangement Roll Hippo, Maze Hippo and Scan Hippo use.

| Here | In hippoherd |
|---|---|
| `jsonhippo.html` | `website/jsonhippo/index.html` |
| `img/*.png` (from `make screenshots`) | `website/jsonhippo/img/` |

This README and `.htmlvalidate.json` stay here; they are not synced.

## Updating the page

```sh
make screenshots     # only if the app changed: re-captures img/*.png
make preview-site    # optional: http://localhost:8791/jsonhippo/ inside the real site
make site            # validates the page, then mirrors it into ../hippoherd
```

`make site` uses `rsync --delete`, so `website/jsonhippo/` in hippoherd is an
exact copy of what is here: never edit it there, because the next sync
overwrites it. Point it at another checkout with `HIPPOHERD=/path/to/hippoherd`.
Then review and commit the change in hippoherd; its CI deploys the site.

## How hippoherd knows about JsonHippo

hippoherd generates its pages from `content/hippos.mjs`. JsonHippo's entry
there is marked `externalSite: true`, which stops `scripts/build-site.mjs`
writing `website/jsonhippo/index.html` (it would replace this page with a
stub), while the card on the index, the nav dropdown, the footer, the 404
list, the sitemap and the neighbours' previous/next links are all still
generated from it.

The rest of the registration, done once, following hippoherd's "Adding a
hippo" checklist:

- `scripts/make-marks.mjs` — JsonHippo's colour (`#B65CF0`) and its `{ }`
  snout motif, copied from `src/img/jsonhippo.svg`. If the mark changes here,
  copy the change there and rerun `node scripts/make-marks.mjs`. That is why
  `make site` does not sync the mark.
- `scripts/build-versions.mjs` — the slug in `HERD`.
- `website/herd.js` — `jsonhippo: { desktop: false }`: nothing to install.
- `website/preview.js` — not yet. A hippo with a `domain` gets a live preview
  of its site, and its host has to be allowed there. JsonHippo's `domain` is
  `null` until the app is hosted.

## Why the page is hand-written

hippoherd's generator has no layout for screenshots. This page uses only
classes `site.css` already has, plus a short `<style>` block for the
screenshot rows; the site's CSP allows inline styles. Its markup follows the
generated pages, self-closing void tags and inline `style=` attributes
included, which is why `.htmlvalidate.json` here relaxes those two rules.

Its nav dropdown, footer and previous/next links (Scan Hippo ← → Rest Hippo,
as JsonHippo is last in the herd) are written by hand, so they do not update
when a hippo joins. Refresh them from any generated page when one does.

## Still open

- **Where the app is hosted.** The page's Launch buttons and its
  `jsonhippo.com` link point at `https://jsonhippo.com/`, the overview's
  default, but that domain does not resolve yet. Until it does, those links are
  dead. Once the app is up: change them if the address differs, set `domain`
  in `content/hippos.mjs`, and add the host to `ALLOWED` in
  `website/preview.js`.
- **The status** in `content/hippos.mjs` is `"development"` ("In development"
  on the card). Move it to `"released"` once there is a tagged release on
  GitHub; the card's version chip comes from that.
