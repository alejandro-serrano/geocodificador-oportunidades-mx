"""
Configuración central del backend.

Todos los endpoints y constantes en un solo lugar. Cada valor se puede
sobrescribir con una variable de entorno, sin tocar el código.
"""
import os

# --- Elasticsearch ---
ES_HOST = os.getenv("ES_HOST", "http://localhost:9200")
ES_INDEX = os.getenv("ES_INDEX", "geocoder_mexico")
ES_TIMEOUT = 30

# --- API de inferencia (05_api.py del laboratorio, Flask + PySpark) ---
API_URL = os.getenv("API_URL", "http://localhost:5001/predict")
API_TIMEOUT = 180  # Spark recalcula features nacionales: puede tardar

# --- Este servidor ---
# 0.0.0.0 para poder abrir la app desde el teléfono en la misma red Wi-Fi.
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# --- Campos del índice (deben coincidir con el mapping del notebook) ---
FIELD_ADDRESS = "DIRECCION_COMPLETA"
FIELD_CP = "CP"
FIELD_MUN = "NOM_MUN"
FIELD_ENT = "NOM_ENT"
FIELD_LOCATION = "location"

# --- Resultados por defecto ---
GEOCODE_SIZE = 5   # candidatos en la búsqueda por texto
REVERSE_SIZE = 3   # vecinos en la búsqueda por coordenada
