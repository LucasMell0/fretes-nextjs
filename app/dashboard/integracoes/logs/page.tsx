'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Loader2, Activity, CheckCircle2, XCircle, Eye, Search, Clock, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Produto {
  sku: string
  nome: string
  quantidade: number
  pesoTotal: number
}

interface Resultado {
  transportadora: string
  valor: number
  prazo: number
  pesoReal: number
  pesoCubado: number
  pesoTaxado: number
}

interface LogRequisicao {
  id: number
  cep: string
  origem: string
  marketplace: string | null
  melhorValor: number | null
  melhorPrazo: number | null
  melhorTransportadora: string | null
  totalTransportadoras: number
  dataCotacao: string
  ipOrigem: string | null
  userAgent: string | null
  tempoMs: number | null
  produtos: Produto[]
  resultados: Resultado[]
  erros: string[]
  requestRaw: string
  responseRaw: string
}

interface LogsResponse {
  logs: LogRequisicao[]
  total: number
  pagina: number
  totalPaginas: number
}

export default function LogsRequisicaoPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LogsResponse | null>(null)
  const [filtroOrigem, setFiltroOrigem] = useState('todos')
  const [filtroCep, setFiltroCep] = useState('')
  const [pagina, setPagina] = useState(1)
  const [logSelecionado, setLogSelecionado] = useState<LogRequisicao | null>(null)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', pagina.toString())
      params.set('limit', '30')
      if (filtroOrigem !== 'todos') params.set('origem', filtroOrigem)
      if (filtroCep) params.set('cep', filtroCep.replace(/\D/g, ''))

      const res = await fetch(`/api/integracoes/logs?${params}`)
      const json = await res.json()
      setData(json)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar requisições',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtroOrigem])

  const buscarPorCep = () => {
    setPagina(1)
    carregarDados()
  }

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatarCep = (cep: string) => {
    if (cep.length === 8) {
      return `${cep.slice(0, 5)}-${cep.slice(5)}`
    }
    return cep
  }

  const formatarValor = (valor: number | null) => {
    if (valor == null) return '-'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const totalSucesso = data?.logs.filter(l => l.totalTransportadoras > 0).length || 0
  const totalFalha = data?.logs.filter(l => l.totalTransportadoras === 0).length || 0
  const logsComTempo = data?.logs.filter(l => l.tempoMs != null) || []
  const tempoMedio = logsComTempo.length > 0
    ? Math.round(logsComTempo.reduce((acc, l) => acc + (l.tempoMs || 0), 0) / logsComTempo.length)
    : null
  const logsLentos = logsComTempo.filter(l => (l.tempoMs || 0) > 250).length

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Requisições de Cotação</h2>
          <p className="text-muted-foreground">Todas as cotações recebidas (manuais e canais de venda)</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard/integracoes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-6 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Requisições</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Resultado</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{totalSucesso}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem Resultado</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{totalFalha}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Zap className={`h-4 w-4 ${tempoMedio && tempoMedio <= 250 ? 'text-emerald-500' : 'text-yellow-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${
              tempoMedio == null ? 'text-muted-foreground' :
              tempoMedio <= 250 ? 'text-emerald-500' :
              tempoMedio <= 500 ? 'text-yellow-500' : 'text-red-500'
            }`}>
              {tempoMedio != null ? `${tempoMedio}ms` : '-'}
            </div>
            {logsLentos > 0 && (
              <p className="text-xs text-red-400 mt-1">{logsLentos} acima de 250ms</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-48">
              <Select value={filtroOrigem} onValueChange={(v) => { setFiltroOrigem(v); setPagina(1) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as origens</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="API">API / Canal de Venda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por CEP"
                value={filtroCep}
                onChange={(e) => setFiltroCep(e.target.value)}
                className="w-48"
                onKeyDown={(e) => e.key === 'Enter' && buscarPorCep()}
              />
              <Button variant="outline" size="icon" onClick={buscarPorCep}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>CEP</TableHead>
                <TableHead>SKUs</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Melhor Frete</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead className="text-right">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma requisição encontrada
                  </TableCell>
                </TableRow>
              ) : (
                data?.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatarData(log.dataCotacao)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.origem === 'MANUAL' ? 'outline' : 'secondary'} className="text-xs">
                        {log.origem === 'MANUAL' ? 'Manual' : log.marketplace || log.origem}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatarCep(log.cep)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {log.produtos.slice(0, 2).map((p, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {p.sku} x{p.quantidade}
                          </Badge>
                        ))}
                        {log.produtos.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{log.produtos.length - 2}
                          </Badge>
                        )}
                        {log.produtos.length === 0 && (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.totalTransportadoras > 0 ? (
                        <Badge className="text-xs bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
                          {log.totalTransportadoras} transportadora{log.totalTransportadoras > 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          Sem resultado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-sm">
                      {formatarValor(log.melhorValor ? Number(log.melhorValor) : null)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.melhorPrazo ? `${log.melhorPrazo} dias` : '-'}
                    </TableCell>
                    <TableCell>
                      {log.tempoMs != null ? (
                        <Badge
                          variant="outline"
                          className={`text-xs font-mono ${
                            log.tempoMs <= 250
                              ? 'border-emerald-500 text-emerald-500'
                              : log.tempoMs <= 500
                                ? 'border-yellow-500 text-yellow-500'
                                : 'border-red-500 text-red-500'
                          }`}
                        >
                          {log.tempoMs}ms
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLogSelecionado(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Paginação */}
      {data && data.totalPaginas > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={pagina === 1}
            onClick={() => setPagina(p => p - 1)}
          >
            Anterior
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            Página {pagina} de {data.totalPaginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina === data.totalPaginas}
            onClick={() => setPagina(p => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Dialog de detalhes */}
      <Dialog open={!!logSelecionado} onOpenChange={(open) => !open && setLogSelecionado(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Requisição</DialogTitle>
          </DialogHeader>
          {logSelecionado && (
            <div className="space-y-4">
              {/* Info geral */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Data/Hora</p>
                  <p className="text-sm font-medium">{formatarData(logSelecionado.dataCotacao)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CEP</p>
                  <p className="text-sm font-mono font-medium">{formatarCep(logSelecionado.cep)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Origem</p>
                  <Badge variant={logSelecionado.origem === 'MANUAL' ? 'outline' : 'secondary'}>
                    {logSelecionado.origem}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Marketplace</p>
                  <p className="text-sm font-medium">{logSelecionado.marketplace || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tempo de Resposta</p>
                  {logSelecionado.tempoMs != null ? (
                    <Badge
                      variant="outline"
                      className={`font-mono ${
                        logSelecionado.tempoMs <= 250
                          ? 'border-emerald-500 text-emerald-500'
                          : logSelecionado.tempoMs <= 500
                            ? 'border-yellow-500 text-yellow-500'
                            : 'border-red-500 text-red-500'
                      }`}
                    >
                      {logSelecionado.tempoMs}ms
                    </Badge>
                  ) : (
                    <p className="text-sm text-muted-foreground">-</p>
                  )}
                </div>
                {logSelecionado.ipOrigem && (
                  <div>
                    <p className="text-xs text-muted-foreground">IP Origem</p>
                    <p className="text-sm font-mono">{logSelecionado.ipOrigem}</p>
                  </div>
                )}
              </div>

              {/* Produtos */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Produtos</h4>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Peso Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logSelecionado.produtos.length > 0 ? (
                          logSelecionado.produtos.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                              <TableCell className="text-sm">{p.nome}</TableCell>
                              <TableCell>{p.quantidade}</TableCell>
                              <TableCell>{p.pesoTotal.toFixed(2)} kg</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                              Sem dados de produtos
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              {/* Resultados por transportadora */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Resultados ({logSelecionado.resultados.length} transportadoras)</h4>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Transportadora</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Prazo</TableHead>
                          <TableHead>Peso Real</TableHead>
                          <TableHead>Peso Cubado</TableHead>
                          <TableHead>Peso Taxado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logSelecionado.resultados.length > 0 ? (
                          logSelecionado.resultados.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium text-sm">{r.transportadora}</TableCell>
                              <TableCell className="font-semibold text-sm">{formatarValor(r.valor as number)}</TableCell>
                              <TableCell>{r.prazo} dias</TableCell>
                              <TableCell className="font-mono text-sm">{Number(r.pesoReal).toFixed(2)} kg</TableCell>
                              <TableCell className="font-mono text-sm">{Number(r.pesoCubado).toFixed(2)} kg</TableCell>
                              <TableCell className="font-mono text-sm">{Number(r.pesoTaxado).toFixed(2)} kg</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground text-sm">
                              Nenhuma transportadora retornou resultado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              {/* Erros */}
              {logSelecionado.erros && logSelecionado.erros.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-red-500">Erros ({logSelecionado.erros.length})</h4>
                  <Card className="border-red-500/20">
                    <CardContent className="p-4 space-y-2">
                      {logSelecionado.erros.map((erro, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <p className="text-sm text-red-400">{erro}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* JSON Bruto - Request */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Request (o que chegou)</h4>
                <Card>
                  <CardContent className="p-4">
                    <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(logSelecionado.requestRaw), null, 2)
                        } catch {
                          return logSelecionado.requestRaw || 'Sem dados'
                        }
                      })()}
                    </pre>
                  </CardContent>
                </Card>
              </div>

              {/* JSON Bruto - Response */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Response (o que respondemos)</h4>
                <Card>
                  <CardContent className="p-4">
                    <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(logSelecionado.responseRaw), null, 2)
                        } catch {
                          return logSelecionado.responseRaw || 'Sem dados'
                        }
                      })()}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
