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
  ShieldAlert, PackageX, MapPinOff, Clock,
} from 'lucide-react'

type Resultado = {
  transportadora: string
  valor: number
  prazo: number
  pesoReal: number
  pesoCubado: number
  pesoTaxado: number
}

type ItemCotacao = {
  kind: 'cotacao'
  id: number
  data: string
  cep: string
  origem: string
  marketplace: string | null
  statusGeral: 'sucesso' | 'sem_resultado'
  tempoMs: number | null
  melhorValor: number | null
  melhorPrazo: number | null
  totalTransportadoras: number
  melhorTransportadora: string | null
  produtos: Array<{ sku: string; nome: string; quantidade: number; pesoTotal: number }>
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
  ipOrigem: string | null
}

type ItemAuditoria = {
  kind: 'auditoria'
  id: number
  data: string
  cep: string | null
  origem: string
  marketplace: string | null
  statusGeral: 'pendente' | 'resolvido'
  tipo: 'SKU_NAO_ENCONTRADO' | 'CEP_NAO_ATENDIDO'
  descricao: string
  skus: string[]
  integracao: { id: number; canal: { nome: string; slug: string } } | null
}

type Item = ItemCotacao | ItemAuditoria

interface Resposta {
  cards: {
    total: number
    comResultado: number
    semResultado: number
    pendentesAuditoria: number
    resolvidosAuditoria: number
    tempoMedio: number | null
  }
  itens: Item[]
  paginacao: { totalFiltrado: number; pagina: number; limit: number; totalPaginas: number }
}

export default function AuditoriaPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Resposta | null>(null)
  const [filtroOrigem, setFiltroOrigem] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroCep, setFiltroCep] = useState('')
  const [pagina, setPagina] = useState(1)
  const [logSelecionado, setLogSelecionado] = useState<ItemCotacao | null>(null)
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set())
  const [resolvendoLote, setResolvendoLote] = useState(false)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', pagina.toString())
      params.set('limit', '30')
      if (filtroOrigem !== 'todos') params.set('origem', filtroOrigem)
      if (filtroStatus !== 'todos') params.set('status', filtroStatus)
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
  }, [pagina, filtroOrigem, filtroStatus])

  const buscarPorCep = () => {
    setPagina(1)
    carregarDados()
  }

  const toggleSelecionada = (id: number) => {
    setSelecionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const togglePendentesDaPagina = () => {
    if (!data) return
    const pendentes = data.itens.filter(i => i.kind === 'auditoria' && i.statusGeral === 'pendente').map(i => i.id)
    const todasMarcadas = pendentes.length > 0 && pendentes.every(id => selecionadas.has(id))
    setSelecionadas(prev => {
      const next = new Set(prev)
      if (todasMarcadas) pendentes.forEach(id => next.delete(id))
      else pendentes.forEach(id => next.add(id))
      return next
    })
  }

  const resolverSelecionadas = async () => {
    const ids = Array.from(selecionadas)
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
        setSelecionadas(new Set())
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

  const atualizarStatusAuditoria = async (id: number, novoStatus: 'PENDENTE' | 'RESOLVIDO') => {
    try {
      const res = await fetch('/api/auditoria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: novoStatus }),
      })
      if (res.ok) {
        toast({ title: novoStatus === 'RESOLVIDO' ? 'Resolvido' : 'Reaberto' })
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

  const renderStatusBadge = (item: Item) => {
    if (item.kind === 'cotacao') {
      return item.statusGeral === 'sucesso'
        ? <Badge className="text-xs bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">Sucesso</Badge>
        : <Badge variant="destructive" className="text-xs">Sem resultado</Badge>
    }
    return item.statusGeral === 'pendente'
      ? <Badge className="text-xs bg-orange-500/10 text-orange-500 hover:bg-orange-500/20">Pendente</Badge>
      : <Badge className="text-xs bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Resolvido</Badge>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold">Requisições & Auditoria</h2>
          <p className="text-muted-foreground">
            Todas as cotações e falhas — filtre por status para focar
          </p>
        </div>
        {selecionadas.size > 0 && (
          <Button onClick={resolverSelecionadas} disabled={resolvendoLote}>
            {resolvendoLote
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Resolver Selecionados ({selecionadas.size})
          </Button>
        )}
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
            <p className="text-xs text-muted-foreground">cotações processadas</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-emerald-500/50 transition-colors" onClick={() => { setFiltroStatus('sucesso'); setPagina(1) }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sucesso</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{data.cards.comResultado.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">com transportadora retornando</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-red-500/50 transition-colors" onClick={() => { setFiltroStatus('sem_resultado'); setPagina(1) }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem Resultado</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{data.cards.semResultado.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">cotações sem frete</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-orange-500/50 transition-colors" onClick={() => { setFiltroStatus('pendente'); setPagina(1) }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
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
            <div className="w-44">
              <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPagina(1) }}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="sucesso">Sucesso</SelectItem>
                  <SelectItem value="sem_resultado">Sem resultado</SelectItem>
                  <SelectItem value="pendente">Pendente (auditoria)</SelectItem>
                  <SelectItem value="resolvido">Resolvido (auditoria)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Select value={filtroOrigem} onValueChange={(v) => { setFiltroOrigem(v); setPagina(1) }}>
                <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as origens</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="API">API / Canal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por CEP"
                value={filtroCep}
                onChange={(e) => setFiltroCep(e.target.value)}
                className="w-44"
                onKeyDown={(e) => e.key === 'Enter' && buscarPorCep()}
              />
              <Button variant="outline" size="icon" onClick={buscarPorCep}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela unificada */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={(() => {
                      const pendentes = data.itens.filter(i => i.kind === 'auditoria' && i.statusGeral === 'pendente')
                      return pendentes.length > 0 && pendentes.every(i => selecionadas.has(i.id))
                    })()}
                    onCheckedChange={togglePendentesDaPagina}
                    aria-label="Selecionar pendentes da página"
                  />
                </TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>CEP</TableHead>
                <TableHead>SKUs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Frete / Descrição</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.itens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                data.itens.map((item) => {
                  const podeSelecionar = item.kind === 'auditoria' && item.statusGeral === 'pendente'
                  const rowKey = `${item.kind}-${item.id}`
                  return (
                    <TableRow key={rowKey}>
                      <TableCell>
                        {podeSelecionar && (
                          <Checkbox
                            checked={selecionadas.has(item.id)}
                            onCheckedChange={() => toggleSelecionada(item.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatarData(item.data)}</TableCell>
                      <TableCell>
                        <Badge variant={item.origem === 'MANUAL' ? 'outline' : 'secondary'} className="text-xs">
                          {item.origem === 'MANUAL' ? 'Manual' : item.marketplace || item.origem}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.cep ? formatarCep(item.cep) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {item.kind === 'cotacao' ? (
                            <>
                              {item.produtos.slice(0, 2).map((p, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{p.sku} x{p.quantidade}</Badge>
                              ))}
                              {item.produtos.length > 2 && <Badge variant="outline" className="text-xs">+{item.produtos.length - 2}</Badge>}
                              {item.produtos.length === 0 && <span className="text-xs text-muted-foreground">-</span>}
                            </>
                          ) : (
                            <>
                              {item.skus.slice(0, 3).map(sku => (
                                <Badge key={sku} variant="outline" className="text-xs">{sku}</Badge>
                              ))}
                              {item.skus.length > 3 && <Badge variant="outline" className="text-xs">+{item.skus.length - 3}</Badge>}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.kind === 'auditoria' && (
                            item.tipo === 'SKU_NAO_ENCONTRADO'
                              ? <PackageX className="h-3.5 w-3.5 text-orange-500" />
                              : <MapPinOff className="h-3.5 w-3.5 text-red-500" />
                          )}
                          {renderStatusBadge(item)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.kind === 'cotacao' ? (
                          <div className="text-sm">
                            {item.melhorValor != null ? (
                              <>
                                <span className="font-semibold">{formatarValor(item.melhorValor)}</span>
                                {item.melhorPrazo && <span className="text-xs text-muted-foreground ml-2">{item.melhorPrazo}d</span>}
                              </>
                            ) : '-'}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.descricao}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.kind === 'cotacao' && item.tempoMs != null ? (
                          <Badge variant="outline" className={`text-xs font-mono ${
                            item.tempoMs <= 250 ? 'border-emerald-500 text-emerald-500' :
                            item.tempoMs <= 500 ? 'border-yellow-500 text-yellow-500' : 'border-red-500 text-red-500'
                          }`}>{item.tempoMs}ms</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.kind === 'cotacao' ? (
                          <Button size="sm" variant="ghost" onClick={() => setLogSelecionado(item)} title="Ver detalhes">
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : item.statusGeral === 'pendente' ? (
                          <Button size="sm" variant="default" onClick={() => atualizarStatusAuditoria(item.id, 'RESOLVIDO')}>
                            Resolver
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => atualizarStatusAuditoria(item.id, 'PENDENTE')}>
                            <Clock className="mr-1 h-3.5 w-3.5" />
                            Reabrir
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Paginação */}
      {data.paginacao.totalPaginas > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button variant="outline" size="sm" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {pagina} de {data.paginacao.totalPaginas} · {data.paginacao.totalFiltrado.toLocaleString('pt-BR')} registros
          </span>
          <Button variant="outline" size="sm" disabled={pagina === data.paginacao.totalPaginas} onClick={() => setPagina(p => p + 1)}>
            Próxima
          </Button>
        </div>
      )}

      {/* Dialog de detalhes (apenas para cotações) */}
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
                  <p className="text-sm font-medium">{formatarData(logSelecionado.data)}</p>
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
