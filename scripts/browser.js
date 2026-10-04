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
 * browser.js — just enough of the Chrome DevTools Protocol to drive a
 * headless Chrome: open a page, run script in it, take a screenshot. Plus a
 * static file server for src/. Node built-ins only (Node 22+ has WebSocket),
 * so the dev tooling stays at two npm packages.
 *
 * Used by scripts/screenshots.js. Dev tooling, not part of the app.
 */

import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";

const CHROME_CANDIDATES = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

/** Serve `root` on 127.0.0.1 at a free port. `block` lists path prefixes to 404. */
export function serve(root, { block = [] } = {}) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    let file = join(root, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (block.some((p) => path.startsWith(p)) || !existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() });
    });
  });
}

/**
 * Launch headless Chrome. `blockUrls` (URL patterns) are refused by the
 * network layer — how the CDN-blocked jQuery fallback is exercised.
 */
export async function launch({ width = 1280, height = 800, scale = 1, blockUrls = [] } = {}) {
  const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chrome) throw new Error("Chrome not found; set CHROME=/path/to/chrome");
  const profile = mkdtempSync(join(tmpdir(), "jsonhippo-chrome-"));
  const proc = spawn(
    chrome,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--disable-extensions",
      `--window-size=${width},${height}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const portFile = join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await new Promise((r) => setTimeout(r, 100));
  const [port, path] = readFileSync(portFile, "utf8").trim().split("\n");
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(`${data.error.message} ${data.error.data ?? ""}`));
      else resolve(data.result);
    } else if (data.method) {
      for (const l of listeners) l(data);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);

  const consoleMessages = [];
  listeners.push((e) => {
    if (e.sessionId !== sessionId) return;
    if (e.method === "Runtime.consoleAPICalled") {
      consoleMessages.push(`${e.params.type}: ${e.params.args.map((a) => a.value ?? a.description).join(" ")}`);
    } else if (e.method === "Runtime.exceptionThrown") {
      consoleMessages.push(`exception: ${e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text}`);
    } else if (e.method === "Log.entryAdded") {
      consoleMessages.push(`${e.params.entry.level}: ${e.params.entry.text}`);
    }
  });

  await page("Page.enable");
  await page("Runtime.enable");
  await page("Log.enable");
  await page("Network.enable");
  if (blockUrls.length) await page("Network.setBlockedURLs", { urls: blockUrls });
  await page("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });

  const waitFor = (method) =>
    new Promise((resolve) => {
      const l = (e) => {
        if (e.sessionId === sessionId && e.method === method) {
          listeners.splice(listeners.indexOf(l), 1);
          resolve(e.params);
        }
      };
      listeners.push(l);
    });

  const api = {
    console: consoleMessages,
    send: page,

    async goto(url) {
      const loaded = waitFor("Page.loadEventFired");
      await page("Page.navigate", { url });
      await loaded;
    },

    /** Evaluate an expression (or an async function body) in the page. */
    async evaluate(expression) {
      const r = await page("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },

    /** Poll `expression` until it is truthy. */
    async until(expression, timeout = 5000) {
      const end = Date.now() + timeout;
      for (;;) {
        if (await api.evaluate(expression)) return;
        if (Date.now() > end) throw new Error(`timed out waiting for ${expression}`);
        await new Promise((r) => setTimeout(r, 50));
      }
    },

    async setTheme(dark) {
      await page("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }] });
    },

    /** PNG bytes. `clip` is {x, y, width, height} in CSS px; `transparent` keeps alpha. */
    async screenshot({ clip, transparent = false } = {}) {
      if (transparent) await page("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
      const { data } = await page("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}), captureBeyondViewport: false });
      if (transparent) await page("Emulation.setDefaultBackgroundColorOverride", {});
      return Buffer.from(data, "base64");
    },

    async close() {
      try {
        await send("Browser.close");
      } catch {
        proc.kill();
      }
      ws.close();
      await new Promise((r) => setTimeout(r, 200));
      rmSync(profile, { recursive: true, force: true });
    },
  };
  return api;
}
