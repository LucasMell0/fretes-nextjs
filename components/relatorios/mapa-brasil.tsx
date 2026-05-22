'use client'

import { useMemo, useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { NOMES_ESTADOS } from '@/lib/utils/cep-to-estado'

interface PorEstado {
  uf: string
  total: number
}

interface MapaBrasilProps {
  data: PorEstado[]
}

const GEO_URL = '/maps/brazil-states.geojson'

interface FeatureProps {
  sigla: string
  name: string
}

type GeoFeature = {
  rsmKey: string
  properties: FeatureProps
}

export function MapaBrasil({ data }: MapaBrasilProps) {
  const [hover, setHover] = useState<{ uf: string; x: number; y: number } | null>(null)

  const porUf = useMemo(() => {
    const map = new Map<string, number>()
    data.forEach(d => map.set(d.uf, d.total))
    return map
  }, [data])

  const max = useMemo(() => Math.max(1, ...data.map(d => d.total)), [data])

  // Escala linear de cor: 0 (cinza) → max (primary cheio)
  const colorFor = (uf: string): string => {
    const total = porUf.get(uf) || 0
    if (total === 0) return 'hsl(var(--muted))'
    const ratio = total / max
    // hsl baseado na cor primary; opacidade simulada via lightness
    if (ratio > 0.75) return 'hsl(var(--primary))'
    if (ratio > 0.5)  return 'hsl(var(--primary) / 0.75)'
    if (ratio > 0.25) return 'hsl(var(--primary) / 0.5)'
    return 'hsl(var(--primary) / 0.25)'
  }

  const hoverUf = hover?.uf || null
  const hoverTotal = hoverUf ? porUf.get(hoverUf) || 0 : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cotações por Estado</CardTitle>
        <CardDescription>Volume de cotações no período selecionado por UF. Passe o mouse sobre um estado.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Mapa SVG real */}
          <div className="relative mx-auto" style={{ maxWidth: 340 }}>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: 480,
                center: [-54, -15],
              }}
              width={340}
              height={340}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo: GeoFeature) => {
                    const uf = geo.properties.sigla
                    const total = porUf.get(uf) || 0
                    const isHover = hoverUf === uf
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseEnter={(e) => setHover({ uf, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setHover({ uf, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          default: {
                            fill: colorFor(uf),
                            stroke: 'hsl(var(--background))',
                            strokeWidth: 0.5,
                            outline: 'none',
                            transition: 'fill 200ms',
                          },
                          hover: {
                            fill: 'hsl(var(--primary))',
                            stroke: 'hsl(var(--foreground))',
                            strokeWidth: 1,
                            outline: 'none',
                            cursor: 'pointer',
                          },
                          pressed: {
                            fill: 'hsl(var(--primary))',
                            outline: 'none',
                          },
                        }}
                        aria-label={`${geo.properties.name}: ${total} cotações`}
                      />
                    )
                  })
                }
              </Geographies>
            </ComposableMap>

            {/* Tooltip flutuante seguindo o cursor */}
            {hover && (
              <div
                className="pointer-events-none fixed z-50 rounded-md border bg-popover px-3 py-2 text-xs shadow-md text-popover-foreground"
                style={{
                  left: hover.x + 12,
                  top: hover.y + 12,
                }}
              >
                <div className="font-semibold">{NOMES_ESTADOS[hover.uf]} ({hover.uf})</div>
                <div className="text-muted-foreground">
                  <span className="font-mono text-base text-foreground">{hoverTotal}</span>{' '}cotação(ões)
                </div>
              </div>
            )}
          </div>

          {/* Painel lateral: detalhes + legenda */}
          <div className="flex flex-col gap-4 lg:w-[240px]">
            <div className="rounded-md border p-4 bg-card">
              {hoverUf ? (
                <>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <p className="text-base font-bold">{NOMES_ESTADOS[hoverUf]} ({hoverUf})</p>
                  <p className="text-xs text-muted-foreground mt-3">Cotações no período</p>
                  <p className="text-3xl font-bold text-primary">{hoverTotal}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {max > 0 ? `${Math.round((hoverTotal / max) * 100)}% do maior` : '—'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Passe o mouse sobre um estado para ver detalhes.</p>
              )}
            </div>

            <div className="rounded-md border p-3 bg-card">
              <p className="text-xs font-medium mb-2">Intensidade</p>
              <div className="flex items-center gap-1">
                <div className="h-3 w-8 rounded" style={{ background: 'hsl(var(--muted))' }} />
                <div className="h-3 w-8 rounded" style={{ background: 'hsl(var(--primary) / 0.25)' }} />
                <div className="h-3 w-8 rounded" style={{ background: 'hsl(var(--primary) / 0.5)' }} />
                <div className="h-3 w-8 rounded" style={{ background: 'hsl(var(--primary) / 0.75)' }} />
                <div className="h-3 w-8 rounded" style={{ background: 'hsl(var(--primary))' }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0</span>
                <span>{max}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
