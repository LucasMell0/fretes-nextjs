'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { useToast } from '@/components/ui/use-toast'
import { AlertTriangle, PackageX, MapPinOff, Loader2, CheckCircle2, Clock } from 'lucide-react'

interface AuditoriaRegistro {
  id: number
  tipo: 'SKU_NAO_ENCONTRADO' | 'CEP_NAO_ATENDIDO'
  descricao: string
  detalhes: Record<string, unknown> | null
  cep: string | null
  skus: string[]
  origem: string
  marketplace: string | null
  status: 'PENDENTE' | 'RESOLVIDO'
  criadoEm: string
  resolvidoEm: string | null
  integracao: {
    id: number
    canal: {
      nome: string
      slug: string
    }
  } | null
}

interface AuditoriaResponse {
  registros: AuditoriaRegistro[]
  total: number
  pagina: number
  totalPaginas: number
}

export default function AuditoriaPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AuditoriaResponse | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [pagina, setPagina] = useState(1)
  const [atualizandoId, setAtualizandoId] = useState<number | null>(null)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', pagina.toString())
      params.set('limit', '20')
      if (filtroTipo !== 'todos') params.set('tipo', filtroTipo)
      if (filtroStatus !== 'todos') params.set('status', filtroStatus)

      const res = await fetch(`/api/auditoria?${params}`)
      const json = await res.json()
      setData(json)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar auditoria',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtroTipo, filtroStatus])

  const atualizarStatus = async (id: number, novoStatus: 'PENDENTE' | 'RESOLVIDO') => {
    setAtualizandoId(id)
    try {
      const res = await fetch('/api/auditoria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: novoStatus }),
      })

      if (res.ok) {
        toast({
          title: novoStatus === 'RESOLVIDO' ? 'Marcado como resolvido' : 'Reaberto',
        })
        carregarDados()
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao atualizar status',
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
      })
    } finally {
      setAtualizandoId(null)
    }
  }

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const totalPendentes = data?.registros.filter(r => r.status === 'PENDENTE').length || 0

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold">Auditoria</h2>
        <p className="text-muted-foreground">Cotações que não puderam ser realizadas</p>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Falhas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Registros de auditoria</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{totalPendentes}</div>
            <p className="text-xs text-muted-foreground">Aguardando resolução</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolvidos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {(data?.total || 0) - totalPendentes}
            </div>
            <p className="text-xs text-muted-foreground">Problemas corrigidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Select value={filtroTipo} onValueChange={(v) => { setFiltroTipo(v); setPagina(1) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="SKU_NAO_ENCONTRADO">SKU não encontrado</SelectItem>
                  <SelectItem value="CEP_NAO_ATENDIDO">CEP não atendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPagina(1) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="RESOLVIDO">Resolvido</SelectItem>
                </SelectContent>
              </Select>
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
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>CEP</TableHead>
                <TableHead>SKUs</TableHead>
                <TableHead>Integração</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.registros.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum registro de auditoria encontrado
                  </TableCell>
                </TableRow>
              ) : (
                data?.registros.map((registro) => (
                  <TableRow key={registro.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {registro.tipo === 'SKU_NAO_ENCONTRADO' ? (
                          <PackageX className="h-4 w-4 text-orange-500" />
                        ) : (
                          <MapPinOff className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-xs">
                          {registro.tipo === 'SKU_NAO_ENCONTRADO' ? 'SKU' : 'CEP'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <p className="text-sm truncate">{registro.descricao}</p>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {registro.cep ? registro.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {registro.skus.slice(0, 3).map((sku) => (
                          <Badge key={sku} variant="outline" className="text-xs">
                            {sku}
                          </Badge>
                        ))}
                        {registro.skus.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{registro.skus.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {registro.integracao ? (
                        <Badge variant="secondary" className="text-xs">
                          {registro.integracao.canal.nome}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{registro.origem}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatarData(registro.criadoEm)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={registro.status === 'PENDENTE' ? 'destructive' : 'default'}
                        className="text-xs"
                      >
                        {registro.status === 'PENDENTE' ? 'Pendente' : 'Resolvido'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={registro.status === 'PENDENTE' ? 'default' : 'outline'}
                        disabled={atualizandoId === registro.id}
                        onClick={() =>
                          atualizarStatus(
                            registro.id,
                            registro.status === 'PENDENTE' ? 'RESOLVIDO' : 'PENDENTE'
                          )
                        }
                      >
                        {atualizandoId === registro.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : registro.status === 'PENDENTE' ? (
                          'Resolver'
                        ) : (
                          'Reabrir'
                        )}
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
    </div>
  )
}
