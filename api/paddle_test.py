from http.server import BaseHTTPRequestHandler
import json
import paddle
from paddleocr import PaddleOCR

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        response = {
            "success": True,
            "paddle_version": paddle.__version__,
            "message": "PaddleOCR packages loaded successfully!"
        }

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())
