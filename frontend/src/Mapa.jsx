import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet'
import { NEUTRO, ACENTO, svgIcono, tonos } from './colores.js'
import { formatearDistancia, etiquetaDeClase } from './lib.js'

// Centro y zoom iniciales: la Republica Mexicana completa.
export const CENTRO_MEXICO = [23.6345, -102.5528]
export const ZOOM_MEXICO = 5
export const ZOOM_RESULTADO = 17

// Tiles de CARTO Voyager: datos de OpenStreetMap con un estilo limpio y
// calido. No necesitan token ni cuenta.
const TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const ATRIBUCION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

// --- Pines -------------------------------------------------------------------
// divIcon con SVG en linea: el marcador por defecto de Leaflet carga sus
// imagenes desde rutas que los empaquetadores rompen, y acaba invisible.
//
// El circulo lleva el tono 'pin' del nivel y el icono va en blanco; el anillo
// blanco lo despega del mapa.
function pinAnalizado(nivel, clase, activo) {
  const color = tonos(nivel).pin
  const d = activo ? 38 : 30
  const html =
    `<div style="width:${d}px;height:${d}px;border-radius:50%;background:${color};` +
    `border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);` +
    `display:flex;align-items:center;justify-content:center;` +
    `opacity:${activo ? 1 : 0.85}">${svgIcono(clase, '#fff', activo ? 19 : 15)}</div>`
  return L.divIcon({ html, className: '', iconSize: [d, d], iconAnchor: [d / 2, d / 2] })
}

// Direccion todavia sin analizar: gris, sin icono de clase, porque aun no
// sabemos de que tipo es.
function pinSimple(color, d = 26) {
  const html =
    `<div style="width:${d}px;height:${d}px;border-radius:50%;background:${color};` +
    `border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>`
  return L.divIcon({ html, className: '', iconSize: [d, d], iconAnchor: [d / 2, d / 2] })
}

function Centrar({ centro, zoom }) {
  const mapa = useMap()
  useEffect(() => {
    if (centro) mapa.setView(centro, zoom)
  }, [centro, zoom, mapa])
  return null
}

function Clics({ alHacerClic }) {
  useMapEvents({
    click(evento) {
      alHacerClic(evento.latlng.lat, evento.latlng.lng)
    },
  })
  return null
}

export default function Mapa({
  centro, zoom, seleccion, vecinos, puntoClic, prediccion, historial, alHacerClic,
}) {
  const iconoSeleccion = useMemo(() => pinSimple(ACENTO, 30), [])
  const iconoVecino = useMemo(() => pinSimple(NEUTRO, 22), [])

  // El analisis vigente se dibuja aparte; del historial se omite para no
  // pintarlo dos veces sobre la misma coordenada.
  const claveActual = prediccion ? `${prediccion.lat},${prediccion.lon}` : null
  const previos = historial.filter((h) => `${h.lat},${h.lon}` !== claveActual)

  return (
    <MapContainer
      center={CENTRO_MEXICO}
      zoom={ZOOM_MEXICO}
      className="h-full w-full"
      zoomControl={false}
      scrollWheelZoom
    >
      <TileLayer url={TILES} attribution={ATRIBUCION} />
      <Centrar centro={centro} zoom={zoom} />
      <Clics alHacerClic={alHacerClic} />

      {puntoClic && (
        <CircleMarker
          center={puntoClic}
          radius={6}
          pathOptions={{ color: '#fff', weight: 2, fillColor: NEUTRO, fillOpacity: 1 }}
        >
          <Popup>
            Punto consultado
            <br />
            {puntoClic[0].toFixed(6)}, {puntoClic[1].toFixed(6)}
          </Popup>
        </CircleMarker>
      )}

      {/* Lineas del punto consultado a cada vecino: hacen evidente la distancia */}
      {puntoClic &&
        vecinos.map((v, i) => (
          <Polyline
            key={`linea-${i}`}
            positions={[puntoClic, [v.lat, v.lon]]}
            pathOptions={{ color: '#9ca3af', weight: 1.5, dashArray: '4 6' }}
          />
        ))}

      {vecinos.map((v, i) => (
        <Marker key={`vecino-${i}`} position={[v.lat, v.lon]} icon={iconoVecino}>
          <Popup>
            <b>{i + 1}. {v.direccion_completa}</b>
            <br />
            {v.municipio}, {v.estado}
            <br />
            a {formatearDistancia(v.distancia_km)}
          </Popup>
        </Marker>
      ))}

      {/* Ubicacion activa sin analizar todavia */}
      {seleccion && !prediccion && (
        <Marker position={[seleccion.lat, seleccion.lon]} icon={iconoSeleccion}>
          <Popup>
            <b>{seleccion.direccion_completa}</b>
            <br />
            {seleccion.municipio}, {seleccion.estado}
            <br />
            C.P. {seleccion.cp}
          </Popup>
        </Marker>
      )}

      {/* El veredicto vive en el mapa, no solo en el panel */}
      {prediccion && (
        <Marker
          position={[prediccion.lat, prediccion.lon]}
          icon={pinAnalizado(prediccion.nivel, prediccion.clase, true)}
          zIndexOffset={1000}
        >
          <Popup>
            <b>{etiquetaDeClase(prediccion.clase)}</b>
            <br />
            {prediccion.confianza.toFixed(2)}% · {tonos(prediccion.nivel).etiqueta.toLowerCase()}
            {seleccion && (
              <>
                <br />
                <small>{seleccion.direccion_completa}</small>
              </>
            )}
          </Popup>
        </Marker>
      )}

      {previos.map((h) => (
        <Marker
          key={`hist-${h.lat},${h.lon}`}
          position={[h.lat, h.lon]}
          icon={pinAnalizado(h.nivel, h.clase, false)}
        >
          <Popup>
            <b>{etiquetaDeClase(h.clase)}</b>
            <br />
            {h.confianza.toFixed(2)}% · {tonos(h.nivel).etiqueta.toLowerCase()}
            <br />
            <small>{h.direccion}</small>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
