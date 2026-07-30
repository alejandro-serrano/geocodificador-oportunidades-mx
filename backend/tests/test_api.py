"""
Pruebas de las cuatro rutas, con el cliente de pruebas de Flask.

No hace falta Elasticsearch: se sustituye por un objeto que devuelve
respuestas preparadas con la misma forma que las reales. La API de Spark sí
se levanta, pero como el stub de stub_api.py.

    python3 test_api.py
"""
import json
import sys

sys.path.insert(0, "..")

import api          # noqa: E402
import config       # noqa: E402
import ml_api       # noqa: E402

BASE_STUB = "http://127.0.0.1:5599"


# =============================================================================
# Elasticsearch simulado
# =============================================================================
def documento(direccion, lat, lon, municipio="ASIENTOS"):
    """Un _source con la misma forma que produjo el notebook de indexación."""
    return {
        config.FIELD_ADDRESS: direccion,
        config.FIELD_CP: "20710",
        config.FIELD_MUN: municipio,
        config.FIELD_ENT: "AGUASCALIENTES",
        # location se indexó como string "lat,lon" (concat_ws)
        config.FIELD_LOCATION: f"{lat},{lon}",
    }


class ESFalso:
    """Devuelve resultados fijos. `roto` fuerza un fallo de conexión."""

    def __init__(self, roto=False, vacio=False):
        self.roto = roto
        self.vacio = vacio
        self.ultima_query = None

    def ping(self):
        if self.roto:
            raise ConnectionError("connection refused")
        return True

    @property
    def indices(self):
        es = self

        class Indices:
            def exists(self, index):
                return True
        return Indices()

    def count(self, index):
        return {"count": 0 if self.vacio else 33_600_000}

    def search(self, index, body):
        if self.roto:
            raise ConnectionError("connection refused")
        self.ultima_query = body

        # Búsqueda inversa: lleva sort por _geo_distance
        if "sort" in body:
            hits = [
                {"_source": documento("CALLE GALEANA SN", 22.238153, -102.089118),
                 "_score": None, "sort": [0.006]},
                {"_source": documento("CALLE JUVENTUD SN", 22.236240, -102.088470),
                 "_score": None, "sort": [0.217]},
            ]
        else:
            hits = [
                {"_source": documento("AV HEROE DE NACOZARI SUR 2301", 21.88, -102.296,
                                      "AGUASCALIENTES"), "_score": 48.2},
                {"_source": documento("AV HEROE DE NACOZARI NORTE 100", 21.90, -102.290,
                                      "AGUASCALIENTES"), "_score": 31.0},
            ]
        return {"hits": {"hits": hits[: body.get("size", 5)]}}


def cliente(es_falso=None, api_url=None):
    """Prepara la app con sus dependencias sustituidas."""
    api.es = es_falso if es_falso is not None else ESFalso()
    if api_url:
        config.API_URL = api_url
    api.predecir_cacheado.cache_clear()
    api.app.config["TESTING"] = True
    return api.app.test_client()


def cuerpo(respuesta):
    return json.loads(respuesta.data)


# =============================================================================
# 1. /api/health
# =============================================================================
def test_health():
    c = cliente(api_url=f"{BASE_STUB}/predict")
    r = c.get("/api/health")
    d = cuerpo(r)
    assert r.status_code == 200
    assert d["elasticsearch"]["ok"] is True
    assert "33,600,000" in d["elasticsearch"]["mensaje"]
    assert d["api_spark"]["ok"] is True
    print("OK health con ambos servicios arriba ->", d["elasticsearch"]["mensaje"])

    # Los dos servicios se informan por separado: uno puede caerse sin el otro.
    c = cliente(api_url="http://127.0.0.1:5998/predict")
    d = cuerpo(c.get("/api/health"))
    assert d["elasticsearch"]["ok"] is True and d["api_spark"]["ok"] is False
    assert "05_api.py" in d["api_spark"]["mensaje"]
    print("OK health distingue ES arriba con API caida")

    c = cliente(ESFalso(roto=True))
    d = cuerpo(c.get("/api/health"))
    assert d["elasticsearch"]["ok"] is False
    print("OK health con Elasticsearch caido ->", d["elasticsearch"]["mensaje"][:52])


# =============================================================================
# 2. /api/geocode
# =============================================================================
def test_geocode():
    es = ESFalso()
    c = cliente(es)

    r = c.get("/api/geocode?q=Heroe de Nacozari 2301 Aguascalientes")
    d = cuerpo(r)
    assert r.status_code == 200
    primero = d["resultados"][0]
    assert primero["direccion_completa"].startswith("AV HEROE")
    assert primero["lat"] == 21.88 and primero["lon"] == -102.296
    assert primero["municipio"] and primero["estado"] and primero["cp"]
    assert primero["score"] == 48.2
    print(f"OK geocode -> {primero['direccion_completa'][:38]} ({primero['lat']}, {primero['lon']})")

    # La consulta que llega a ES es la que esperamos
    mm = es.ultima_query["query"]["multi_match"]
    assert mm["fields"][0] == "DIRECCION_COMPLETA^3"
    assert mm["fuzziness"] == "AUTO"
    print("OK geocode arma multi_match con fuzziness y peso en la direccion")

    # Texto vacio: 400, sin tocar Elasticsearch
    for url in ["/api/geocode", "/api/geocode?q=", "/api/geocode?q=%20%20"]:
        r = c.get(url)
        assert r.status_code == 400, url
        assert "dirección" in cuerpo(r)["error"]
    print("OK geocode sin texto -> 400 con mensaje accionable")

    # size se acota
    c.get("/api/geocode?q=x&size=9999")
    assert es.ultima_query["size"] == 20
    c.get("/api/geocode?q=x&size=abc")
    assert es.ultima_query["size"] == config.GEOCODE_SIZE
    print("OK geocode acota size y tolera basura")

    # Elasticsearch caido -> 503, no 500
    r = cliente(ESFalso(roto=True)).get("/api/geocode?q=x")
    assert r.status_code == 503 and "Elasticsearch" in cuerpo(r)["error"]
    print("OK geocode con ES caido -> 503")


# =============================================================================
# 3. /api/reverse
# =============================================================================
def test_reverse():
    es = ESFalso()
    c = cliente(es)

    r = c.get("/api/reverse?lat=22.2381&lon=-102.0891")
    d = cuerpo(r)
    assert r.status_code == 200
    distancias = [x["distancia_km"] for x in d["resultados"]]
    assert distancias == sorted(distancias), "deben venir ordenados por cercania"
    assert d["resultados"][0]["distancia_km"] == 0.006
    assert d["fuera_de_mexico"] is False
    print(f"OK reverse -> {len(d['resultados'])} vecinos, el mas cercano a {distancias[0]} km")

    gd = es.ultima_query["sort"][0]["_geo_distance"]
    assert gd["unit"] == "km" and gd["order"] == "asc"
    assert gd[config.FIELD_LOCATION] == {"lat": 22.2381, "lon": -102.0891}
    print("OK reverse arma _geo_distance con la coordenada correcta")

    # Fuera del territorio nacional: se marca, pero se responde igual
    d = cuerpo(c.get("/api/reverse?lat=40.7128&lon=-74.0060"))
    assert d["fuera_de_mexico"] is True
    print("OK reverse avisa cuando el punto cae fuera de Mexico")

    # Parametros invalidos o ausentes
    casos = [("/api/reverse", "lat"), ("/api/reverse?lat=21.8", "lon"),
             ("/api/reverse?lat=abc&lon=-102", "número")]
    for url, fragmento in casos:
        r = c.get(url)
        assert r.status_code == 400, url
        assert fragmento in cuerpo(r)["error"], cuerpo(r)
    print("OK reverse valida lat y lon antes de consultar")


# =============================================================================
# 4. /api/predict
# =============================================================================
def test_predict():
    c = cliente(api_url=f"{BASE_STUB}/predict")

    r = c.post("/api/predict", json={"lat": 21.88, "lon": -102.296})
    d = cuerpo(r)
    assert r.status_code == 200
    assert d["clase"] == "OXXO"
    assert d["confianza"] == 87.34
    assert d["nivel"] == "alto", d
    assert d["lat"] == 21.88 and d["lon"] == -102.296
    print(f"OK predict -> {d['clase']} {d['confianza']}% · nivel {d['nivel']}")

    # El nivel lo calcula el backend: el frontend no repite los umbrales
    for ruta, esperado, conf in [("/medio", "medio", 76.0), ("/bajo", "bajo", 63.5)]:
        c = cliente(api_url=f"{BASE_STUB}{ruta}")
        d = cuerpo(c.post("/api/predict", json={"lat": 20.0, "lon": -100.0}))
        assert d["nivel"] == esperado and d["confianza"] == conf, d
        print(f"OK predict {conf}% -> nivel {esperado}")

    # Entradas invalidas
    c = cliente(api_url=f"{BASE_STUB}/predict")
    for payload in [{}, {"lat": 21.88}, {"lon": -102.29}]:
        r = c.post("/api/predict", json=payload)
        assert r.status_code == 400, payload
    r = c.post("/api/predict", json={"lat": "abc", "lon": -102.29})
    assert r.status_code == 400 and "numéricas" in cuerpo(r)["error"]
    print("OK predict valida el cuerpo antes de gastar a Spark")

    # Fallos del servicio de arriba -> 502, con el detalle util
    c = cliente(api_url=f"{BASE_STUB}/error500")
    r = c.post("/api/predict", json={"lat": 21.88, "lon": -102.296})
    assert r.status_code == 502 and "OutOfMemoryError" in cuerpo(r)["error"]
    print("OK predict con error 500 de Spark -> 502")

    c = cliente(api_url=f"{BASE_STUB}/nojson")
    r = c.post("/api/predict", json={"lat": 21.88, "lon": -102.296})
    assert r.status_code == 502 and "JSON" in cuerpo(r)["error"]
    print("OK predict con respuesta no-JSON -> 502")

    c = cliente(api_url="http://127.0.0.1:5998/predict")
    r = c.post("/api/predict", json={"lat": 21.88, "lon": -102.296})
    assert r.status_code == 502 and "05_api.py" in cuerpo(r)["error"]
    print("OK predict con la API caida -> 502 explicando como levantarla")


# =============================================================================
# 5. Caché
# =============================================================================
def test_cache():
    c = cliente(api_url=f"{BASE_STUB}/predict")
    fallos = []

    original = ml_api.predecir
    llamadas = []

    def contando(lat, lon, *args, **kw):
        llamadas.append((lat, lon))
        return original(lat, lon, *args, **kw)

    ml_api.predecir = contando
    api.predecir_cacheado.cache_clear()
    try:
        punto = {"lat": 21.88, "lon": -102.296}
        for _ in range(4):
            assert c.post("/api/predict", json=punto).status_code == 200
        if len(llamadas) != 1:
            fallos.append(f"4 peticiones al mismo punto dieron {len(llamadas)} llamadas")
        print(f"OK 4 peticiones al mismo punto -> {len(llamadas)} llamada real")

        # Diferencia sub-milimetrica: mismo punto para la cache
        c.post("/api/predict", json={"lat": 21.880000004, "lon": -102.296000004})
        if len(llamadas) != 1:
            fallos.append("una diferencia de 11 cm no debia provocar otra llamada")
        print("OK coordenada casi identica comparte entrada de cache")

        # Punto distinto: llamada nueva
        c.post("/api/predict", json={"lat": 19.4326, "lon": -99.1332})
        if len(llamadas) != 2:
            fallos.append("un punto nuevo debia provocar una llamada nueva")
        print("OK punto nuevo -> llamada nueva")

        # Un acierto de cache reporta su tiempo real, no el de la llamada original
        d = cuerpo(c.post("/api/predict", json=punto))
        if d["segundos"] > 0.05:
            fallos.append(f"un acierto de cache reporto {d['segundos']}s")
        print(f"OK acierto de cache responde en {d['segundos'] * 1000:.1f} ms")
    finally:
        ml_api.predecir = original

    assert not fallos, fallos


def test_cache_no_guarda_errores():
    """Un fallo no debe quedar memoizado: el usuario tiene que poder reintentar."""
    c = cliente(api_url="http://127.0.0.1:5998/predict")
    punto = {"lat": 30.0, "lon": -110.0}
    assert c.post("/api/predict", json=punto).status_code == 502

    c2 = cliente(api_url=f"{BASE_STUB}/predict")
    r = c2.post("/api/predict", json=punto)
    assert r.status_code == 200, "tras arreglar el servicio, el mismo punto debe funcionar"
    print("OK un error no queda cacheado: se puede reintentar")


if __name__ == "__main__":
    for prueba in [test_health, test_geocode, test_reverse, test_predict,
                   test_cache, test_cache_no_guarda_errores]:
        print(f"\n── {prueba.__name__}")
        prueba()
    print("\nTODAS LAS PRUEBAS DE LA API PASARON")
