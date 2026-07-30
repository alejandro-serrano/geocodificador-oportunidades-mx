#!/usr/bin/env bash
# Ejecuta la bateria de pruebas del backend SIN necesidad de Elasticsearch,
# HDFS ni Spark: Elasticsearch se simula y la API de inferencia se sustituye
# por stub_api.py, que reproduce sus modos de fallo.
#
#   cd backend/tests && bash run_all.sh

set -u
cd "$(dirname "$0")"

PY="${PY:-python3}"
fallos=0

echo "════ Backend · rutas de la API ════"
"$PY" stub_api.py 5599 &
STUB=$!
sleep 2

"$PY" test_api.py || fallos=$((fallos + 1))

kill $STUB 2>/dev/null
wait $STUB 2>/dev/null

echo
echo "════ Backend · servidor unificado ════"
"$PY" test_estaticos.py || fallos=$((fallos + 1))

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ Todas las pruebas pasaron."
else
  echo "❌ $fallos archivo(s) de prueba con fallos."
  exit 1
fi
