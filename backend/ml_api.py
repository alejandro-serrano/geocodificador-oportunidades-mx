"""
COMPONENTE B.1 — Cliente de la API de inferencia (05_api.py, Flask + PySpark).

Contrato del servicio (definido en 05_api.py):

    POST http://localhost:5001/predict
    Request : {"latitude": 21.88, "longitude": -102.29}
    Response: {"input_coordinates": {...},
               "prediction": "OXXO" | "Abarrotes",
               "confidence": 87.34}          # porcentaje 0-100

Se mantiene aislado de la UI por dos razones:
  1. El Componente A debe seguir funcionando aunque la API esté caída
     (son servicios independientes y así lo pide la rúbrica: la
     geocodificación es la calificación base).
  2. Permite probar el cliente contra un servidor simulado sin Spark.

NOTA DE RENDIMIENTO: cada POST hace que Spark recalcule las features
espaciales del punto contra el DENUE y el Censo NACIONAL. Es una operación
de decenas de segundos, no de milisegundos. De ahí el timeout generoso y
el cacheo por coordenada que hace app.py.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional

import requests

import config

# Etiquetas que devuelve el modelo GBT entrenado en 03_ClasificacionSupervisada_GBT
CLASE_OXXO = "OXXO"
CLASE_ABARROTES = "Abarrotes"


@dataclass
class Prediccion:
    """Resultado de la inferencia para una coordenada."""
    clase: str                      # "OXXO" | "Abarrotes"
    confianza: float                # porcentaje 0-100
    lat: float
    lon: float
    segundos: Optional[float] = None  # latencia medida de extremo a extremo

    @property
    def es_oxxo(self) -> bool:
        return self.clase.upper() == CLASE_OXXO


class APIError(RuntimeError):
    """Fallo al consumir la API de inferencia, con mensaje legible para la UI."""


# =============================================================================
# Salud del servicio
# =============================================================================
def salud(url: str = config.API_URL, timeout: float = 3.0) -> tuple[bool, str]:
    """Comprueba si la API responde, sin lanzar excepción.

    La API solo expone POST /predict, así que un GET devuelve 405
    (Method Not Allowed). Eso ya confirma que Flask está vivo y escuchando:
    no hace falta —ni conviene— disparar una inferencia real solo para
    saber si el servicio está arriba.
    """
    try:
        r = requests.get(url, timeout=timeout)
    except requests.Timeout:
        return False, "La API no respondió a tiempo."
    except requests.ConnectionError:
        return False, f"No hay servicio en {url}. ¿Ejecutaste `python 05_api.py`?"
    except requests.RequestException as e:
        return False, f"Error de red: {e}"

    if r.status_code in (200, 405):
        return True, "Servicio activo"
    return False, f"Respuesta inesperada del servidor (HTTP {r.status_code})."


def api_disponible(url: str = config.API_URL) -> bool:
    """Azúcar sintáctico sobre salud() cuando solo interesa el booleano."""
    return salud(url)[0]


# =============================================================================
# Inferencia
# =============================================================================
def _validar_coordenadas(lat: float, lon: float) -> tuple[float, float]:
    """Evita gastar decenas de segundos de Spark en una coordenada inválida."""
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        raise APIError("Las coordenadas no son numéricas.")
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise APIError(f"Coordenadas fuera de rango: ({lat}, {lon}).")
    return lat, lon


def predecir(
    lat: float,
    lon: float,
    url: str = config.API_URL,
    timeout: int = config.API_TIMEOUT,
) -> Prediccion:
    """Envía las coordenadas a la API de Spark y devuelve la predicción.

    Lanza APIError con un mensaje accionable ante cualquier fallo, para que
    la UI lo muestre como aviso en vez de romperse con una traza.
    """
    lat, lon = _validar_coordenadas(lat, lon)
    inicio = time.perf_counter()

    try:
        r = requests.post(
            url,
            json={"latitude": lat, "longitude": lon},
            timeout=timeout,
        )
    except requests.Timeout:
        raise APIError(
            f"La API superó el límite de {timeout}s. Recuerda que /predict "
            "recalcula las features espaciales contra el DENUE y el Censo "
            "nacional en cada petición."
        )
    except requests.ConnectionError:
        raise APIError(
            f"No se pudo conectar con {url}. Verifica que `05_api.py` esté "
            "corriendo y que HDFS esté activo."
        )
    except requests.RequestException as e:
        raise APIError(f"Fallo de red al contactar la API: {e}")

    segundos = time.perf_counter() - inicio

    # --- Errores HTTP: 05_api.py devuelve 400 y 500 con cuerpo JSON ---
    if r.status_code != 200:
        detalle = r.text
        try:
            cuerpo = r.json()
            detalle = cuerpo.get("details") or cuerpo.get("error") or r.text
        except ValueError:
            pass
        raise APIError(f"La API respondió HTTP {r.status_code}: {detalle}")

    # --- Cuerpo malformado (p. ej. Flask devolviendo una página de error) ---
    try:
        data = r.json()
    except ValueError:
        raise APIError("La API devolvió una respuesta que no es JSON válido.")

    if "prediction" not in data or "confidence" not in data:
        raise APIError(f"Respuesta sin los campos esperados: {data}")

    try:
        confianza = float(data["confidence"])
    except (TypeError, ValueError):
        raise APIError(f"Confianza no numérica en la respuesta: {data['confidence']!r}")

    return Prediccion(
        clase=str(data["prediction"]),
        confianza=confianza,
        lat=lat,
        lon=lon,
        segundos=segundos,
    )
