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
SITE_DIR  := $(WORKSPACE)/site/hippoherd

PORT      ?= 8080
SITE_PORT ?= 8791

# A checkout of jfigge/hippoherd. `make site` writes the product page into
# it; `make preview-site` borrows its site.css to show the page in context.
HIPPOHERD ?= $(WORKSPACE)/../hippoherd

# The product page as hippoherd serves it: website/jsonhippo/index.html plus
# its img/. Assembled here so both targets ship exactly the same files.
SITE_STAGE := $(BUILD_DIR)/site-jsonhippo

NODE_BIN  := $(WORKSPACE)/node_modules/.bin
HTML      := src/index.html site/hippoherd/jsonhippo.html

.DEFAULT_GOAL := help

.PHONY: help install serve test lint validate check dist clean fixtures screenshots site stage-site preview-site

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
	@echo "    validate      html-validate over the app page and the hippoherd page"
	@echo "    check         lint + validate + test"
	@echo "    dist          Copy src/ to dist/, ready to publish (no bundling)"
	@echo "    clean         Remove dist/ and build/"
	@echo ""
	@echo "  Extras:"
	@echo "    fixtures      Write the large generated fixtures to test/fixtures/large/"
	@echo "    screenshots   Capture the product-page screenshots (needs Chrome)"
	@echo "    site          Sync the product page into a hippoherd checkout's"
	@echo "                  website/jsonhippo/  (HIPPOHERD=…, default ../hippoherd)"
	@echo "    preview-site  Serve the product page inside a hippoherd checkout"
	@echo "                  at http://localhost:$(SITE_PORT)/jsonhippo/  (HIPPOHERD=…)"
	@echo ""

# npm ci only re-runs when the lockfile changes; the touch stops make from
# re-running it because node_modules/ is older than package-lock.json.
node_modules: package.json package-lock.json
	npm ci
	@touch node_modules

install: node_modules

serve:
	@echo "JsonHippo at http://localhost:$(PORT)/  (Ctrl-C to stop)"
	python3 -m http.server $(PORT) --bind 127.0.0.1 -d "$(SRC_DIR)"

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

# The page ships as index.html beside its screenshots. The README and the
# html-validate override in site/hippoherd/ are this repo's business only.
stage-site:
	rm -rf "$(SITE_STAGE)"
	mkdir -p "$(SITE_STAGE)"
	cp "$(SITE_DIR)/jsonhippo.html" "$(SITE_STAGE)/index.html"
	cp -R "$(SITE_DIR)/img" "$(SITE_STAGE)/img"

# Like `make site` in jfigge/rollhippo, mazehippo and scanhippo: hippoherd
# marks JsonHippo `externalSite: true`, so its generator never writes this
# page and the copy here is the only source. --delete keeps the target an
# exact mirror (a screenshot removed here disappears there too). The mark is
# NOT copied: hippoherd draws it with scripts/make-marks.mjs, from an entry
# that reproduces src/img/jsonhippo.svg.
site: validate stage-site
	@test -d "$(HIPPOHERD)/website" || { echo "No hippoherd checkout at $(HIPPOHERD) — set HIPPOHERD=…"; exit 1; }
	mkdir -p "$(HIPPOHERD)/website/jsonhippo"
	rsync -a --delete "$(SITE_STAGE)/" "$(HIPPOHERD)/website/jsonhippo/"
	@echo "Synced to $(HIPPOHERD)/website/jsonhippo/ — review and commit it in hippoherd."

preview-site: stage-site
	@test -d "$(HIPPOHERD)/website" || { echo "No hippoherd checkout at $(HIPPOHERD) — set HIPPOHERD=…"; exit 1; }
	rm -rf "$(BUILD_DIR)/site"
	mkdir -p "$(BUILD_DIR)/site"
	cp -R "$(HIPPOHERD)/website/." "$(BUILD_DIR)/site/"
	rsync -a --delete "$(SITE_STAGE)/" "$(BUILD_DIR)/site/jsonhippo/"
	cp "$(SRC_DIR)/img/jsonhippo.svg" "$(BUILD_DIR)/site/marks/jsonhippo.svg"
	@echo "Product page at http://localhost:$(SITE_PORT)/jsonhippo/  (Ctrl-C to stop)"
	python3 -m http.server $(SITE_PORT) --bind 127.0.0.1 -d "$(BUILD_DIR)/site"
