import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class SpaHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if "." not in self.path.split("/")[-1]:
            self.path = "/index.html"
        return super().do_GET()


if __name__ == "__main__":
    port = int(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PORT", "4173"))
    ThreadingHTTPServer(("127.0.0.1", port), SpaHandler).serve_forever()
