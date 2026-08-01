#!/usr/bin/env bash
# Toda la bateria de pruebas del proyecto, backend y frontend.
#
# NO hace falta Elasticsearch, HDFS ni Spark: Elasticsearch se simula y la API
# de inferencia se sustituye por un servidor que reproduce sus modos de fallo.
#
#   bash tests/run_all.sh
#
# Variables:
#   PY   interprete de Python (por defecto python3). Con entorno virtual:
#        PY=.venv/bin/python3 bash tests/run_all.sh

set -u
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
PY="${PY:-python3}"

# El script hace cd por varias carpetas, asi que una ruta relativa como
# .venv/bin/python3 dejaria de resolverse. Se convierte a absoluta antes.
if [ -x "$PY" ]; then
  PY="$(cd "$(dirname "$PY")" && pwd)/$(basename "$PY")"
elif [ -x "$RAIZ/$PY" ]; then
  PY="$(cd "$(dirname "$RAIZ/$PY")" && pwd)/$(basename "$PY")"
elif ! command -v "$PY" >/dev/null 2>&1; then
  echo "✖ No encontre el interprete '$PY'."
  echo "  ¿Creaste el entorno virtual?  python3 -m venv .venv"
  exit 1
fi
export PY

fallos=0
PIDS=()

limpiar() {
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null
    wait "$pid" 2>/dev/null
  done
}
trap limpiar EXIT

correr() {
  local etiqueta="$1"; shift
  echo
  echo "── $etiqueta"
  if "$@"; then
    return 0
  else
    echo "   ✖ fallo en $etiqueta"
    fallos=$((fallos + 1))
  fi
}

echo "═══════════════════════════════════════════════════════"
echo "  Geocodificador de Oportunidades · pruebas"
echo "═══════════════════════════════════════════════════════"
echo "  Python: $("$PY" --version 2>&1)"
command -v node >/dev/null 2>&1 && echo "  Node:   $(node --version)" || echo "  Node:   no instalado (se omite el frontend)"

# ---------------------------------------------------------------------------
echo
echo "═══ Backend ═══"
cd "$RAIZ/backend/tests"

correr "scoring · umbrales y coordenadas" "$PY" test_scoring.py

"$PY" stub_api.py 5599 >/dev/null 2>&1 &
PIDS+=($!)
sleep 2
correr "api · las cuatro rutas" "$PY" test_api.py
kill "${PIDS[-1]}" 2>/dev/null
wait "${PIDS[-1]}" 2>/dev/null
PIDS=("${PIDS[@]:0:${#PIDS[@]}-1}")

correr "servidor unificado · estaticos y API" "$PY" test_estaticos.py

# ---------------------------------------------------------------------------
if command -v node >/dev/null 2>&1; then
  echo
  echo "═══ Frontend ═══"
  cd "$RAIZ/frontend/tests"

  correr "coherencia · Python contra JavaScript" node test_coherencia.mjs

  "$PY" "$RAIZ/backend/tests/stub_api.py" 5599 >/dev/null 2>&1 &
  PIDS+=($!)
  "$PY" servidor_de_prueba.py 8099 >/dev/null 2>&1 &
  PIDS+=($!)
  sleep 4
  correr "frontend · logica, colores y api.js" node test_frontend.mjs http://127.0.0.1:8099
fi

# ---------------------------------------------------------------------------
echo
echo "═══════════════════════════════════════════════════════"
if [ "$fallos" -eq 0 ]; then
  echo "Todas las pruebas pasaron."
else
  echo "$fallos suite(s) con fallos."
  exit 1
fi
