"""
Levanta el backend real con Elasticsearch simulado, para que las pruebas del
frontend hablen contra las rutas de verdad.

    python3 servidor_de_prueba.py [puerto]

Reutiliza el ESFalso de las pruebas del backend: una sola definicion de los
datos de ejemplo para los dos lados.
"""
import sys
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "..", "backend"))
sys.path.insert(0, os.path.join(AQUI, "..", "..", "backend", "tests"))

import api          # noqa: E402
import config       # noqa: E402
from test_api import ESFalso  # noqa: E402

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8099

# La API de Spark tambien se simula: stub_api.py debe estar en el 5599.
config.API_URL = "http://127.0.0.1:5599/predict"
api.es = ESFalso()
api.predecir_cacheado.cache_clear()

api.app.run(host="127.0.0.1", port=PUERTO, debug=False)
