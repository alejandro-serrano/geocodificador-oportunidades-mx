"""
Pruebas del servidor unificado: Flask sirve el frontend compilado Y la API
desde el mismo puerto.

Es el punto donde algo puede romperse en silencio: si la ruta de estáticos se
come las rutas /api, la aplicación devuelve HTML donde el frontend espera JSON
y el error es dificil de leer.

    python3 test_estaticos.py
"""
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, "..")

import api  # noqa: E402
from test_api import ESFalso  # noqa: E402


def cliente():
    api.es = ESFalso()
    api.app.config["TESTING"] = True
    return api.app.test_client()


def test_rutas_api_ganan_a_los_estaticos():
    """Lo mas importante: /api/... nunca debe caer en el servidor de archivos."""
    c = cliente()

    r = c.get("/api/health")
    assert r.status_code == 200, r.status_code
    assert r.content_type.startswith("application/json"), r.content_type
    json.loads(r.data)
    print("OK /api/health devuelve JSON, no el index.html")

    r = c.get("/api/geocode?q=Nacozari")
    assert r.status_code == 200 and "resultados" in json.loads(r.data)
    print("OK /api/geocode devuelve JSON")

    r = c.get("/api/reverse?lat=21.88&lon=-102.29")
    assert r.status_code == 200 and "resultados" in json.loads(r.data)
    print("OK /api/reverse devuelve JSON")

    # Un error de la API tambien debe ser JSON, no una pagina HTML
    r = c.get("/api/geocode?q=")
    assert r.status_code == 400
    assert "error" in json.loads(r.data)
    print("OK los errores de la API siguen siendo JSON")


def test_sirve_el_frontend_compilado():
    """Con el build presente, la raiz devuelve el HTML y los assets se sirven."""
    hay_build = os.path.exists(os.path.join(api.ESTATICOS, "index.html"))
    if not hay_build:
        print("-- sin build: se omite (ejecuta 'npm run build' en frontend/)")
        return

    c = cliente()
    r = c.get("/")
    assert r.status_code == 200
    html = r.data.decode()
    assert "<div id=\"root\">" in html, "deberia ser el index.html de Vite"
    print("OK la raiz devuelve el index.html compilado")

    # Los assets que referencia el HTML tienen que resolverse de verdad
    import re
    recursos = re.findall(r'(?:src|href)="(/assets/[^"]+)"', html)
    assert recursos, "el index.html deberia referenciar al menos un asset"
    for ruta in recursos:
        r = c.get(ruta)
        assert r.status_code == 200, f"{ruta} -> {r.status_code}"
    print(f"OK los {len(recursos)} assets referenciados se sirven correctamente")


def test_mensaje_util_sin_build():
    """Sin compilar, la raiz explica que hacer en vez de dar un 404 seco."""
    original = api.ESTATICOS
    vacio = tempfile.mkdtemp()
    try:
        api.ESTATICOS = vacio
        r = cliente().get("/")
        assert r.status_code == 503, r.status_code
        assert "npm run build" in r.data.decode()
        print("OK sin build, la raiz explica como compilarlo (503)")

        # Y la API sigue funcionando aunque no haya frontend
        r = cliente().get("/api/health")
        assert r.status_code == 200
        print("OK sin frontend, la API sigue respondiendo")
    finally:
        api.ESTATICOS = original
        shutil.rmtree(vacio, ignore_errors=True)


def test_ip_local():
    """La IP que se anuncia para el telefono tiene que ser de red, no loopback."""
    ip = api.ip_local()
    if ip is None:
        print("-- sin red: se omite la comprobacion de IP")
        return
    assert ip.count(".") == 3, ip
    assert not ip.startswith("127."), f"se anuncio {ip}: el telefono no puede usar loopback"
    print(f"OK ip_local devuelve una direccion de red utilizable: {ip}")


def test_escucha_en_toda_la_red():
    """Sin 0.0.0.0 el telefono no puede conectarse, por mucha IP que se anuncie."""
    import config
    assert config.HOST == "0.0.0.0", f"HOST es {config.HOST}"
    print("OK el servidor escucha en 0.0.0.0")


if __name__ == "__main__":
    for prueba in [test_rutas_api_ganan_a_los_estaticos, test_sirve_el_frontend_compilado,
                   test_mensaje_util_sin_build, test_ip_local, test_escucha_en_toda_la_red]:
        print(f"\n── {prueba.__name__}")
        prueba()
    print("\nTODAS LAS PRUEBAS DEL SERVIDOR UNIFICADO PASARON")
