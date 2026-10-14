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

// policy.js — where the page is allowed to go, decided without Electron.
//
// The web app was written for a browser tab, where a link to GitHub replaces
// the page and `href="./"` reloads it. In a desktop window the first would
// strand the user on github.com with no address bar to come back by, and the
// second would open a file:// DIRECTORY listing of the app's own files. So
// main.js asks this module about every navigation and every window.open, and
// this module answers one of four things:
//
//   "app"       the app's own index.html: let it load (a reload, in effect)
//   "home"      the app's directory (`./`): load index.html instead
//   "external"  http(s) or mailto: hand it to the system browser / mail app
//   "deny"      anything else — another local file, a data: or blob: URL,
//               javascript:, a custom scheme — goes nowhere
//
// Pure (no Electron), so `node --test` covers it: test/desktop-policy.test.js.
"use strict";

const path = require("node:path");
const { fileURLToPath } = require("node:url");

const EXTERNAL = new Set(["http:", "https:", "mailto:"]);

/**
 * Classify a URL the page wants to navigate to or open.
 *
 * @param {string} url     the URL Chromium is about to load
 * @param {string} webDir  absolute path of the directory holding index.html
 * @returns {"app"|"home"|"external"|"deny"}
 */
function classifyNavigation(url, webDir) {
  let target;
  try {
    target = new URL(url);
  } catch {
    return "deny";
  }
  if (EXTERNAL.has(target.protocol)) return "external";
  if (target.protocol !== "file:") return "deny";

  let file;
  try {
    file = path.resolve(fileURLToPath(target));
  } catch {
    return "deny"; // e.g. a file://host/ URL, which names no local path
  }
  const root = path.resolve(webDir);
  if (file === path.join(root, "index.html")) return "app";
  if (file === root) return "home";
  return "deny";
}

module.exports = { classifyNavigation };
