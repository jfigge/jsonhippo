# JsonHippo product page (parked)

A marketing page for JsonHippo, written in hippoherd.com's style: a hero, the
three differentiators with screenshots, the everyday tools, the credit to
jsonviewer.stack.hu, and links. **It is not published.**

The app itself is what lives at
[hippoherd.com/jsonhippo](https://hippoherd.com/jsonhippo/): the herd's index
card is the advertisement, and its **Launch** button opens the app directly
(`make site` publishes it; see the main README). This page is kept for when
JsonHippo has a home of its own, such as jsonhippo.com, which would want a
landing page in front of the app.

| File | |
|---|---|
| `jsonhippo.html` | The page. Uses hippoherd.com's `/site.css`, nav and footer |
| `img/*.png` | Screenshots from the real app, captured by `make screenshots` |
| `.htmlvalidate.json` | Relaxes two rules for this folder: the page follows hippoherd's generated markup (self-closing void tags, inline `style=`) |

`make validate` still checks the page, and `make screenshots` keeps its images
in step with the app, so it is ready to use when it is needed.

## Using it later

On a site of its own, the page needs:

- `/site.css`, `/favicon.svg`, `/marks/*.svg` and `/nav.js` from hippoherd, or
  its own copies — or rewrite the links to `https://hippoherd.com/…`;
- its **Launch** buttons pointed at wherever the app is served, and the
  `jsonhippo.com` links checked;
- its nav dropdown, footer and previous/next links refreshed from a current
  hippoherd page (they are written by hand and do not update);
- in hippoherd, `domain` set on JsonHippo's entry in `content/hippos.mjs`, and
  the host added to `ALLOWED` in `website/preview.js`.
