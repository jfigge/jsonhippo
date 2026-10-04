/*
 * Copyright 2026 Jason Figge
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * screenshots.js — `make screenshots`: capture the product-page images from
 * the real app, driven in headless Chrome, so they never drift from it.
 *
 *   site/product-page/img/error-pinpoint.png   a missing comma 124,000 lines into 5 MB
 *   site/product-page/img/smart-paste.png      JSON escaped twice, pasted and formatted
 *   site/product-page/img/tree-filter.png      the tree, filtered to every "zip"
 *   src/img/jsonhippo-512.png               the mark as a PNG, transparent corners
 *
 * The mark's corners are checked after capture: a rounded-square icon on a
 * white square is the classic way this goes wrong, and the script fails
 * rather than writing one.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { launch, serve } from "./browser.js";
import { makeLargeObject, makeMissingComma } from "../test/fixtures/generate.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "site/product-page/img");
const WIDTH = 1180;
const HEIGHT = 660;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Put text in the editor the way a paste does (smart paste included). */
function pasteJs(text) {
  return `(() => {
    const ta = document.getElementById("jh-input");
    ta.focus(); ta.select();
    const dt = new DataTransfer();
    dt.setData("text/plain", ${JSON.stringify(text)});
    const handled = !ta.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    if (!handled) {
      ta.value = ${JSON.stringify(text)};
      ta.dispatchEvent(new InputEvent("input", { inputType: "insertFromPaste" }));
    }
  })()`;
}

/** RGBA of pixel (x, y) in a PNG written by Chrome (8-bit RGBA, non-interlaced). */
function pixel(png, x, y) {
  const width = png.readUInt32BE(16);
  if (png[24] !== 8 || png[25] !== 6) throw new Error("expected an 8-bit RGBA PNG");
  const chunks = [];
  for (let i = 8; i < png.length; ) {
    const len = png.readUInt32BE(i);
    if (png.toString("ascii", i + 4, i + 8) === "IDAT") chunks.push(png.subarray(i + 8, i + 8 + len));
    i += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  let prev = Buffer.alloc(stride);
  let row;
  for (let r = 0; r <= y; r++) {
    const filter = raw[r * (stride + 1)];
    row = Buffer.from(raw.subarray(r * (stride + 1) + 1, (r + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? row[i - 4] : 0;
      const b = prev[i];
      const c = i >= 4 ? prev[i - 4] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[i] = (row[i] + add) & 0xff;
    }
    prev = row;
  }
  return [...row.subarray(x * 4, x * 4 + 4)];
}

async function captureMark(server) {
  const b = await launch({ width: 512, height: 512 });
  try {
    await b.goto(`${server.url}img/jsonhippo.svg`);
    const png = await b.screenshot({ transparent: true });
    for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511], [12, 12]]) {
      const alpha = pixel(png, x, y)[3];
      if (alpha !== 0) throw new Error(`mark corner (${x}, ${y}) has alpha ${alpha}; corners must be transparent`);
    }
    if (pixel(png, 256, 20)[3] !== 255) throw new Error("mark body is not opaque");
    writeFileSync(join(ROOT, "src/img/jsonhippo-512.png"), png);
    console.log("  src/img/jsonhippo-512.png  (corners transparent: checked)");
  } finally {
    await b.close();
  }
}

async function captureApp(server) {
  const b = await launch({ width: WIDTH, height: HEIGHT, scale: 2 });
  const shot = async (name) => {
    await sleep(150);
    writeFileSync(join(OUT, name), await b.screenshot());
    console.log(`  site/product-page/img/${name}`);
  };
  try {
    await b.setTheme(true);
    await b.goto(server.url);
    await b.until("window.jQuery && document.querySelector('.jh-status-main')");

    // 1. Pinpoint errors: one missing comma, deep inside 5 MB.
    const broken = makeMissingComma(5 * 1024 * 1024, 42, 4321);
    await b.send("Runtime.evaluate", { expression: `window.__text = ${JSON.stringify(broken.text)}; 0` });
    await b.evaluate(`(() => { const ta = document.getElementById("jh-input"); ta.value = window.__text; ta.dispatchEvent(new InputEvent("input", { inputType: "insertFromPaste" })); })()`);
    await b.until("document.getElementById('jh-status').classList.contains('jh-status--error')", 15000);
    await b.evaluate("document.querySelector('.jh-status-error').click()");
    await shot("error-pinpoint.png");

    // 2. Smart paste: an API response escaped twice, pasted, then formatted.
    const response = { id: 4321, event: "order.created", customer: { name: "Grace Hopper", email: "grace@example.com" }, items: [{ sku: "HIP-001", qty: 2, price: 19.99 }, { sku: "HIP-042", qty: 1, price: 5.5 }], note: "Leave at the door.\nRing twice." };
    await b.evaluate("document.querySelector('[data-action=clear]').click()");
    await b.evaluate(pasteJs(JSON.stringify(JSON.stringify(JSON.stringify(response)))));
    await sleep(100);
    await b.evaluate("document.querySelector('[data-action=format]').click()");
    await b.until("document.getElementById('jh-status').classList.contains('jh-status--valid')");
    await b.evaluate("document.getElementById('jh-input').blur()");
    await shot("smart-paste.png");

    // 3. The filterable tree: every "zip", with the second match current.
    const doc = makeLargeObject(64 * 1024, 7);
    await b.evaluate("document.querySelector('[data-action=clear]').click()");
    await b.evaluate(pasteJs(JSON.stringify(doc, null, 2)));
    await b.until("document.getElementById('jh-status').classList.contains('jh-status--valid')");
    await b.evaluate("document.getElementById('jh-tab-tree').click()");
    await b.evaluate(`(() => { const f = document.getElementById("jh-filter"); f.value = "zip"; f.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    await b.until("/match/.test(document.getElementById('jh-filter-count').textContent)");
    await b.evaluate("document.getElementById('jh-filter-next').click(); document.getElementById('jh-filter-next').click()");
    await b.evaluate("document.querySelector('.jh-node--match-current .jh-row').click()");
    await b.evaluate("document.getElementById('jh-filter').focus()");
    await shot("tree-filter.png");

    const errors = b.console.filter((m) => /^(error|exception)/.test(m));
    if (errors.length) throw new Error(`console errors while capturing:\n${errors.join("\n")}`);
  } finally {
    await b.close();
  }
}

const server = await serve(join(ROOT, "src"));
try {
  await captureMark(server);
  await captureApp(server);
} finally {
  server.close();
}
