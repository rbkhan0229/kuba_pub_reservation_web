import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class SpaHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        request_path = urlsplit(self.path).path
        if "." not in request_path.split("/")[-1]:
            self.path = "/index.html"
        return super().do_GET()


if __name__ == "__main__":
    port = int(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PORT", "4173"))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"Serving on http://{host}:{port}")
    handler = partial(SpaHandler, directory=BASE_DIR)
    ThreadingHTTPServer((host, port), handler).serve_forever()
