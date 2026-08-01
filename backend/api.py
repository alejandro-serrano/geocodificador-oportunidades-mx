"""
Geocodificador de Oportunidades · API

Expone cuatro rutas que el frontend consume. Sigue el mismo patrón que
05_api.py del laboratorio: @app.route, un if de validación y jsonify de vuelta.

    GET  /api/health
    GET  /api/geocode?q=<texto>&size=<n>
    GET  /api/reverse?lat=<n>&lon=<n>&size=<n>
    POST /api/predict     {"lat": .., "lon": ..}

Este servidor NO habla con Spark ni con HDFS: solo consulta Elasticsearch y,
para la predicción, reenvía la coordenada a 05_api.py. Así, si la API de Spark
está caída, la búsqueda de direcciones sigue funcionando.

Arrancar con:
    ~/bdp/portable/python/bin/python3 api.py
"""
import os
import socket
import subprocess
import time
from functools import lru_cache

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

import config
import es_client
import ml_api
import scoring

ESTATICOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# static_url_path="" hace que /assets/... salga directamente de static/, que es
# donde `npm run build` deja el frontend compilado.
app = Flask(__name__, static_folder=ESTATICOS, static_url_path="")

# En desarrollo el frontend corre en otro puerto (5173), así que necesita CORS.
# En producción se compila dentro de backend/static/ y comparte origen, con lo
# que CORS deja de intervenir.
CORS(app)

# Una sola conexión a Elasticsearch para todo el proceso. El cliente es
# perezoso: no abre el socket hasta la primera consulta.
es = es_client.get_client()


# =============================================================================
# Ayudas
# =============================================================================
def error(mensaje, codigo):
    """Respuesta de error uniforme, con un mensaje que el usuario pueda accionar."""
    return jsonify({"error": mensaje}), codigo


def leer_float(nombre):
    """Lee un parámetro numérico de la query string.

    Devuelve (valor, None) si es válido, o (None, mensaje) si no lo es.
    """
    crudo = request.args.get(nombre)
    if crudo is None:
        return None, f"Falta el parámetro '{nombre}'."
    try:
        return float(crudo), None
    except ValueError:
        return None, f"El parámetro '{nombre}' debe ser un número, no '{crudo}'."


def leer_size(por_defecto, maximo=20):
    """Lee 'size' y lo acota, para que nadie pida diez mil resultados."""
    try:
        n = int(request.args.get("size", por_defecto))
    except ValueError:
        return por_defecto
    return max(1, min(n, maximo))


# =============================================================================
# Caché de predicciones
# =============================================================================
# Cada POST a 05_api.py hace que Spark recalcule las features del punto contra
# el DENUE y el Censo nacional: son decenas de segundos. La predicción de una
# coordenada fija es determinista, así que memoizarla convierte la segunda
# consulta al mismo lugar en una respuesta instantánea.
#
# lru_cache no guarda excepciones, de modo que un fallo de red se puede
# reintentar sin más.
#
# La URL se pasa explícitamente: ml_api la tiene como valor por defecto, y esos
# se evalúan al importar el módulo. Pasándola aquí, config sigue mandando en
# tiempo de ejecución.
@lru_cache(maxsize=256)
def predecir_cacheado(lat, lon):
    return ml_api.predecir(lat, lon, config.API_URL)


# =============================================================================
# Rutas
# =============================================================================
@app.route("/api/health")
def health():
    """Estado de los dos servicios de los que depende la aplicación.

    Se informan por separado a propósito: la API de Spark puede estar caída y
    la geocodificación seguir siendo perfectamente usable.
    """
    es_ok, es_msg = es_client.ping(es)
    api_ok, api_msg = ml_api.salud(config.API_URL)
    return jsonify({
        "elasticsearch": {"ok": es_ok, "mensaje": es_msg},
        "api_spark": {"ok": api_ok, "mensaje": api_msg},
    })


@app.route("/api/geocode")
def geocode():
    """Dirección en texto libre -> coordenadas."""
    texto = request.args.get("q", "").strip()
    if not texto:
        return error("Escribe una dirección para buscar.", 400)

    try:
        resultados = es_client.geocodificar(es, texto, size=leer_size(config.GEOCODE_SIZE))
    except Exception as e:  # noqa: BLE001 - cualquier fallo de ES se reporta igual
        return error(f"No se pudo consultar Elasticsearch: {e}", 503)

    return jsonify({"resultados": [d.as_dict() for d in resultados]})


@app.route("/api/reverse")
def reverse():
    """Coordenadas -> las N direcciones más próximas, ordenadas por distancia."""
    lat, fallo = leer_float("lat")
    if fallo:
        return error(fallo, 400)
    lon, fallo = leer_float("lon")
    if fallo:
        return error(fallo, 400)

    try:
        vecinos = es_client.geocodificar_inverso(
            es, lat, lon, size=leer_size(config.REVERSE_SIZE)
        )
    except Exception as e:  # noqa: BLE001
        return error(f"No se pudo consultar Elasticsearch: {e}", 503)

    return jsonify({
        "resultados": [d.as_dict() for d in vecinos],
        "fuera_de_mexico": not scoring.dentro_de_mexico(lat, lon),
    })


@app.route("/api/predict", methods=["POST"])
def predict():
    """Coordenadas -> potencial de negocio, según el modelo GBT."""
    datos = request.get_json(silent=True) or {}
    if "lat" not in datos or "lon" not in datos:
        return error("Se requieren 'lat' y 'lon' en el cuerpo JSON.", 400)

    try:
        lat, lon = scoring.clave_coord(datos["lat"], datos["lon"])
    except (TypeError, ValueError):
        return error("Las coordenadas no son numéricas.", 400)

    inicio = time.perf_counter()
    try:
        p = predecir_cacheado(lat, lon)
    except ml_api.APIError as e:
        # 502: nosotros estamos bien; quien falló fue el servicio de arriba.
        return error(str(e), 502)

    # Se mide aquí y no en ml_api para que un acierto de caché reporte su
    # tiempo real (milisegundos), no el de la llamada original.
    segundos = time.perf_counter() - inicio

    return jsonify({
        "clase": p.clase,
        "confianza": p.confianza,
        "nivel": scoring.nivel_de_confianza(p.confianza),
        "lat": lat,
        "lon": lon,
        "segundos": round(segundos, 3),
    })


# =============================================================================
# Frontend compilado
# =============================================================================
# Se registra DESPUÉS de las rutas /api para que quede claro que aquéllas
# mandan. Werkzeug resuelve por especificidad, así que /api/health nunca cae
# aquí, pero el orden de lectura también importa.
@app.route("/")
def inicio():
    indice = os.path.join(ESTATICOS, "index.html")
    if not os.path.exists(indice):
        return (
            "<h1>Falta compilar el frontend</h1>"
            "<p>Ejecuta <code>npm run build</code> dentro de <code>frontend/</code>.</p>"
            "<p>Las rutas <code>/api/…</code> ya funcionan.</p>",
            503,
        )
    return send_from_directory(ESTATICOS, "index.html")


# =============================================================================
# Arranque
# =============================================================================
def ip_de_salida():
    """La IP de la interfaz por la que sale el tráfico hacia internet.

    Se abre un socket UDP hacia una dirección externa: no envía ni un byte,
    solo obliga al sistema a elegir la interfaz de salida y así revelar su IP.
    Preguntar por el nombre del equipo devuelve 127.0.0.1 en muchos Mac.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def ips_locales():
    """TODAS las direcciones IPv4 de la máquina, sin loopback ni link-local.

    Con una sola interfaz bastaría ip_de_salida(). Pero un Mac con Ethernet y
    Wi-Fi a la vez, o con Compartir Internet activado, tiene varias — y solo
    una de ellas lleva al teléfono. Anunciar una sola manda al usuario a
    probar la equivocada, que es justo lo que pasó.
    """
    encontradas = []
    try:
        salida = subprocess.run(
            ["ifconfig"], capture_output=True, text=True, timeout=3
        ).stdout
        for linea in salida.splitlines():
            partes = linea.strip().split()
            if len(partes) >= 2 and partes[0] == "inet":
                ip = partes[1]
                # 127.x es la propia máquina; 169.254.x es una red sin DHCP.
                if not ip.startswith(("127.", "169.254.")):
                    encontradas.append(ip)
    except (OSError, subprocess.SubprocessError):
        pass  # sin ifconfig se cae con elegancia a la de salida

    principal = ip_de_salida()
    if principal and principal not in encontradas:
        encontradas.insert(0, principal)
    return encontradas


if __name__ == "__main__":
    print("=" * 62)
    print("  Geocodificador de Oportunidades · API")
    print("=" * 62)
    print(f"  Elasticsearch : {config.ES_HOST}  (índice {config.ES_INDEX})")
    print(f"  API de Spark  : {config.API_URL}")

    if not os.path.exists(os.path.join(ESTATICOS, "index.html")):
        print("\n  ⚠️  El frontend no está compilado.")
        print("      Ejecuta 'npm run build' dentro de frontend/.")

    print(f"\n  En esta computadora : http://localhost:{config.PORT}")

    ips = ips_locales()
    principal = ip_de_salida()
    if ips:
        print("\n  Desde el teléfono, prueba:")
        for ip in ips:
            marca = "   ← la más probable" if ip == principal else ""
            print(f"      http://{ip}:{config.PORT}{marca}")
        if len(ips) > 1:
            print("\n  Tienes varias redes. Usa la que empiece igual que la IP del")
            print("  teléfono: Ajustes → Wi-Fi → tu red → dirección IP.")
        print("\n  Si no carga, abre primero /api/health en el teléfono: si")
        print("  responde con texto JSON, la red va bien.")
    print("=" * 62)

    app.run(host=config.HOST, port=config.PORT, debug=False)
