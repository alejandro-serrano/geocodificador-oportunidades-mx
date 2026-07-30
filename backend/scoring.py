"""
Interpretación de la salida del modelo.

Vive en el backend a propósito: los umbrales tienen que estar en un solo sitio.
La API devuelve el NIVEL ya calculado y el frontend solo elige el color, así
nunca pueden discrepar.
"""

# Cortes de confianza, en porcentaje.
UMBRAL_ALTO = 85
UMBRAL_MEDIO = 70

# Precisión con la que dos coordenadas cuentan como "el mismo punto".
# 6 decimales ≈ 11 cm.
DECIMALES = 6


def nivel_de_confianza(pct):
    """Traduce la probabilidad del modelo a "alto", "medio" o "bajo".

    Un "87.34%" no le dice nada a quien toma la decisión de negocio; "potencial
    alto" sí. Los cortes son conservadores porque el GBT es un clasificador
    binario: su confianza nunca baja de 50%, así que el tramo "bajo" (50-70%)
    es justo donde el modelo apenas discrimina.
    """
    if pct >= UMBRAL_ALTO:
        return "alto"
    if pct >= UMBRAL_MEDIO:
        return "medio"
    return "bajo"


def clave_coord(lat, lon):
    """Clave canónica de una coordenada.

    La usan la caché de predicciones y el historial del frontend, para que
    ambos consideren "el mismo punto" exactamente en los mismos casos.
    """
    return (round(float(lat), DECIMALES), round(float(lon), DECIMALES))


def dentro_de_mexico(lat, lon):
    """Caja envolvente aproximada del territorio nacional.

    Sirve para avisar cuando se consulta un punto en el mar o fuera del país,
    donde el vecino más cercano estará a cientos de kilómetros y el resultado
    carece de sentido práctico.
    """
    return 14.0 <= lat <= 33.0 and -118.5 <= lon <= -86.0
