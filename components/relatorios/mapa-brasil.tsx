'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { NOMES_ESTADOS } from '@/lib/utils/cep-to-estado'

interface PorEstado {
  uf: string
  total: number
}

interface MapaBrasilProps {
  data: PorEstado[]
}

/**
 * Layout de "grade geográfica" do Brasil: cada UF tem uma área no grid CSS
 * posicionada aproximadamente onde fica no mapa real. Mais leve que SVG/topojson.
 */
const GRID_AREAS = `
  ".  .  RR AP .  .  .  ."
  ".  AM PA MA CE RN .  ."
  "AC RO .  PI PB .  .  ."
  ".  MT TO BA PE .  .  ."
  ".  MS GO DF SE AL .  ."
  ".  .  .  MG ES .  .  ."
  ".  .  .  SP RJ .  .  ."
  ".  .  PR .  .  .  .  ."
  ".  .  SC .  .  .  .  ."
  ".  .  RS .  .  .  .  ."
`

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export function MapaBrasil({ data }: MapaBrasilProps) {
  const [hover, setHover] = useState<string | null>(null)

  const porUf = useMemo(() => {
    const map = new Map<string, number>()
    data.forEach(d => map.set(d.uf, d.total))
    return map
  }, [data])

  const max = useMemo(() => Math.max(1, ...data.map(d => d.total)), [data])

  const intensidade = (total: number): string => {
    if (total === 0) return 'bg-muted/40 text-muted-foreground border-border'
    const ratio = total / max
    if (ratio > 0.75) return 'bg-primary text-primary-foreground border-primary'
    if (ratio > 0.5)  return 'bg-primary/70 text-primary-foreground border-primary/80'
    if (ratio > 0.25) return 'bg-primary/40 text-foreground border-primary/40'
    return 'bg-primary/15 text-foreground border-primary/20'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cotações por Estado</CardTitle>
        <CardDescription>Volume de cotações no período selecionado por UF</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Mapa grid */}
          <div
            className="grid gap-1 w-full max-w-md mx-auto"
            style={{
              gridTemplateAreas: GRID_AREAS,
              gridTemplateColumns: 'repeat(8, 1fr)',
              gridAutoRows: 'minmax(38px, auto)',
            }}
          >
            {UFS.map(uf => {
              const total = porUf.get(uf) || 0
              const isHover = hover === uf
              return (
                <div
                  key={uf}
                  style={{ gridArea: uf }}
                  className={`flex flex-col items-center justify-center rounded border text-xs font-medium cursor-default transition-all ${intensidade(total)} ${isHover ? 'ring-2 ring-offset-1 ring-foreground scale-105 z-10' : ''}`}
                  onMouseEnter={() => setHover(uf)}
                  onMouseLeave={() => setHover(null)}
                  title={`${NOMES_ESTADOS[uf]}: ${total} cotação(ões)`}
                >
                  <span className="font-bold">{uf}</span>
                  <span className="text-[10px] opacity-80 leading-none">{total}</span>
                </div>
              )
            })}
          </div>

          {/* Tooltip estendido + legenda */}
          <div className="flex flex-col gap-4 min-w-[220px]">
            <div className="rounded-md border p-4 bg-card">
              {hover ? (
                <>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <p className="text-base font-bold">{NOMES_ESTADOS[hover]} ({hover})</p>
                  <p className="text-xs text-muted-foreground mt-3">Cotações no período</p>
                  <p className="text-3xl font-bold text-primary">{porUf.get(hover) || 0}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {max > 0 ? `${Math.round(((porUf.get(hover) || 0) / max) * 100)}% do maior`: '—'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Passe o mouse sobre um estado para ver detalhes.</p>
              )}
            </div>

            <div className="rounded-md border p-3 bg-card">
              <p className="text-xs font-medium mb-2">Intensidade</p>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <div className="h-3 w-6 rounded bg-muted/40 border" />
                <div className="h-3 w-6 rounded bg-primary/15 border border-primary/20" />
                <div className="h-3 w-6 rounded bg-primary/40 border border-primary/40" />
                <div className="h-3 w-6 rounded bg-primary/70 border border-primary/80" />
                <div className="h-3 w-6 rounded bg-primary border border-primary" />
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
