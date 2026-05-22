'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, CheckCircle2, XCircle, Percent, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChartCotacoesInteractive } from '@/components/dashboard/chart-cotacoes-interactive'
import { MapaBrasil } from '@/components/relatorios/mapa-brasil'

interface RelatorioStats {
  periodo: { dias: number; inicio: string; fim: string }
  cards: {
    totalRequisicoes: number
    sucesso: number
    erro: number
    taxaSucesso: number
    totalCotacoes: number
  }
  grafico: Array<{ data: string; cotacoes: number }>
  porEstado: Array<{ uf: string; total: number }>
  cotacoesSemEstado: number
}

export default function RelatoriosPage() {
  const [stats, setStats] = useState<RelatorioStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [dias, setDias] = useState<string>('7')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/relatorios/stats?dias=${dias}`)
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }, [dias])

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!stats?.cards) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Erro ao carregar relatório.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold">Relatórios</h2>
          <p className="text-muted-foreground">
            Análise de requisições e cotações nos últimos {stats.periodo.dias} dias
          </p>
        </div>
        <Select value={dias} onValueChange={setDias}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Requisições</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cards.totalRequisicoes.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sucesso (2xx)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{stats.cards.sucesso.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">respostas com sucesso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Erro (4xx/5xx)</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.cards.erro.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">respostas com erro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cards.taxaSucesso}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.cards.totalCotacoes.toLocaleString('pt-BR')} cotações realizadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de cotações por dia (reutilizado da dashboard) */}
      <ChartCotacoesInteractive data={stats.grafico} />

      {/* Mapa do Brasil */}
      <MapaBrasil data={stats.porEstado} />

      {/* Top 5 estados em lista */}
      {stats.porEstado.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 5 estados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.porEstado.slice(0, 5).map((e, idx) => {
                const max = stats.porEstado[0].total || 1
                const pct = (e.total / max) * 100
                return (
                  <div key={e.uf} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">#{idx + 1}</span>
                    <span className="font-semibold w-12 text-sm">{e.uf}</span>
                    <div className="flex-1 bg-muted h-2 rounded overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono text-sm w-12 text-right">{e.total}</span>
                  </div>
                )
              })}
            </div>
            {stats.cotacoesSemEstado > 0 && (
              <p className="text-xs text-muted-foreground mt-4">
                {stats.cotacoesSemEstado} cotação(ões) sem CEP reconhecido (não computadas no mapa).
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
