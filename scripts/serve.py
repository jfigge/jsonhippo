#!/usr/bin/env python3
#
# Copyright 2026 Jason Figge
#
# This file is part of JsonHippo.
#
# JsonHippo is free software: you can redistribute it and/or modify it under
# the terms of the GNU General Public License as published by the Free
# Software Foundation, either version 3 of the License, or (at your option)
# any later version.
#
# JsonHippo is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with JsonHippo. If not, see <https://www.gnu.org/licenses/>.

"""serve.py — `make serve`: `python3 -m http.server`, minus the stale code.

The stock server sends Last-Modified but no Cache-Control, so the browser
caches the ES modules on its own heuristic (a tenth of the file's age) and a
normal reload keeps running the old ones: edit smart-paste.js, reload, and the
page still behaves as before until a hard reload. This tells the browser not
to store anything, so a reload always runs what is on disk.

    python3 scripts/serve.py PORT DIRECTORY
"""

import functools
import http.server
import sys


class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port, root = int(sys.argv[1]), sys.argv[2]
    handler = functools.partial(NoStoreHandler, directory=root)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Serving {root} at http://localhost:{port}/ (no caching; Ctrl-C to stop)", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
