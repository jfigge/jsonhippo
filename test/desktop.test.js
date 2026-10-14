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

// The desktop shell's two promises that can be checked without Electron:
// where the page may navigate (electron/policy.js), and that the packaging
// config builds exactly the six installers the Release workflow publishes.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { classifyNavigation } from "../electron/policy.js";

const webDir = path.resolve("build", "electron", "web");
const fileUrl = (...parts) => pathToFileURL(path.join(webDir, ...parts)).href;

describe("classifyNavigation", () => {
  test("the app's own page loads", () => {
    assert.equal(classifyNavigation(fileUrl("index.html"), webDir), "app");
    assert.equal(classifyNavigation(fileUrl("index.html") + "?x=1#tree", webDir), "app");
  });

  test(`the header's href="./" goes home, not to a directory listing`, () => {
    assert.equal(classifyNavigation(pathToFileURL(webDir).href + "/", webDir), "home");
    assert.equal(classifyNavigation(pathToFileURL(webDir).href, webDir), "home");
  });

  test("web links leave through the system browser", () => {
    assert.equal(classifyNavigation("https://github.com/jfigge/jsonhippo", webDir), "external");
    assert.equal(classifyNavigation("http://json-schema.org/draft-07/schema#", webDir), "external");
    assert.equal(classifyNavigation("mailto:someone@example.com", webDir), "external");
  });

  test("other local files go nowhere — a dropped file, the app's own sources", () => {
    assert.equal(classifyNavigation(fileUrl("js", "app.js"), webDir), "deny");
    assert.equal(classifyNavigation(fileUrl("..", "main.js"), webDir), "deny");
    assert.equal(classifyNavigation(pathToFileURL(path.resolve("package.json")).href, webDir), "deny");
    assert.equal(classifyNavigation(fileUrl("index.html.bak"), webDir), "deny");
  });

  test("every other scheme, and nonsense, goes nowhere", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<p>hi</p>",
      "blob:file:///0b0c3f1e",
      "ftp://example.com/x.json",
      "chrome://settings",
      "devtools://devtools/bundled/inspector.html",
      "file://otherhost/share/index.html",
      "not a url",
      "",
    ]) {
      assert.equal(classifyNavigation(url, webDir), "deny", url);
    }
  });
});

describe("packaging config (electron/package.json)", () => {
  const { build, version } = JSON.parse(readFileSync("electron/package.json", "utf8"));
  const targets = (platform) => build[platform].target.map((t) => `${t.target}:${t.arch.join("+")}`);

  test("six installers: dmg, nsis and AppImage, each for arm64 and x64", () => {
    assert.deepEqual(targets("mac"), ["dmg:arm64+x64"]);
    assert.deepEqual(targets("win"), ["nsis:x64+arm64"]);
    assert.deepEqual(targets("linux"), ["AppImage:x64+arm64"]);
  });

  test("one Windows installer per architecture, not a combined seventh", () => {
    assert.equal(build.nsis.buildUniversalInstaller, false);
    assert.match(build.nsis.artifactName, /\$\{arch\}/);
    assert.match(build.artifactName, /\$\{arch\}/);
  });

  test("never publishes by itself — the Release workflow does", () => {
    assert.equal(build.publish, null);
  });

  test("the version is stamped at build time, from the root package.json", () => {
    assert.equal(version, "0.0.0");
  });
});
