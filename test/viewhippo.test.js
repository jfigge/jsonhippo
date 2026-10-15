/*
 * Copyright 2026 Jason Figge
 *
 * This file is part of JsonHippo.
 *
 * JsonHippo is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * JsonHippo is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with JsonHippo. If not, see <https://www.gnu.org/licenses/>.
 */

// window.hippoViewer, over a stand-in for the App: what ViewHippo can rely on
// (hippoherd's features/viewhippo-app-build-brief.md, "The viewer API").

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHippoViewer, installHippoViewer } from "../src/js/viewhippo.js";

/** The three things the API needs from the App, recorded. */
function fakeApp(text = "") {
  return {
    text,
    theme: "system",
    loads: [],
    async load(t, name) {
      this.loads.push({ text: t, name });
      this.text = t;
    },
    setTheme(theme) {
      this.theme = theme;
    },
  };
}

describe("formats", () => {
  test("reads and writes JSON only", () => {
    assert.deepEqual(createHippoViewer(fakeApp()).formats, { reads: ["json"], writes: ["json"] });
  });

  test("survive the host's structured clone", () => {
    const { formats } = createHippoViewer(fakeApp());
    assert.deepEqual(structuredClone(formats), formats);
  });
});

describe("load / getText", () => {
  test("a fresh document is empty, so the host sees nothing unsaved", () => {
    assert.equal(createHippoViewer(fakeApp()).getText(), "");
  });

  test("load replaces the document through App.load, and getText round-trips it", async () => {
    const app = fakeApp("[1]");
    const viewer = createHippoViewer(app);
    const text = '{\n  "a": [1, 2.50, null],\n  "a": "dup"\n}\n';
    await viewer.load(text, { name: "sample.json" });
    assert.deepEqual(app.loads, [{ text, name: "sample.json" }]);
    assert.equal(viewer.getText(), text);
  });

  test("the name is optional", async () => {
    const app = fakeApp();
    await createHippoViewer(app).load("{}");
    assert.deepEqual(app.loads, [{ text: "{}", name: null }]);
  });

  test("load resolves to nothing: no parse result crosses to the host", async () => {
    assert.equal(await createHippoViewer(fakeApp()).load("{}"), undefined);
  });

  test("escaped JSON is opened as it is, never unescaped", async () => {
    const app = fakeApp();
    const viewer = createHippoViewer(app);
    await viewer.load(String.raw`"{\"a\":1}"`);
    assert.equal(viewer.getText(), String.raw`"{\"a\":1}"`);
  });
});

describe("exportAs", () => {
  test("json: the text exactly as it stands, nothing dropped", () => {
    const text = '{ "b": 1, "a": 1.10, "big": 12345678901234567890 }';
    assert.deepEqual(createHippoViewer(fakeApp(text)).exportAs("json"), { text, dropped: [] });
  });

  test("a parse error is thrown as a message the user can act on", () => {
    const viewer = createHippoViewer(fakeApp('{"name":"hippo",\n "tags":["a" "b"]}'));
    assert.throws(() => viewer.exportAs("json"), (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /^Line 2, col 14: expected ',' or ']'/);
      assert.match(err.message, /\$\.tags/);
      return true;
    });
  });

  test("an empty document is an error, not an empty file", () => {
    assert.throws(() => createHippoViewer(fakeApp("  \n")).exportAs("json"), /input is empty/);
  });

  test("any other format is refused", () => {
    assert.throws(() => createHippoViewer(fakeApp("{}")).exportAs("yaml"), /writes JSON only/);
  });
});

describe("setTheme", () => {
  test("drives the App's theme", () => {
    const app = fakeApp();
    const viewer = createHippoViewer(app);
    for (const mode of ["dark", "light", "system"]) {
      viewer.setTheme(mode);
      assert.equal(app.theme, mode);
    }
  });

  test("an unknown mode is refused and changes nothing", () => {
    const app = fakeApp();
    assert.throws(() => createHippoViewer(app).setTheme("sepia"), /Unknown theme/);
    assert.equal(app.theme, "system");
  });
});

describe("installHippoViewer", () => {
  test("sets hippoViewer before announcing hippoviewer-ready", () => {
    const target = new EventTarget();
    let seen = null;
    target.addEventListener("hippoviewer-ready", () => {
      seen = target.hippoViewer;
    });
    installHippoViewer(fakeApp(), target);
    assert.equal(typeof seen?.load, "function");
    assert.equal(seen, target.hippoViewer);
  });
});
