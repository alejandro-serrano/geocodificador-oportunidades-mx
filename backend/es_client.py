"""
Capa de acceso a Elasticsearch.

Encapsula toda la comunicación con el índice `geocoder_mexico` para que la
capa de rutas (api.py) no tenga que conocer detalles del DSL de consulta.

Nota importante sobre el campo `location`:
en el índice se almacenó como un STRING con formato "lat,lon" (ver la celda de
indexación de 02_IndexacionGeoespacial.ipynb, donde se usó concat_ws). Aunque el
mapping lo declara como geo_point —lo cual permite consultas geoespaciales—, al
recuperar el _source lo que regresa es el string original. Por eso todo parseo
pasa por parse_location().
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Optional

from elasticsearch import Elasticsearch

import config


# =============================================================================
# Modelo de dominio
# =============================================================================
@dataclass
class Direccion:
    """Una dirección estandarizada resuelta desde el índice."""
    direccion_completa: str
    cp: str
    municipio: str
    estado: str
    lat: float
    lon: float
    score: Optional[float] = None      # relevancia (búsqueda por texto)
    distancia_km: Optional[float] = None  # distancia (búsqueda inversa)

    def as_dict(self) -> dict:
        return asdict(self)


# =============================================================================
# Conexión
# =============================================================================
def get_client(host: str = config.ES_HOST) -> Elasticsearch:
    """Crea el cliente de Elasticsearch.

    api.py crea uno solo al arrancar y lo reutiliza en todas las peticiones.
    """
    return Elasticsearch(host, request_timeout=config.ES_TIMEOUT)


def ping(es: Elasticsearch) -> tuple[bool, str]:
    """Comprueba conectividad y existencia del índice.

    Devuelve (ok, mensaje) para poder mostrar un diagnóstico claro en la UI
    en vez de una traza de error críptica.
    """
    try:
        if not es.ping():
            return False, f"No hay respuesta de Elasticsearch en {config.ES_HOST}"
        if not es.indices.exists(index=config.ES_INDEX):
            return False, f"El índice '{config.ES_INDEX}' no existe. Ejecuta 02_IndexacionGeoespacial.ipynb"
        n = es.count(index=config.ES_INDEX)["count"]
        if n == 0:
            return False, f"El índice '{config.ES_INDEX}' existe pero está vacío."
        return True, f"{n:,} domicilios indexados"
    except Exception as e:  # noqa: BLE001 - queremos reportar cualquier fallo en la UI
        return False, f"Error de conexión: {e}"


# =============================================================================
# Utilidades de parseo
# =============================================================================
def parse_location(raw) -> tuple[float, float]:
    """Normaliza el campo `location` a (lat, lon).

    Elasticsearch acepta geo_point en varios formatos y el nuestro se indexó
    como string, pero soportamos las demás variantes por robustez:
      - "21.88,-102.29"            -> string  (nuestro caso)
      - {"lat": .., "lon": ..}     -> objeto
      - [lon, lat]                 -> array GeoJSON (¡ojo al orden invertido!)
    """
    if isinstance(raw, str):
        lat_s, lon_s = raw.split(",")
        return float(lat_s), float(lon_s)
    if isinstance(raw, dict):
        return float(raw["lat"]), float(raw["lon"])
    if isinstance(raw, (list, tuple)) and len(raw) == 2:
        return float(raw[1]), float(raw[0])  # GeoJSON es [lon, lat]
    raise ValueError(f"Formato de 'location' no reconocido: {raw!r}")


def _hit_to_direccion(hit: dict) -> Direccion:
    """Convierte un hit crudo de Elasticsearch en un objeto Direccion."""
    src = hit["_source"]
    lat, lon = parse_location(src[config.FIELD_LOCATION])

    # En la búsqueda inversa el valor de ordenamiento es la distancia en km.
    distancia = None
    if "sort" in hit and hit["sort"]:
        try:
            distancia = float(hit["sort"][0])
        except (TypeError, ValueError):
            distancia = None

    return Direccion(
        direccion_completa=src.get(config.FIELD_ADDRESS, ""),
        cp=src.get(config.FIELD_CP, ""),
        municipio=src.get(config.FIELD_MUN, ""),
        estado=src.get(config.FIELD_ENT, ""),
        lat=lat,
        lon=lon,
        score=hit.get("_score"),
        distancia_km=distancia,
    )


# =============================================================================
# COMPONENTE A.1 — Geocodificación directa (Dirección -> Coordenadas)
# =============================================================================
def build_forward_query(texto: str, size: int) -> dict:
    """Construye la consulta multi_match para búsqueda por texto.

    Decisiones de diseño:
      - `DIRECCION_COMPLETA^3` pesa el triple porque es el campo que realmente
        contiene la calle y el número; NOM_MUN y NOM_ENT solo desempatan.
      - `fuzziness: AUTO` tolera errores de tipeo ("Nacosari" -> "Nacozari").
      - `type: best_fields` premia al documento donde un solo campo concentra
        la mejor coincidencia, que es lo natural en direcciones.
      - `operator: or` con `minimum_should_match: 60%` evita que una consulta
        larga devuelva cero resultados por una sola palabra ausente, pero
        exige que la mayoría de los términos coincidan.
    """
    return {
        "size": size,
        "query": {
            "multi_match": {
                "query": texto,
                "fields": [
                    f"{config.FIELD_ADDRESS}^3",
                    config.FIELD_MUN,
                    config.FIELD_ENT,
                ],
                "type": "best_fields",
                "fuzziness": "AUTO",
                "operator": "or",
                "minimum_should_match": "60%",
            }
        },
    }


def geocodificar(es: Elasticsearch, texto: str, size: int = 5) -> list[Direccion]:
    """Dirección en texto libre -> lista de direcciones candidatas.

    La primera del listado es la más relevante (mayor _score) y es la que la
    UI usa para centrar el mapa. Devolvemos varias para permitir al usuario
    corregir cuando la consulta es ambigua.
    """
    texto = (texto or "").strip()
    if not texto:
        return []

    resp = es.search(index=config.ES_INDEX, body=build_forward_query(texto, size))
    return [_hit_to_direccion(h) for h in resp["hits"]["hits"]]


# =============================================================================
# COMPONENTE A.2 — Geocodificación inversa (Coordenadas -> Dirección)
# =============================================================================
def build_reverse_query(lat: float, lon: float, size: int) -> dict:
    """Consulta _geo_distance: ordena todos los documentos por cercanía.

    `match_all` + sort por _geo_distance es la forma canónica descrita en la
    guía del curso. El valor de `sort` que regresa cada hit ES la distancia,
    así que la obtenemos gratis sin recalcularla en Python.
    """
    return {
        "size": size,
        "query": {"match_all": {}},
        "sort": [
            {
                "_geo_distance": {
                    config.FIELD_LOCATION: {"lat": lat, "lon": lon},
                    "order": "asc",
                    "unit": "km",
                    "distance_type": "arc",
                }
            }
        ],
    }


def geocodificar_inverso(
    es: Elasticsearch, lat: float, lon: float, size: int = config.REVERSE_SIZE
) -> list[Direccion]:
    """Coordenadas -> las N direcciones más próximas, ordenadas por distancia."""
    resp = es.search(index=config.ES_INDEX, body=build_reverse_query(lat, lon, size))
    return [_hit_to_direccion(h) for h in resp["hits"]["hits"]]
