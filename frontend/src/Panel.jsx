import { ACENTO } from './colores.js'
import { FichaDireccion, TarjetaPrediccion, TablaHistorial, Leyenda } from './Tarjetas.jsx'

const PESTANAS = [
  { id: 'resultado', texto: 'Resultado' },
  { id: 'cercanas', texto: 'Cercanas' },
  { id: 'historial', texto: 'Historial' },
]

function Pestanas({ activa, alCambiar, conteos }) {
  return (
    <div className="flex gap-4 border-b border-slate-200">
      {PESTANAS.map((p) => {
        const seleccionada = activa === p.id
        return (
          <button
            key={p.id}
            onClick={() => alCambiar(p.id)}
            className="-mb-px border-b-2 pb-2 text-[12px] transition-colors"
            style={{
              borderColor: seleccionada ? ACENTO : 'transparent',
              color: seleccionada ? '#0f172a' : '#94a3b8',
            }}
          >
            {p.texto}
            {conteos[p.id] > 0 && (
              <span className="ml-1 text-[11px] text-slate-400">{conteos[p.id]}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function Panel({
  texto, alCambiarTexto, alBuscar, cargando, error, aviso,
  pestana, alCambiarPestana,
  resultados, vecinos, seleccion, prediccion, analizando, errorPrediccion,
  apiDisponible, historial,
  alSeleccionar, alAnalizar, alLimpiarHistorial, alIrAHistorial,
}) {
  const conteos = {
    resultado: resultados.length,
    cercanas: vecinos.length,
    historial: historial.length,
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto overscroll-contain">
      <div className="flex flex-col gap-3 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            alBuscar()
          }}
          className="flex flex-col gap-2"
        >
          <input
            value={texto}
            onChange={(e) => alCambiarTexto(e.target.value)}
            placeholder="Avenida Héroe de Nacozari Sur 2301"
            className="w-full rounded border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-slate-500"
          />
          <button
            type="submit"
            disabled={cargando}
            className="rounded py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: ACENTO }}
          >
            {cargando ? 'Buscando…' : 'Buscar dirección'}
          </button>
        </form>

        <p className="text-[11px] leading-snug text-slate-500">
          O toca cualquier punto del mapa para ver las direcciones más cercanas.
        </p>

        {error && (
          <div className="rounded bg-amber-50 px-2.5 py-2 text-[12px] text-amber-900">{error}</div>
        )}
        {aviso && (
          <div className="rounded bg-sky-50 px-2.5 py-2 text-[12px] text-sky-900">{aviso}</div>
        )}

        <Pestanas activa={pestana} alCambiar={alCambiarPestana} conteos={conteos} />

        {/* --- Resultado de la busqueda por texto --- */}
        {pestana === 'resultado' && (
          <div className="flex flex-col gap-2">
            {resultados.length === 0 ? (
              <p className="text-[12px] text-slate-500">
                Escribe una dirección para buscarla entre 33.6 millones de domicilios.
              </p>
            ) : (
              <>
                <FichaDireccion direccion={resultados[0]} />
                {resultados.length > 1 && (
                  <details>
                    <summary className="cursor-pointer text-[11px] text-slate-500">
                      Otras {resultados.length - 1} coincidencias
                    </summary>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {resultados.slice(1).map((d, i) => (
                        <button
                          key={i}
                          onClick={() => alSeleccionar(d, true)}
                          className="border border-slate-200 px-2.5 py-2 text-left text-[12px] hover:bg-slate-50"
                        >
                          <span className="block leading-snug text-slate-800">
                            {d.direccion_completa}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {d.municipio}, {d.estado} · relevancia {d.score.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        )}

        {/* --- Direcciones cercanas al clic --- */}
        {pestana === 'cercanas' && (
          <div className="flex flex-col gap-2">
            {vecinos.length === 0 ? (
              <p className="text-[12px] text-slate-500">
                Toca un punto del mapa y aquí aparecerán las direcciones más cercanas,
                ordenadas por distancia.
              </p>
            ) : (
              vecinos.map((v, i) => {
                const activa = seleccion && seleccion.lat === v.lat && seleccion.lon === v.lon
                return (
                  <div key={i}>
                    <FichaDireccion direccion={v} orden={i + 1} />
                    <button
                      onClick={() => alSeleccionar(v, false)}
                      disabled={activa}
                      className="w-full border border-t-0 border-slate-200 py-1.5 text-[11px] text-slate-600 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      {activa ? 'Seleccionada' : 'Seleccionar'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* --- Historial comparativo --- */}
        {pestana === 'historial' && (
          <TablaHistorial
            historial={historial}
            alLimpiar={alLimpiarHistorial}
            alSeleccionar={alIrAHistorial}
          />
        )}
      </div>

      {/* --- Potencial de negocio: fijo abajo, siempre visible --- */}
      {seleccion && (
        <div className="mt-auto border-t border-slate-200 bg-white p-3">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">
              Ubicación seleccionada
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {seleccion.lat.toFixed(4)}, {seleccion.lon.toFixed(4)}
            </span>
          </div>

          {prediccion ? (
            <TarjetaPrediccion prediccion={prediccion} />
          ) : (
            <>
              <button
                onClick={alAnalizar}
                disabled={!apiDisponible || analizando}
                className="w-full rounded py-2 text-[13px] font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: ACENTO }}
              >
                {analizando ? 'Analizando…' : 'Analizar potencial de negocio'}
              </button>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                {!apiDisponible
                  ? 'Levanta la API de Spark para habilitar el análisis.'
                  : 'La primera consulta de un punto puede tardar decenas de segundos: Spark recalcula sus features contra el DENUE y el Censo nacional.'}
              </p>
            </>
          )}

          {errorPrediccion && (
            <div className="mt-2 rounded bg-red-50 px-2.5 py-2 text-[12px] text-red-900">
              {errorPrediccion}
            </div>
          )}

          <div className="mt-3">
            <Leyenda historial={historial} />
          </div>
        </div>
      )}
    </div>
  )
}
