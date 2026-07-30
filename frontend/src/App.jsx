import { useEffect, useState } from 'react'
import * as api from './api.js'
import { registrar } from './lib.js'
import { MARINO, MARINO_CLARO } from './colores.js'
import Mapa, { CENTRO_MEXICO, ZOOM_MEXICO, ZOOM_RESULTADO } from './Mapa.jsx'
import Panel from './Panel.jsx'
import HojaMovil from './HojaMovil.jsx'

const VECINOS_POR_CLIC = 3

function Semaforo({ ok, etiqueta, detalle }) {
  return (
    <span className="flex items-center gap-1.5" title={detalle}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: ok ? '#5DCAA5' : '#F0997B' }}
      />
      <span style={{ color: ok ? MARINO_CLARO : '#F5C4B3' }}>{etiqueta}</span>
    </span>
  )
}

export default function App() {
  // --- Vista del mapa ---
  const [centro, setCentro] = useState(CENTRO_MEXICO)
  const [zoom, setZoom] = useState(ZOOM_MEXICO)

  // --- Busqueda ---
  const [texto, setTexto] = useState('')
  const [pestana, setPestana] = useState('resultado')
  const [resultados, setResultados] = useState([])
  const [vecinos, setVecinos] = useState([])
  const [puntoClic, setPuntoClic] = useState(null)
  const [seleccion, setSeleccion] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  // --- Prediccion ---
  const [prediccion, setPrediccion] = useState(null)
  const [analizando, setAnalizando] = useState(false)
  const [errorPrediccion, setErrorPrediccion] = useState(null)
  const [historial, setHistorial] = useState([])

  // --- Servicios ---
  const [servicios, setServicios] = useState(null)

  useEffect(() => {
    api.estadoServicios().then(setServicios).catch(() => setServicios(null))
  }, [])

  function limpiarPrediccion() {
    setPrediccion(null)
    setErrorPrediccion(null)
  }

  // Cada busqueda limpia lo anterior: los dos modos son excluyentes en pantalla.
  // El historial NO se toca: su valor esta justamente en comparar ubicaciones
  // halladas por vias distintas.
  function limpiar() {
    setResultados([])
    setVecinos([])
    setPuntoClic(null)
    setSeleccion(null)
    setError(null)
    setAviso(null)
    limpiarPrediccion()
  }

  // Fijar una ubicacion invalida la prediccion anterior: mostrar el veredicto
  // de un punto junto a la ficha de otro seria un error grave de lectura.
  function seleccionar(direccion, recentrar) {
    setSeleccion((anterior) => {
      if (!anterior || anterior.lat !== direccion.lat || anterior.lon !== direccion.lon) {
        limpiarPrediccion()
      }
      return direccion
    })
    if (recentrar) {
      setCentro([direccion.lat, direccion.lon])
      setZoom(ZOOM_RESULTADO)
    }
  }

  // --- Busqueda por texto -----------------------------------------------------
  async function buscar() {
    if (!texto.trim()) {
      limpiar()
      setError('Escribe una dirección para buscar.')
      return
    }
    limpiar()
    setPestana('resultado')
    setCargando(true)
    try {
      const encontrados = await api.geocodificar(texto)
      setResultados(encontrados)
      if (encontrados.length > 0) {
        seleccionar(encontrados[0], true)
      } else {
        setError('Sin coincidencias. Prueba con menos detalle (calle, número, municipio).')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  // --- Clic en el mapa --------------------------------------------------------
  async function alHacerClic(lat, lon) {
    limpiar()
    setPuntoClic([lat, lon])
    setPestana('cercanas')
    setCargando(true)
    try {
      const datos = await api.inverso(lat, lon, VECINOS_POR_CLIC)
      setVecinos(datos.resultados)
      if (datos.fuera_de_mexico) {
        setAviso(
          'El punto está fuera del territorio nacional; la dirección más cercana puede quedar muy lejos.',
        )
      }
      // La mas cercana queda seleccionada, pero NO se recentra: el usuario ya
      // esta mirando esa zona y un salto de camara resultaria desorientador.
      if (datos.resultados.length > 0) seleccionar(datos.resultados[0], false)
      else setError('No se encontraron direcciones cercanas.')
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  // --- Analisis de potencial --------------------------------------------------
  // Se dispara con un boton explicito y no al seleccionar: cada peticion ocupa
  // el cluster de Spark decenas de segundos.
  async function analizar() {
    if (!seleccion) return
    setAnalizando(true)
    setErrorPrediccion(null)
    try {
      const p = await api.predecir(seleccion.lat, seleccion.lon)
      setPrediccion(p)
      setHistorial((h) =>
        registrar(h, {
          lat: p.lat,
          lon: p.lon,
          clase: p.clase,
          confianza: p.confianza,
          nivel: p.nivel,
          direccion: seleccion.direccion_completa,
          municipio: seleccion.municipio,
        }),
      )
    } catch (e) {
      setErrorPrediccion(e.message)
    } finally {
      setAnalizando(false)
    }
  }

  // Volver a una ubicacion del historial: centra el mapa y recupera su veredicto
  // de la cache, sin gastar otra llamada a Spark.
  async function irAHistorial(entrada) {
    setCentro([entrada.lat, entrada.lon])
    setZoom(ZOOM_RESULTADO)
    setPuntoClic(null)
    setVecinos([])
    setSeleccion({
      direccion_completa: entrada.direccion,
      municipio: entrada.municipio,
      estado: '',
      cp: '',
      lat: entrada.lat,
      lon: entrada.lon,
      distancia_km: null,
      score: null,
    })
    try {
      setPrediccion(await api.predecir(entrada.lat, entrada.lon))
    } catch (e) {
      setErrorPrediccion(e.message)
    }
  }

  const esOk = servicios?.elasticsearch?.ok ?? false
  const apiOk = servicios?.api_spark?.ok ?? false

  const panel = (
    <Panel
      texto={texto}
      alCambiarTexto={setTexto}
      alBuscar={buscar}
      cargando={cargando}
      error={error}
      aviso={aviso}
      pestana={pestana}
      alCambiarPestana={setPestana}
      resultados={resultados}
      vecinos={vecinos}
      seleccion={seleccion}
      prediccion={prediccion}
      analizando={analizando}
      errorPrediccion={errorPrediccion}
      apiDisponible={apiOk}
      historial={historial}
      alSeleccionar={seleccionar}
      alAnalizar={analizar}
      alLimpiarHistorial={() => setHistorial([])}
      alIrAHistorial={irAHistorial}
    />
  )

  return (
    <div className="flex h-full flex-col">
      <header
        className="flex shrink-0 items-center gap-3 px-3 py-2 text-[13px]"
        style={{ backgroundColor: MARINO }}
      >
        <span className="font-medium text-white">Geocodificador</span>
        <span className="hidden text-[12px] sm:inline" style={{ color: MARINO_CLARO }}>
          Oportunidades de negocio · México
        </span>
        <span className="ml-auto flex items-center gap-3 text-[11px]">
          <Semaforo
            ok={esOk}
            etiqueta={esOk ? 'Índice listo' : 'Sin índice'}
            detalle={servicios?.elasticsearch?.mensaje ?? 'Comprobando…'}
          />
          <Semaforo
            ok={apiOk}
            etiqueta={apiOk ? 'Modelo activo' : 'Modelo apagado'}
            detalle={servicios?.api_spark?.mensaje ?? 'Comprobando…'}
          />
        </span>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Escritorio: panel fijo a la izquierda */}
        <aside className="hidden w-[360px] shrink-0 border-r border-slate-200 bg-white md:block">
          {panel}
        </aside>

        <main className="min-w-0 flex-1">
          <Mapa
            centro={centro}
            zoom={zoom}
            seleccion={seleccion}
            vecinos={vecinos}
            puntoClic={puntoClic}
            prediccion={prediccion}
            historial={historial}
            alHacerClic={alHacerClic}
          />
        </main>

        {/* Telefono: el mapa ocupa todo y el panel sube desde abajo */}
        <div className="md:hidden">
          <HojaMovil>{panel}</HojaMovil>
        </div>
      </div>
    </div>
  )
}
