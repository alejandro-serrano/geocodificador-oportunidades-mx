"""
Pruebas de scoring.py: los umbrales del modelo y el criterio de coordenada.

Es el modulo mas pequeño del backend y el que mas cuesta si se equivoca: los
umbrales deciden el color que ve el usuario, y clave_coord decide que cuenta
como "el mismo punto" para tres caches distintas.

    python3 test_scoring.py
"""
import sys

sys.path.insert(0, "..")

import scoring  # noqa: E402


def test_umbrales_en_sus_fronteras():
    """Las fronteras exactas, que es donde se cuelan los errores de < contra <=."""
    casos = [
        (100, "alto"), (92.5, "alto"), (85.0, "alto"),
        (84.99, "medio"), (76.0, "medio"), (70.0, "medio"),
        (69.99, "bajo"), (63.5, "bajo"), (50.0, "bajo"),
    ]
    for pct, esperado in casos:
        obtenido = scoring.nivel_de_confianza(pct)
        assert obtenido == esperado, f"{pct}% dio '{obtenido}', se esperaba '{esperado}'"
    print("OK umbrales:", " · ".join(f"{p}→{n}" for p, n in casos))

    # Los cortes son exactamente los documentados
    assert scoring.UMBRAL_ALTO == 85 and scoring.UMBRAL_MEDIO == 70
    assert scoring.nivel_de_confianza(scoring.UMBRAL_ALTO) == "alto"
    assert scoring.nivel_de_confianza(scoring.UMBRAL_MEDIO) == "medio"
    print("OK los cortes son inclusivos: 85 es alto y 70 es medio")


def test_solo_hay_tres_niveles():
    """El diseño usa tres colores: ningun porcentaje puede caer fuera."""
    validos = {"alto", "medio", "bajo"}
    for centesimas in range(5000, 10001):   # de 50.00% a 100.00%
        nivel = scoring.nivel_de_confianza(centesimas / 100)
        assert nivel in validos, f"{centesimas / 100}% dio '{nivel}'"
    print("OK los 5001 porcentajes posibles caen en uno de los tres niveles")


def test_es_monotona():
    """Mas confianza nunca puede significar menos potencial."""
    orden = {"bajo": 0, "medio": 1, "alto": 2}
    anterior = 0
    for centesimas in range(5000, 10001):
        actual = orden[scoring.nivel_de_confianza(centesimas / 100)]
        assert actual >= anterior, f"el nivel bajo en {centesimas / 100}%"
        anterior = actual
    print("OK el nivel nunca baja al subir la confianza")


def test_clave_coord():
    """6 decimales ≈ 11 cm: dos clics practicamente iguales son el mismo punto."""
    assert scoring.clave_coord(21.88, -102.296) == (21.88, -102.296)
    assert scoring.clave_coord(21.880000004, -102.296000004) == scoring.clave_coord(21.88, -102.296)
    assert scoring.clave_coord(21.881, -102.296) != scoring.clave_coord(21.88, -102.296)
    print("OK clave_coord: 11 cm es el mismo punto, 100 m no")

    # Acepta cadenas, que es lo que llega de un formulario o de una URL
    assert scoring.clave_coord("21.88", "-102.296") == (21.88, -102.296)
    print("OK clave_coord convierte cadenas numericas")

    for lat, lon in [("abc", -102.0), (None, -102.0)]:
        try:
            scoring.clave_coord(lat, lon)
            assert False, f"({lat}, {lon}) debio fallar"
        except (TypeError, ValueError):
            pass
    print("OK clave_coord rechaza lo que no es numerico")


def test_dentro_de_mexico():
    dentro = [
        (21.88, -102.296, "Aguascalientes"),
        (19.4326, -99.1332, "Ciudad de Mexico"),
        (32.5149, -117.0382, "Tijuana"),
        (20.6296, -87.0739, "Playa del Carmen"),
        (14.9, -92.2, "frontera sur"),
    ]
    for lat, lon, nombre in dentro:
        assert scoring.dentro_de_mexico(lat, lon), nombre

    fuera = [
        (40.7128, -74.0060, "Nueva York"),
        (0.0, 0.0, "golfo de Guinea"),
        (25.0, -80.0, "Florida"),
        (34.0, -102.0, "Texas"),
    ]
    for lat, lon, nombre in fuera:
        assert not scoring.dentro_de_mexico(lat, lon), nombre
    print(f"OK dentro_de_mexico acierta en {len(dentro)} puntos del pais y {len(fuera)} de fuera")


if __name__ == "__main__":
    for prueba in [test_umbrales_en_sus_fronteras, test_solo_hay_tres_niveles,
                   test_es_monotona, test_clave_coord, test_dentro_de_mexico]:
        print(f"\n── {prueba.__name__}")
        prueba()
    print("\nTODAS LAS PRUEBAS DE SCORING PASARON")
