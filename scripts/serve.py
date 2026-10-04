#!/usr/bin/env python3
#
# Copyright 2026 Jason Figge
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

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
