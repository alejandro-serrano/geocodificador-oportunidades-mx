# Geocodificador de Oportunidades · México

Busca cualquiera de los 33.6 millones de domicilios de México en un mapa, y
estima con un modelo de aprendizaje automático si una ubicación tiene más
potencial para una tienda de conveniencia o para una tienda de abarrotes.

Funciona por completo en tu computadora: no envía nada a internet.

> **Estado:** en construcción. Fase 0 de 5 completada — estructura y módulos de
> datos. Ver [`docs/PLAN.md`](docs/PLAN.md) para el detalle de cada fase.

---

## Cómo está organizado

```
backend/     Python + Flask · consulta Elasticsearch y llama al modelo
frontend/    React + Leaflet · el mapa y la interfaz
docs/        plan de implementación y diagrama de arquitectura
```

El backend expone cuatro rutas y el frontend las consume. En producción el
frontend se compila a `backend/static/` y Flask lo sirve, así todo corre en un
solo puerto.

## Qué necesita para funcionar

Esta aplicación no reemplaza al laboratorio de Big Data del curso: lo usa.

| Servicio | Puerto | Para qué |
|---|---|---|
| Elasticsearch | 9200 | Buscar direcciones en el índice `geocoder_mexico` |
| API de Spark (`05_api.py`) | 5001 | Predecir el potencial de negocio |
| HDFS | 9000 | De donde la API lee el modelo y los datos |

El índice se puebla una sola vez con los cuadernos `01_ProcesarDirecciones` y
`02_IndexacionGeoespacial` del laboratorio.

**Los datos no están en este repositorio.** El parquet de domicilios pesa
886 MB y los del DENUE y el Censo suman más de 2 GB; se regeneran con esos
cuadernos.

## Relación con la versión 1

Existe una primera versión construida con Streamlit, que se entrega como
proyecto final del curso y **permanece intacta** en el laboratorio. Esta versión
2 es un desarrollo aparte: separa el backend del frontend y rediseña la
interfaz. Ambas comparten los mismos servicios y pueden convivir.

## Créditos

Proyecto de la materia *Aprendizaje Automático para Grandes Volúmenes de Datos*,
Universidad Panamericana · Campus Aguascalientes.

El laboratorio de Big Data, los cuadernos del curso y la API de inferencia
(`05_api.py`) son material del **Dr. Abel Coronado** y no forman parte de este
repositorio.

Los datos del DENUE y del Censo de Población y Vivienda 2020 son del **INEGI**,
publicados bajo sus términos de libre uso.

## Licencia

MIT. Cubre únicamente el código de este repositorio.
