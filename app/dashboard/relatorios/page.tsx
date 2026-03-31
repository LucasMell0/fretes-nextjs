'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Calendar, TrendingUp, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationWrapper } from '@/components/ui/pagination-wrapper'
import { DatePickerRange } from '@/components/ui/date-picker-range'
import { type DateRange } from 'react-day-picker'

interface CotacaoLog {
  id: number
  cep: string
  origem: string
  marketplace: string | null
  melhorValor: number | null
  melhorPrazo: number | null
  totalTransportadoras: number
  dataCotacao: string
  melhorTransportadora: {
    nome: string
  } | null
}

export default function RelatoriosPage() {
  const [cotacoes, setCotacoes] = useState<CotacaoLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroData, setFiltroData] = useState<DateRange | undefined>(undefined)
  const [filtroCep, setFiltroCep] = useState('')

  const aplicarMascaraCep = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '')
    if (apenasNumeros.length <= 5) {
      return apenasNumeros
    }
    return `${apenasNumeros.slice(0, 5)}-${apenasNumeros.slice(5, 8)}`
  }

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valorComMascara = aplicarMascaraCep(e.target.value)
    setFiltroCep(valorComMascara)
  }

  useEffect(() => {
    carregarCotacoes()
  }, [])

  const carregarCotacoes = async () => {
    try {
      const res = await fetch('/api/cotacoes')
      const data = await res.json()
      setCotacoes(data)
    } catch (error) {
      console.error('Erro ao carregar cotações')
    } finally {
      setLoading(false)
    }
  }

  // OTIMIZADO: Memoizar filtros para evitar recálculo a cada render
  const cotacoesFiltradas = useMemo(() => cotacoes.filter((c) => {
    if (filtroData?.from) {
      const cotacaoDate = new Date(c.dataCotacao)
      // Remove horas para comparação apenas de datas
      cotacaoDate.setHours(0, 0, 0, 0)
      const fromDate = new Date(filtroData.from)
      fromDate.setHours(0, 0, 0, 0)
      
      if (cotacaoDate < fromDate) return false
      
      if (filtroData.to) {
        const toDate = new Date(filtroData.to)
        toDate.setHours(23, 59, 59, 999)
        if (cotacaoDate > toDate) return false
      }
    }
    if (filtroCep) {
      const cepFiltroLimpo = filtroCep.replace(/\D/g, '')
      const cepCotacaoLimpo = c.cep.replace(/\D/g, '')
      if (!cepCotacaoLimpo.includes(cepFiltroLimpo)) return false
    }
    return true
  }), [cotacoes, filtroData, filtroCep])

  const pagination = usePagination(cotacoesFiltradas, 15)

  // OTIMIZADO: Memoizar cálculos estatísticos
  const stats = useMemo(() => {
    const total = cotacoesFiltradas.length
    const valorTotal = cotacoesFiltradas.reduce((acc, c) => acc + (Number(c.melhorValor) || 0), 0)
    const valorMedio = total > 0 ? valorTotal / total : 0
    
    // Calcular cotações de hoje uma única vez
    const hoje = new Date().toDateString()
    const cotacoesHoje = cotacoes.filter(c => 
      new Date(c.dataCotacao).toDateString() === hoje
    ).length
    
    return { total, valorMedio, cotacoesHoje }
  }, [cotacoesFiltradas, cotacoes])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold">Relatórios e Histórico</h2>
        <p className="text-muted-foreground">Visualize o histórico de cotações realizadas</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total de Cotações</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
            <Calendar className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Valor Médio</p>
              <p className="text-3xl font-bold">{formatCurrency(stats.valorMedio)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Hoje</p>
              <p className="text-3xl font-bold">{stats.cotacoesHoje}</p>
            </div>
            <Calendar className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      <Card className="mb-6 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="filtroData">Filtrar por Período</Label>
            <DatePickerRange
              date={filtroData}
              onDateChange={setFiltroData}
              placeholder="Selecione um período"
            />
          </div>
          <div>
            <Label htmlFor="filtroCep">Filtrar por CEP</Label>
            <Input
              id="filtroCep"
              placeholder="00000-000"
              value={filtroCep}
              onChange={handleCepChange}
              maxLength={9}
            />
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>CEP</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Melhor Transportadora</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Opções</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cotacoesFiltradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma cotação encontrada
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((cotacao) => (
                <TableRow key={cotacao.id}>
                  <TableCell>{formatDate(new Date(cotacao.dataCotacao))}</TableCell>
                  <TableCell className="font-mono">{cotacao.cep}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{cotacao.origem}</Badge>
                  </TableCell>
                  <TableCell>
                    {cotacao.melhorTransportadora?.nome || '-'}
                  </TableCell>
                  <TableCell className="font-semibold text-primary">
                    {cotacao.melhorValor ? formatCurrency(Number(cotacao.melhorValor)) : '-'}
                  </TableCell>
                  <TableCell>{cotacao.melhorPrazo ? `${cotacao.melhorPrazo} dias` : '-'}</TableCell>
                  <TableCell>
                    <Badge>{cotacao.totalTransportadoras} opções</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <PaginationWrapper
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        onPageChange={pagination.changePage}
        generatePageNumbers={pagination.generatePageNumbers}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        totalItems={cotacoesFiltradas.length}
        itemName="cotações"
      />
    </div>
  )
}
