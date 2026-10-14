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

// main.js — the Electron shell for JsonHippo.
//
// The app is the static page in web/, loaded exactly as the browser loads it:
// `make desktop-setup` copies the repo's src/ there (via dist/) and nothing in
// it is changed. This file only gives that page a window and keeps it to
// itself:
//
//   * The renderer is sandboxed with no preload and no Node — the page never
//     needed either, and so it gets neither.
//   * No request leaves the machine. index.html asks cdnjs for jQuery first;
//     that request is cancelled here, its <script> fails, and app.js falls back
//     to vendor/jquery.min.js — the identical file, already in the bundle. So
//     the desktop app works offline from the first launch and tells no CDN
//     that it was opened.
//   * Links leave through the system browser, never in this window (see
//     policy.js for why that matters for a page written for a tab).
//
// CommonJS, like the sibling apps' main processes (Rest Hippo, Chip Hippo).
"use strict";

const { app, BrowserWindow, Menu, nativeTheme, session, shell } = require("electron");
const path = require("node:path");

const { classifyNavigation } = require("./policy");

// `make desktop` runs this file straight from electron/ against the repo's
// src/, so an edit to the app shows on reload without a package step. A
// packaged build ignores the override and only ever loads its own copy.
const WEB_DIR =
  !app.isPackaged && process.env.JSONHIPPO_WEB_DIR
    ? path.resolve(process.env.JSONHIPPO_WEB_DIR)
    : path.join(__dirname, "web");
const INDEX = path.join(WEB_DIR, "index.html");
// The page's one hint that it is the desktop build: About shows this version.
const INDEX_OPTIONS = { query: { desktop: app.getVersion() } };

const HOME_PAGE = "https://hippoherd.com/jsonhippo/about/";
const WEB_APP = "https://hippoherd.com/jsonhippo/";
const SOURCE = "https://github.com/jfigge/jsonhippo";
const USER_GUIDE = `${WEB_APP}docs/`;

// The page's own --bg in each theme (src/css/app.css), so the window does not
// flash white before a dark first paint.
const BACKGROUND = { light: "#ffffff", dark: "#1c1c1c" };

// How long to wait for the first paint before showing the window anyway. A
// window that never appears is worse than one that appears a frame early.
const SHOW_TIMEOUT_MS = 3000;

let mainWindow = null;

function openExternal(url) {
  shell.openExternal(url).catch((err) => console.error(`[main] could not open ${url}:`, err));
}

// ── The session: offline, and asking for nothing ─────────────────────────────

function lockDownSession() {
  const ses = session.defaultSession;

  // Every network request is cancelled — see the note at the top of the file.
  // file:// is not matched, so the app's own files load as normal.
  ses.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
    (_details, callback) => callback({ cancel: true }),
  );

  // The page asks for one permission, and only through its Copy buttons:
  // clipboard writes (util.js copyText, which also has a fallback). Camera,
  // geolocation, notifications and the rest are refused without a prompt.
  ses.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === "clipboard-sanitized-write");
  });
}

// ── The window ───────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 480,
    title: "JsonHippo",
    backgroundColor: nativeTheme.shouldUseDarkColors ? BACKGROUND.dark : BACKGROUND.light,
    // Windows and Linux take the window icon from here; macOS uses the bundle's.
    icon: path.join(__dirname, "icons", "linux", "512x512.png"),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // Show on the first paint, or on whichever fallback arrives first: a failed
  // load or a renderer that dies never fires ready-to-show.
  let shown = false;
  let timer = null;
  const show = () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    clearTimeout(timer);
    win.show();
  };
  timer = setTimeout(show, SHOW_TIMEOUT_MS);
  win.once("ready-to-show", show);
  win.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return;
    console.error(`[main] load failed: ${url} — ${desc} (${code})`);
    show();
  });
  win.webContents.on("render-process-gone", (_e, details) => {
    console.error(`[main] renderer gone: ${details.reason}`);
    show();
  });

  // A link click or a script navigation. Only the app's own page loads here.
  win.webContents.on("will-navigate", (event, url) => {
    const verdict = classifyNavigation(url, WEB_DIR);
    if (verdict === "app") return;
    event.preventDefault();
    if (verdict === "home") win.loadFile(INDEX, INDEX_OPTIONS);
    else if (verdict === "external") openExternal(url);
  });

  // window.open and target=_blank: never a second Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (classifyNavigation(url, WEB_DIR) === "external") openExternal(url);
    return { action: "deny" };
  });

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.loadFile(INDEX, INDEX_OPTIONS).catch((err) => console.error("[main] index.html failed to load:", err));
  mainWindow = win;
  return win;
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ── The menu ─────────────────────────────────────────────────────────────────
// Mostly roles, which is what makes ⌘C / ⌘V / ⌘Z work at all on macOS: there,
// the clipboard shortcuts are menu items, and an app without an Edit menu
// cannot paste.

function buildMenu() {
  const isMac = process.platform === "darwin";
  const view = [
    { role: "reload" },
    { role: "forceReload" },
    ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }]),
    { type: "separator" },
    { role: "resetZoom" },
    { role: "zoomIn" },
    { role: "zoomOut" },
    { type: "separator" },
    { role: "togglefullscreen" },
  ];
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { label: "View", submenu: view },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "User Guide", click: () => openExternal(USER_GUIDE) },
        { label: "JsonHippo in the Browser", click: () => openExternal(WEB_APP) },
        { label: "JsonHippo on Hippo Herd", click: () => openExternal(HOME_PAGE) },
        { type: "separator" },
        { label: "Source on GitHub", click: () => openExternal(SOURCE) },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

// One window, one process: a second launch focuses the first.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);

  app.whenReady().then(() => {
    app.setAboutPanelOptions({
      applicationName: "JsonHippo",
      applicationVersion: app.getVersion(),
      copyright: "Copyright © 2026 Jason Figge · GPL-3.0-or-later",
      credits: "Designed by Jason, Coded by Claude",
      website: HOME_PAGE,
    });
    lockDownSession();
    Menu.setApplicationMenu(buildMenu());
    createWindow();

    // macOS: clicking the dock icon with no window open brings one back.
    app.on("activate", showWindow);
  });

  // JsonHippo holds one document in one window, so closing it quits — on
  // macOS too, as Chip Hippo does, rather than leaving a windowless app in
  // the dock.
  app.on("window-all-closed", () => app.quit());
}
