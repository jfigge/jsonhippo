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
SITE_DIR  := $(HIPPOHERD)/website/jsonhippo

# Where ViewHippo — the herd's desktop app, built in hippoherd — takes this
# viewer from. Its build currently packages SITE_DIR itself (minus about/), so
# by default the one copy feeds both and `make site` copies nothing extra. If
# ViewHippo's spec settles on a directory of its own, point this there and
# `make site` fills it too.
VIEWHIPPO_DIR ?= $(SITE_DIR)

# hippoherd's own page ABOUT JsonHippo lives in the same directory as the app,
# at website/jsonhippo/about/. It is generated there by hippoherd (`page` in its
# content/hippos.mjs), so the copy below must leave it alone: an rsync --delete
# of dist/ would remove it.
HIPPOHERD_PAGE := /about/

NODE_BIN  := $(WORKSPACE)/node_modules/.bin
HTML      := src/index.html src/docs/index.html site/product-page/jsonhippo.html

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
	@echo "                  and into ViewHippo's input  (VIEWHIPPO_DIR=…, default the same)"
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

# Publish the app to hippoherd.com/jsonhippo/. hippoherd's generator never
# writes website/jsonhippo/index.html — JsonHippo's entry in its
# content/hippos.mjs puts the page about it at /jsonhippo/about/ and names
# /jsonhippo/ as the app — so the copy made here is the only source of the
# app: --delete keeps it an exact mirror of dist/, except for that page
# (HIPPOHERD_PAGE, above), and `check` runs first so a red build never reaches
# the site. Commit and push in hippoherd afterwards; its CI deploys on push.
#
# The same run feeds ViewHippo: VIEWHIPPO_DIR, above, gets its own exact mirror
# of dist/ when it is not SITE_DIR. Either way, ViewHippo ships the copy made
# here and never holds viewer code of its own.
site: check dist
	@test -d "$(HIPPOHERD)/website" || { echo "No hippoherd checkout at $(HIPPOHERD) — set HIPPOHERD=…"; exit 1; }
	mkdir -p "$(SITE_DIR)"
	rsync -a --delete --exclude .DS_Store --exclude "$(HIPPOHERD_PAGE)" "$(DIST_DIR)/" "$(SITE_DIR)/"
	@echo "Published to $(SITE_DIR)/ — review, commit and push it in hippoherd."
ifeq ($(abspath $(VIEWHIPPO_DIR)),$(abspath $(SITE_DIR)))
	@echo "ViewHippo packages that same directory: nothing more to copy."
else
	mkdir -p "$(abspath $(VIEWHIPPO_DIR))"
	rsync -a --delete --exclude .DS_Store "$(DIST_DIR)/" "$(abspath $(VIEWHIPPO_DIR))/"
	@echo "Copied to $(abspath $(VIEWHIPPO_DIR))/ for ViewHippo — commit it with the site."
endif

# The whole hippoherd site with this build of the app in it — the index card,
# the page about the app, and the app — without touching the hippoherd checkout.
preview-site: dist
	@test -d "$(HIPPOHERD)/website" || { echo "No hippoherd checkout at $(HIPPOHERD) — set HIPPOHERD=…"; exit 1; }
	rm -rf "$(BUILD_DIR)/site"
	mkdir -p "$(BUILD_DIR)/site"
	cp -R "$(HIPPOHERD)/website/." "$(BUILD_DIR)/site/"
	rsync -a --delete --exclude .DS_Store --exclude "$(HIPPOHERD_PAGE)" "$(DIST_DIR)/" "$(BUILD_DIR)/site/jsonhippo/"
	@echo "hippoherd with this JsonHippo at http://localhost:$(SITE_PORT)/  (app at /jsonhippo/, its page at /jsonhippo$(HIPPOHERD_PAGE))"
	python3 scripts/serve.py $(SITE_PORT) "$(BUILD_DIR)/site"
