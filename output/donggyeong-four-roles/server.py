from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
ROOT = Path(__file__).resolve().parent
PUBLIC = Path('/Users/yondori/Developer/PlayGyeongju/tourism-data-2026/frontend/public')
class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = urlparse(path).path
        return str((PUBLIC if path.startswith('/models/') else ROOT) / (path.lstrip('/') or 'index.html'))
    def do_POST(self):
        if self.path != '/save/donggyeong-four-roles.png':
            self.send_error(400)
            return
        (ROOT / 'donggyeong-four-roles.png').write_bytes(self.rfile.read(int(self.headers['Content-Length'])))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'ok')
ThreadingHTTPServer(('127.0.0.1', 4318), Handler).serve_forever()
