import { ACENTO, ACENTO_HOVER, TEAL, TINTA, TINTA_SUAVE, TINTA_TENUE } from './colores.js'
import { FichaDireccion, TarjetaPrediccion, TablaHistorial, Leyenda } from './Tarjetas.jsx'

const PESTANAS = [
  { id: 'resultado', texto: 'Resultado' },
  { id: 'cercanas', texto: 'Cercanas' },
  { id: 'historial', texto: 'Historial' },
]

function Lupa({ tamano = 18, color = 'currentColor' }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
      <path d="m21 21-4.3-4.3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// Pestañas como grupo de pildoras sobre una pista gris: la seleccionada se
// levanta en blanco, en vez de subrayarse.
function Pestanas({ activa, alCambiar, conteos }) {
  return (
    <div className="flex gap-1 rounded-full bg-[#EEF2F7] p-1.5">
      {PESTANAS.map((p) => {
        const sel = activa === p.id
        return (
          <button
            key={p.id}
            onClick={() => alCambiar(p.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13.5px] font-medium transition-all"
            style={{
              backgroundColor: sel ? '#fff' : 'transparent',
              color: sel ? '#17233F' : TINTA_SUAVE,
              boxShadow: sel ? 'var(--sombra-sm)' : 'none',
            }}
          >
            {p.texto}
            {conteos[p.id] > 0 && (
              <span
                className="rounded-full px-1.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: sel ? ACENTO : '#B9C2D4' }}
              >
                {conteos[p.id]}
              </span>
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
    <div className="flex h-full flex-col gap-4 overflow-y-auto overscroll-contain p-5">
      {/* --- Buscador --- */}
      <section className="tarjeta p-5">
        <label className="rotulo mb-2.5 block">Buscar dirección</label>
        <div className="flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-[#E3E8F0] px-3.5 py-3 focus-within:border-[#4777B4] focus-within:ring-4 focus-within:ring-[#EAF1FB]">
          <span style={{ color: TINTA_TENUE }}>
            <Lupa />
          </span>
          <input
            value={texto}
            onChange={(e) => alCambiarTexto(e.target.value)}
            placeholder="Avenida Héroe de Nacozari Sur 2301"
            className="w-full border-none bg-transparent text-[15.5px] outline-none"
            style={{ color: TINTA }}
          />
        </div>
        <button
          type="button"
          onClick={alBuscar}
          disabled={cargando}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] py-3 text-[15.5px] font-semibold text-white transition-transform disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, ${ACENTO}, ${ACENTO_HOVER})`,
            boxShadow: '0 4px 14px rgba(71, 119, 180, .35)',
          }}
        >
          <Lupa tamano={17} color="#fff" />
          {cargando ? 'Buscando…' : 'Buscar dirección'}
        </button>
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: TINTA_TENUE }}>
          O toca cualquier punto del mapa para ver las direcciones más cercanas.
        </p>
      </section>

      {error && (
        <div className="rounded-[14px] bg-amber-50 px-4 py-3 text-[14px] text-amber-900">{error}</div>
      )}
      {aviso && (
        <div className="rounded-[14px] bg-sky-50 px-4 py-3 text-[14px] text-sky-900">{aviso}</div>
      )}

      <Pestanas activa={pestana} alCambiar={alCambiarPestana} conteos={conteos} />

      {/* --- Resultado de la busqueda por texto --- */}
      {pestana === 'resultado' && (
        <div className="flex flex-col gap-3">
          {resultados.length === 0 ? (
            <p className="text-[14px] leading-relaxed" style={{ color: TINTA_TENUE }}>
              Escribe una dirección para buscarla entre 33.6 millones de domicilios.
            </p>
          ) : (
            <>
              <FichaDireccion direccion={resultados[0]} />
              {resultados.length > 1 && (
                <details className="group">
                  <summary
                    className="cursor-pointer list-none text-[13.5px] font-semibold"
                    style={{ color: TEAL }}
                  >
                    <span className="inline-block transition-transform group-open:rotate-90">›</span>{' '}
                    Otras {resultados.length - 1} coincidencias
                  </summary>
                  <div className="mt-3 flex flex-col gap-2 border-t border-dashed border-[#E3E8F0] pt-3">
                    {resultados.slice(1).map((d, i) => (
                      <button
                        key={i}
                        onClick={() => alSeleccionar(d, true)}
                        className="rounded-[10px] bg-[#F6F8FB] px-3 py-2.5 text-left text-[13.5px] leading-snug hover:bg-[#EEF2F7]"
                        style={{ color: TINTA_SUAVE }}
                      >
                        {d.direccion_completa}
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
        <div className="flex flex-col gap-3">
          {vecinos.length === 0 ? (
            <p className="text-[14px] leading-relaxed" style={{ color: TINTA_TENUE }}>
              Toca un punto del mapa y aquí aparecerán las direcciones más cercanas,
              ordenadas por distancia.
            </p>
          ) : (
            vecinos.map((v, i) => {
              const activa = seleccion && seleccion.lat === v.lat && seleccion.lon === v.lon
              return (
                <div key={i} className="flex flex-col gap-1.5">
                  <FichaDireccion direccion={v} orden={i + 1} />
                  <button
                    onClick={() => alSeleccionar(v, false)}
                    disabled={activa}
                    className="self-start rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-100"
                    style={{
                      backgroundColor: activa ? '#EAF1FB' : '#F6F8FB',
                      color: activa ? ACENTO : TINTA_SUAVE,
                    }}
                  >
                    {activa ? '✓ Seleccionada' : 'Seleccionar'}
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

      {/* --- Potencial de negocio --- */}
      {seleccion && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="rotulo">Ubicación seleccionada</h2>
            <span className="coordenada text-[12.5px] font-medium" style={{ color: TINTA_SUAVE }}>
              {seleccion.lat.toFixed(4)}, {seleccion.lon.toFixed(4)}
            </span>
          </div>

          {prediccion ? (
            <TarjetaPrediccion prediccion={prediccion} />
          ) : (
            <div className="tarjeta p-5">
              <button
                onClick={alAnalizar}
                disabled={!apiDisponible || analizando}
                className="w-full rounded-[14px] py-3 text-[15.5px] font-semibold text-white disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${ACENTO}, ${ACENTO_HOVER})`,
                  boxShadow: '0 4px 14px rgba(71, 119, 180, .3)',
                }}
              >
                {analizando ? 'Analizando…' : 'Analizar potencial de negocio'}
              </button>
              <p className="mt-3 text-[13px] leading-relaxed" style={{ color: TINTA_TENUE }}>
                {!apiDisponible
                  ? 'Levanta la API de Spark para habilitar el análisis.'
                  : 'La primera consulta de un punto puede tardar decenas de segundos: Spark recalcula sus features contra el DENUE y el Censo nacional.'}
              </p>
            </div>
          )}

          {errorPrediccion && (
            <div className="rounded-[14px] bg-red-50 px-4 py-3 text-[14px] text-red-900">
              {errorPrediccion}
            </div>
          )}

          <Leyenda historial={historial} />
        </div>
      )}
    </div>
  )
}
