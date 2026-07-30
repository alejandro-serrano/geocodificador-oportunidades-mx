"""
Servidor que imita el contrato de 05_api.py, incluidos sus modos de fallo.

Permite probar el backend sin levantar Spark ni HDFS. Cada ruta reproduce una
respuesta distinta; el puerto se pasa como argumento.

    python3 stub_api.py [puerto]
"""
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 5599


class Manejador(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # silencio: las pruebas ya imprimen lo suyo

    def responder(self, codigo, cuerpo, crudo=False):
        datos = cuerpo.encode() if crudo else json.dumps(cuerpo).encode()
        self.send_response(codigo)
        self.send_header("Content-Type", "text/html" if crudo else "application/json")
        self.send_header("Content-Length", str(len(datos)))
        self.end_headers()
        self.wfile.write(datos)

    def do_GET(self):
        # Flask responde 405 a un GET sobre una ruta que solo acepta POST.
        # ml_api.salud() se apoya en eso para saber si el servicio está vivo.
        self.responder(405, {"error": "Method Not Allowed"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        peticion = json.loads(self.rfile.read(n))
        ruta = self.path

        if ruta == "/predict":                 # OXXO, confianza alta
            self.responder(200, {
                "input_coordinates": {"latitude": peticion["latitude"],
                                      "longitude": peticion["longitude"]},
                "prediction": "OXXO", "confidence": 87.34,
            })
        elif ruta == "/medio":                 # Abarrotes, confianza media
            self.responder(200, {"prediction": "Abarrotes", "confidence": 76.0})
        elif ruta == "/bajo":                  # confianza baja
            self.responder(200, {"prediction": "OXXO", "confidence": 63.5})
        elif ruta == "/error500":
            self.responder(500, {"error": "Error interno del servidor.",
                                 "details": "Py4JJavaError: OutOfMemoryError"})
        elif ruta == "/nojson":
            self.responder(200, "<html><h1>500 Internal Server Error</h1></html>", crudo=True)
        elif ruta == "/lento":
            time.sleep(5)
            self.responder(200, {"prediction": "OXXO", "confidence": 90.0})
        else:
            self.responder(404, {"error": "not found"})


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", PUERTO), Manejador).serve_forever()
