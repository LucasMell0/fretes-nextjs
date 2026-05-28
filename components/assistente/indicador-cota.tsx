'use client'

import { useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { Sparkles, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UsoResposta {
  mensagens: number
  cotaMensal: number
  restantes: number
}

export interface IndicadorCotaRef {
  recarregar: () => void
}

export const IndicadorCota = forwardRef<IndicadorCotaRef>(function IndicadorCota(_props, ref) {
  const [uso, setUso] = useState<UsoResposta | null>(null)

  const carregar = async () => {
    try {
      const res = await fetch('/api/assistente/uso')
      if (!res.ok) return
      const data: UsoResposta = await res.json()
      setUso(data)
    } catch {}
  }

  useImperativeHandle(ref, () => ({ recarregar: carregar }), [])

  useEffect(() => {
    carregar()
  }, [])

  if (!uso) return null

  const pct = uso.cotaMensal > 0 ? (uso.mensagens / uso.cotaMensal) * 100 : 0
  const baixo = uso.restantes <= 10 && uso.restantes > 0
  const zerado = uso.restantes === 0

  return (
    <div className="border-t p-3 text-xs shrink-0 flex flex-col justify-center min-h-[5rem]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {zerado ? (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          <span>Uso este mês</span>
        </div>
        <span className={cn(
          'font-mono',
          zerado && 'text-destructive font-semibold',
          baixo && !zerado && 'text-amber-600',
        )}>
          {uso.mensagens} / {uso.cotaMensal}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full transition-all',
            zerado ? 'bg-destructive' : baixo ? 'bg-amber-500' : 'bg-primary'
          )}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {zerado && (
        <p className="mt-2 text-destructive text-[11px]">
          Cota mensal esgotada. Reinicia no próximo mês.
        </p>
      )}
    </div>
  )
})
