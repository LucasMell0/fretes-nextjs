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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Activity, CheckCircle2, XCircle, Eye, Search, Zap, Loader2,
  ShieldAlert, PackageX, MapPinOff,
} from 'lucide-react'

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
  respostaCanal: {
    anymarketResponse?: { items: Array<Record<string, unknown>> }
    casaImperialResponse?: { items: Array<Record<string, unknown>> }
    statusEnviado?: number
    tempoMs?: number
  } | null
  requestRaw: string
  responseRaw: string
}

interface AuditoriaPendente {
  id: number
  tipo: 'SKU_NAO_ENCONTRADO' | 'CEP_NAO_ATENDIDO'
  descricao: string
  cep: string | null
  skus: string[]
  origem: string
  marketplace: string | null
  criadoEm: string
  integracao: { id: number; canal: { nome: string; slug: string } } | null
}

interface Resposta {
  cards: {
    total: number
    comResultado: number
    semResultado: number
    pendentesAuditoria: number
    resolvidosAuditoria: number
    tempoMedio: number | null
  }
  logs: LogRequisicao[]
  paginacao: { totalFiltrado: number; pagina: number; limit: number; totalPaginas: number }
  auditoriaPendentes: AuditoriaPendente[]
}

export default function AuditoriaPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Resposta | null>(null)
  const [filtroOrigem, setFiltroOrigem] = useState('todos')
  const [filtroCep, setFiltroCep] = useState('')
  const [filtroResultado, setFiltroResultado] = useState('todos')
  const [pagina, setPagina] = useState(1)
  const [logSelecionado, setLogSelecionado] = useState<LogRequisicao | null>(null)
  const [auditoriaSelecionada, setAuditoriaSelecionada] = useState<Set<number>>(new Set())
  const [resolvendoLote, setResolvendoLote] = useState(false)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', pagina.toString())
      params.set('limit', '30')
      if (filtroOrigem !== 'todos') params.set('origem', filtroOrigem)
      if (filtroResultado !== 'todos') params.set('resultado', filtroResultado)
      if (filtroCep) params.set('cep', filtroCep.replace(/\D/g, ''))

      const res = await fetch(`/api/auditoria?${params}`)
      const json = await res.json()
      setData(json)
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao carregar dados' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtroOrigem, filtroResultado])

  const buscarPorCep = () => {
    setPagina(1)
    carregarDados()
  }

  const toggleAuditoria = (id: number) => {
    setAuditoriaSelecionada(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleTodasAuditorias = () => {
    const pendentes = data?.auditoriaPendentes || []
    const todasMarcadas = pendentes.length > 0 && pendentes.every(p => auditoriaSelecionada.has(p.id))
    setAuditoriaSelecionada(prev => {
      const next = new Set(prev)
      if (todasMarcadas) pendentes.forEach(p => next.delete(p.id))
      else pendentes.forEach(p => next.add(p.id))
      return next
    })
  }

  const resolverSelecionadas = async () => {
    const ids = Array.from(auditoriaSelecionada)
    if (ids.length === 0) return
    setResolvendoLote(true)
    try {
      const res = await fetch('/api/auditoria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status: 'RESOLVIDO' }),
      })
      if (res.ok) {
        const json = await res.json()
        toast({ title: `${json.atualizados} registro(s) resolvido(s)` })
        setAuditoriaSelecionada(new Set())
        carregarDados()
      } else {
        toast({ variant: 'destructive', title: 'Erro ao resolver em lote' })
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao resolver em lote' })
    } finally {
      setResolvendoLote(false)
    }
  }

  const resolverUma = async (id: number) => {
    try {
      const res = await fetch('/api/auditoria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'RESOLVIDO' }),
      })
      if (res.ok) {
        toast({ title: 'Marcado como resolvido' })
        carregarDados()
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro' })
    }
  }

  const formatarData = (data: string) => new Date(data).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  const formatarCep = (cep: string) => cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep

  const formatarValor = (valor: number | null) => valor == null
    ? '-'
    : valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const tempoMedio = data.cards.tempoMedio
  const respostaCanalGeneric = logSelecionado?.respostaCanal?.anymarketResponse
    || logSelecionado?.respostaCanal?.casaImperialResponse

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Requisições & Auditoria</h2>
        <p className="text-muted-foreground">
          Todas as cotações recebidas e falhas pendentes de auditoria
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.cards.total.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">requisições recebidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Resultado</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{data.cards.comResultado.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">cotações entregaram frete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem Resultado</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{data.cards.semResultado.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">nenhuma transportadora retornou</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes Auditoria</CardTitle>
            <ShieldAlert className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{data.cards.pendentesAuditoria.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">{data.cards.resolvidosAuditoria.toLocaleString('pt-BR')} resolvidas</p>
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
            <p className="text-xs text-muted-foreground">média de resposta</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-48">
              <Select value={filtroOrigem} onValueChange={(v) => { setFiltroOrigem(v); setPagina(1) }}>
                <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as origens</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="API">API / Canal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={filtroResultado} onValueChange={(v) => { setFiltroResultado(v); setPagina(1) }}>
                <SelectTrigger><SelectValue placeholder="Resultado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os resultados</SelectItem>
                  <SelectItem value="com">Com resultado</SelectItem>
                  <SelectItem value="sem">Sem resultado</SelectItem>
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

      {/* Tabela de requisições */}
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
              {data.logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma requisição encontrada
                  </TableCell>
                </TableRow>
              ) : (
                data.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">{formatarData(log.dataCotacao)}</TableCell>
                    <TableCell>
                      <Badge variant={log.origem === 'MANUAL' ? 'outline' : 'secondary'} className="text-xs">
                        {log.origem === 'MANUAL' ? 'Manual' : log.marketplace || log.origem}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatarCep(log.cep)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {log.produtos.slice(0, 2).map((p, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{p.sku} x{p.quantidade}</Badge>
                        ))}
                        {log.produtos.length > 2 && <Badge variant="outline" className="text-xs">+{log.produtos.length - 2}</Badge>}
                        {log.produtos.length === 0 && <span className="text-xs text-muted-foreground">-</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.totalTransportadoras > 0 ? (
                        <Badge className="text-xs bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
                          {log.totalTransportadoras} transp.
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Sem resultado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-sm">
                      {formatarValor(log.melhorValor ? Number(log.melhorValor) : null)}
                    </TableCell>
                    <TableCell className="text-sm">{log.melhorPrazo ? `${log.melhorPrazo} dias` : '-'}</TableCell>
                    <TableCell>
                      {log.tempoMs != null ? (
                        <Badge variant="outline" className={`text-xs font-mono ${
                          log.tempoMs <= 250 ? 'border-emerald-500 text-emerald-500' :
                          log.tempoMs <= 500 ? 'border-yellow-500 text-yellow-500' : 'border-red-500 text-red-500'
                        }`}>{log.tempoMs}ms</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setLogSelecionado(log)}>
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
      {data.paginacao.totalPaginas > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>
            Anterior
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            Página {pagina} de {data.paginacao.totalPaginas}
          </span>
          <Button variant="outline" size="sm" disabled={pagina === data.paginacao.totalPaginas} onClick={() => setPagina(p => p + 1)}>
            Próxima
          </Button>
        </div>
      )}

      {/* Seção: Auditoria de Falhas Pendentes */}
      {data.auditoriaPendentes.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-orange-500" />
                  Falhas pendentes de auditoria
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  CEPs sem atendimento ou SKUs não encontrados — marque como resolvido após corrigir.
                </p>
              </div>
              {auditoriaSelecionada.size > 0 && (
                <Button onClick={resolverSelecionadas} disabled={resolvendoLote}>
                  {resolvendoLote
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Resolver ({auditoriaSelecionada.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={data.auditoriaPendentes.length > 0 && data.auditoriaPendentes.every(p => auditoriaSelecionada.has(p.id))}
                      onCheckedChange={toggleTodasAuditorias}
                      aria-label="Selecionar todas"
                    />
                  </TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>CEP</TableHead>
                  <TableHead>SKUs</TableHead>
                  <TableHead>Integração</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.auditoriaPendentes.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Checkbox
                        checked={auditoriaSelecionada.has(a.id)}
                        onCheckedChange={() => toggleAuditoria(a.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {a.tipo === 'SKU_NAO_ENCONTRADO'
                          ? <PackageX className="h-4 w-4 text-orange-500" />
                          : <MapPinOff className="h-4 w-4 text-red-500" />}
                        <span className="text-xs">{a.tipo === 'SKU_NAO_ENCONTRADO' ? 'SKU' : 'CEP'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <p className="text-sm truncate">{a.descricao}</p>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {a.cep ? formatarCep(a.cep) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {a.skus.slice(0, 3).map((sku) => (
                          <Badge key={sku} variant="outline" className="text-xs">{sku}</Badge>
                        ))}
                        {a.skus.length > 3 && <Badge variant="outline" className="text-xs">+{a.skus.length - 3}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {a.integracao ? (
                        <Badge variant="secondary" className="text-xs">{a.integracao.canal.nome}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{a.origem}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatarData(a.criadoEm)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => resolverUma(a.id)}>
                        Resolver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.cards.pendentesAuditoria > data.auditoriaPendentes.length && (
              <div className="p-4 border-t text-xs text-muted-foreground text-center">
                Mostrando {data.auditoriaPendentes.length} de {data.cards.pendentesAuditoria} pendentes. Resolva os atuais para ver os próximos.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de detalhes */}
      <Dialog open={!!logSelecionado} onOpenChange={(open) => !open && setLogSelecionado(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Requisição</DialogTitle>
          </DialogHeader>
          {logSelecionado && (
            <div className="space-y-4">
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
                    <Badge variant="outline" className={`font-mono ${
                      logSelecionado.tempoMs <= 250 ? 'border-emerald-500 text-emerald-500' :
                      logSelecionado.tempoMs <= 500 ? 'border-yellow-500 text-yellow-500' : 'border-red-500 text-red-500'
                    }`}>{logSelecionado.tempoMs}ms</Badge>
                  ) : <p className="text-sm text-muted-foreground">-</p>}
                </div>
                {logSelecionado.ipOrigem && (
                  <div>
                    <p className="text-xs text-muted-foreground">IP Origem</p>
                    <p className="text-sm font-mono">{logSelecionado.ipOrigem}</p>
                  </div>
                )}
              </div>

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

              {respostaCanalGeneric && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Resposta enviada ao canal</h4>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex gap-4 mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Status HTTP</p>
                          <Badge variant={logSelecionado.respostaCanal?.statusEnviado === 200 ? 'default' : 'destructive'}>
                            {logSelecionado.respostaCanal?.statusEnviado}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Items retornados</p>
                          <p className="text-sm font-semibold">{respostaCanalGeneric.items?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Tempo</p>
                          <p className="text-sm font-mono">{logSelecionado.respostaCanal?.tempoMs}ms</p>
                        </div>
                      </div>
                      <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {JSON.stringify(respostaCanalGeneric, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-sm mb-2">Request (o que chegou)</h4>
                <Card>
                  <CardContent className="p-4">
                    <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {(() => {
                        try { return JSON.stringify(JSON.parse(logSelecionado.requestRaw), null, 2) }
                        catch { return logSelecionado.requestRaw || 'Sem dados' }
                      })()}
                    </pre>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Response (o que respondemos)</h4>
                <Card>
                  <CardContent className="p-4">
                    <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {(() => {
                        try { return JSON.stringify(JSON.parse(logSelecionado.responseRaw), null, 2) }
                        catch { return logSelecionado.responseRaw || 'Sem dados' }
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
