import json
import mimetypes
import os
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
STATE_FILE = Path(os.environ.get('AUTH_STATE_FILE', ROOT / 'auth-state.json'))


def read_state():
    if not STATE_FILE.exists():
        return {'users': {}, 'deletedUsers': {}}
    try:
        return json.loads(STATE_FILE.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return {'users': {}, 'deletedUsers': {}}


def write_state(state):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_path = tempfile.mkstemp(dir=STATE_FILE.parent, prefix='.auth-state-', text=True)
    try:
        with os.fdopen(handle, 'w', encoding='utf-8') as output:
            json.dump(state, output, indent=2)
            output.write('\n')
        os.replace(temporary_path, STATE_FILE)
    except Exception:
        try:
            os.unlink(temporary_path)
        except OSError:
            pass
        raise


class Handler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept')

    def send_json(self, status, payload):
        encoded = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(encoded)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self):
        if urlparse(self.path).path != '/api/auth/state':
            self.send_error(404)
            return
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if urlparse(self.path).path == '/api/auth/state':
            self.send_json(200, read_state())
            return

        requested = urlparse(self.path).path.lstrip('/') or 'index.html'
        file_path = (ROOT / requested).resolve()
        if ROOT not in file_path.parents and file_path != ROOT:
            self.send_error(403)
            return
        if not file_path.is_file():
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(file_path.name)[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(file_path.stat().st_size))
        self.end_headers()
        self.wfile.write(file_path.read_bytes())

    def do_PUT(self):
        if urlparse(self.path).path != '/api/auth/state':
            self.send_error(404)
            return
        try:
            payload = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
            if not isinstance(payload, dict) or not isinstance(payload.get('users'), dict):
                raise ValueError
            state = {'users': payload['users'], 'deletedUsers': payload.get('deletedUsers', {})}
            write_state(state)
            self.send_json(200, state)
        except (ValueError, json.JSONDecodeError, OSError):
            self.send_json(400, {'error': 'Invalid auth state.'})

    def log_message(self, format, *args):
        return


if __name__ == '__main__':
    server = ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', '8000'))), Handler)
    print(f'Auth server listening on port {server.server_address[1]}')
    server.serve_forever()