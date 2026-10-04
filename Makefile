# ─────────────────────────────────────────────────────────────────────────────
#  JsonHippo – a JSON viewer that tells you exactly where it broke
#  Static single-page web app (HTML + CSS + vanilla ES modules, no bundler)
# ─────────────────────────────────────────────────────────────────────────────
#
# Recipes stick to POSIX sh and to what GNU make 3.81 (the one macOS ships)
# understands, so every target runs unchanged on macOS and Linux.

WORKSPACE := $(realpath $(dir $(realpath $(firstword $(MAKEFILE_LIST)))))
SRC_DIR   := $(WORKSPACE)/src
DIST_DIR  := $(WORKSPACE)/dist
BUILD_DIR := $(WORKSPACE)/build
PAGE_DIR  := $(WORKSPACE)/site/product-page

PORT      ?= 8080
SITE_PORT ?= 8791

# A checkout of jfigge/hippoherd. The app is published at
# hippoherd.com/jsonhippo/: `make site` copies dist/ into its website/jsonhippo/.
HIPPOHERD ?= $(WORKSPACE)/../hippoherd

NODE_BIN  := $(WORKSPACE)/node_modules/.bin
HTML      := src/index.html site/product-page/jsonhippo.html

.DEFAULT_GOAL := help

.PHONY: help install serve test lint validate check dist clean fixtures screenshots site preview-site

help:
	@echo ""
	@echo "  JsonHippo — a JSON viewer that tells you exactly where it broke"
	@echo ""
	@echo "  Targets:"
	@echo "    help          List these targets (the default)"
	@echo "    install       Install the dev tooling (npm ci): eslint, html-validate"
	@echo "    serve         Serve src/ at http://localhost:$(PORT)  (PORT=…)"
	@echo "    test          Unit tests (node --test, no framework)"
	@echo "    lint          ESLint over src/js, test and scripts"
	@echo "    validate      html-validate over the app page and the parked product page"
	@echo "    check         lint + validate + test"
	@echo "    dist          Copy src/ to dist/, ready to publish (no bundling)"
	@echo "    clean         Remove dist/ and build/"
	@echo ""
	@echo "  Extras:"
	@echo "    fixtures      Write the large generated fixtures to test/fixtures/large/"
	@echo "    screenshots   Capture the product-page screenshots (needs Chrome)"
	@echo "    site          Publish: check, then copy the app into a hippoherd"
	@echo "                  checkout's website/jsonhippo/  (HIPPOHERD=…, default ../hippoherd)"
	@echo "    preview-site  Serve a hippoherd checkout with this app in it, at"
	@echo "                  http://localhost:$(SITE_PORT)/  — before running make site"
	@echo ""

# npm ci only re-runs when the lockfile changes; the touch stops make from
# re-running it because node_modules/ is older than package-lock.json.
node_modules: package.json package-lock.json
	npm ci
	@touch node_modules

install: node_modules

# scripts/serve.py is `python3 -m http.server` plus Cache-Control: no-store,
# so a plain reload always runs the modules on disk, never a cached copy.
serve:
	python3 scripts/serve.py $(PORT) "$(SRC_DIR)"

test:
	node --test test/*.test.js

lint: node_modules
	"$(NODE_BIN)/eslint" src/js test scripts

validate: node_modules
	"$(NODE_BIN)/html-validate" $(HTML)

check: lint validate test

dist: clean
	mkdir -p "$(DIST_DIR)"
	cp -R "$(SRC_DIR)/." "$(DIST_DIR)/"
	@echo "dist/ is ready to publish."

clean:
	rm -rf "$(DIST_DIR)" "$(BUILD_DIR)"

fixtures:
	node test/fixtures/generate.js test/fixtures/large

screenshots:
	node scripts/screenshots.js

# Publish the app to hippoherd.com/jsonhippo/. hippoherd marks JsonHippo
# `externalSite: true` and `webApp: true` (content/hippos.mjs), so its
# generator never writes that directory and its index card opens the app. The
# copy made here is the only source: --delete keeps it an exact mirror of
# dist/, and `check` runs first so a red build never reaches the site.
# Commit and push in hippoherd afterwards; its CI deploys on push.
site: check dist
	@test -d "$(HIPPOHERD)/website" || { echo "No hippoherd checkout at $(HIPPOHERD) — set HIPPOHERD=…"; exit 1; }
	mkdir -p "$(HIPPOHERD)/website/jsonhippo"
	rsync -a --delete --exclude .DS_Store "$(DIST_DIR)/" "$(HIPPOHERD)/website/jsonhippo/"
	@echo "Published to $(HIPPOHERD)/website/jsonhippo/ — review, commit and push it in hippoherd."

# The whole hippoherd site with this build of the app in it — the index card
# and the click-through — without touching the hippoherd checkout.
preview-site: dist
	@test -d "$(HIPPOHERD)/website" || { echo "No hippoherd checkout at $(HIPPOHERD) — set HIPPOHERD=…"; exit 1; }
	rm -rf "$(BUILD_DIR)/site"
	mkdir -p "$(BUILD_DIR)/site"
	cp -R "$(HIPPOHERD)/website/." "$(BUILD_DIR)/site/"
	rsync -a --delete --exclude .DS_Store "$(DIST_DIR)/" "$(BUILD_DIR)/site/jsonhippo/"
	@echo "hippoherd with this JsonHippo at http://localhost:$(SITE_PORT)/  (app at /jsonhippo/)"
	python3 scripts/serve.py $(SITE_PORT) "$(BUILD_DIR)/site"
