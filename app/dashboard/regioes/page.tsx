'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, Loader2, Receipt, DollarSign, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationWrapper } from '@/components/ui/pagination-wrapper'
import { Switch } from '@/components/ui/switch'
import { Combobox } from '@/components/ui/combobox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Checkbox } from '@/components/ui/checkbox'

interface Transportadora {
  id: number
  nome: string
}

interface Regiao {
  id: number
  nome: string
  cepInicio: string
  cepFim: string
  ativo: boolean
  transportadoraId: number
  transportadora: {
    id: number
    nome: string
  }
  _count: {
    precos: number
  }
}

export default function RegioesPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [regioes, setRegioes] = useState<Regiao[]>([])
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([])
  const [loading, setLoading] = useState(true)
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Regiao | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [regiaoParaExcluir, setRegiaoParaExcluir] = useState<number | null>(null)
  const [confirmDeleteMultipleOpen, setConfirmDeleteMultipleOpen] = useState(false)
  const [dialogImportarOpen, setDialogImportarOpen] = useState(false)
  const [transportadoraSelecionada, setTransportadoraSelecionada] = useState<number>(0)
  
  // Filtros
  const [filtroTransportadora, setFiltroTransportadora] = useState<number>(0)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  
  const [formData, setFormData] = useState({
    nome: '',
    cepInicio: '',
    cepFim: '',
    transportadoraId: 0,
    ativo: true,
  })

  // Aplicar filtros usando useMemo
  const regioesFiltradas = useMemo(() => {
    return regioes.filter(r => {
      // Filtro por transportadora
      if (filtroTransportadora !== 0 && r.transportadoraId !== filtroTransportadora) {
        return false
      }
      
      // Filtro por status
      if (filtroStatus === 'ativo' && !r.ativo) {
        return false
      }
      if (filtroStatus === 'inativo' && r.ativo) {
        return false
      }
      
      return true
    })
  }, [regioes, filtroTransportadora, filtroStatus])

  const pagination = usePagination(regioesFiltradas, 10)

  // OTIMIZADO: Memoizar options do Combobox para evitar recriação
  const transportadorasOptions = useMemo(() => 
    transportadoras.map((t) => ({
      value: t.id.toString(),
      label: t.nome,
    })),
    [transportadoras]
  )

  useEffect(() => {
    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const carregarDados = async () => {
    try {
      const [regioesRes, transRes] = await Promise.all([
        fetch('/api/regioes'),
        fetch('/api/transportadoras'),
      ])
      const regioesData = await regioesRes.json()
      const transData = await transRes.json()
      setRegioes(regioesData)
      // OTIMIZADO: Filtrar transportadoras ativas
      setTransportadoras(transData.filter((t: Transportadora & { ativo: boolean }) => t.ativo))
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
      })
    } finally {
      setLoading(false)
    }
  }

  const formatarCep = (cep: string) => {
    return cep.replace(/(\d{5})(\d{3})/, '$1-$2')
  }

  const limparCep = (valor: string) => {
    const numeros = valor.replace(/\D/g, '')
    if (numeros.length <= 5) return numeros
    return `${numeros.slice(0, 5)}-${numeros.slice(5, 8)}`
  }

  const toggleSelecionado = (id: number) => {
    const novoSet = new Set(selecionados)
    if (novoSet.has(id)) {
      novoSet.delete(id)
    } else {
      novoSet.add(id)
    }
    setSelecionados(novoSet)
  }

  const selecionarTodos = () => {
    if (selecionados.size === pagination.paginatedItems.length && pagination.paginatedItems.length > 0) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(pagination.paginatedItems.map(r => r.id)))
    }
  }

  const abrirDialogNovo = () => {
    setEditando(null)
    setFormData({
      nome: '',
      cepInicio: '',
      cepFim: '',
      transportadoraId: transportadoras[0]?.id || 0,
      ativo: true,
    })
    setDialogOpen(true)
  }

  const abrirDialogEditar = (regiao: Regiao) => {
    setEditando(regiao)
    setFormData({
      nome: regiao.nome,
      cepInicio: regiao.cepInicio,
      cepFim: regiao.cepFim,
      transportadoraId: regiao.transportadoraId,
      ativo: regiao.ativo,
    })
    setDialogOpen(true)
  }

  const salvar = async () => {
    if (!formData.nome || !formData.cepInicio || !formData.cepFim) {
      toast({
        variant: 'destructive',
        title: 'Preencha todos os campos obrigatórios',
      })
      return
    }

    try {
      const url = editando ? `/api/regioes/${editando.id}` : '/api/regioes'
      const payload = {
        ...formData,
        cepInicio: limparCep(formData.cepInicio),
        cepFim: limparCep(formData.cepFim),
      }

      const res = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast({
          title: editando ? 'Região atualizada!' : 'Região criada!',
        })
        setDialogOpen(false)
        carregarDados()
      } else {
        const error = await res.json()
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: error.erro || 'Erro ao salvar',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar região',
      })
    }
  }

  const deletarSelecionados = async () => {
    if (selecionados.size === 0) return

    try {
      const deletePromises = Array.from(selecionados).map(id =>
        fetch(`/api/regioes/${id}`, { method: 'DELETE' })
      )

      await Promise.all(deletePromises)

      toast({
        title: 'Regiões deletadas!',
        description: `${selecionados.size} região(ões) deletada(s) com sucesso`,
      })

      setSelecionados(new Set())
      setConfirmDeleteMultipleOpen(false)
      carregarDados()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao deletar regiões',
      })
    }
  }

  const iniciarExclusao = (id: number) => {
    setRegiaoParaExcluir(id)
    setConfirmDialogOpen(true)
  }

  const confirmarExclusao = async () => {
    if (!regiaoParaExcluir) return

    try {
      const res = await fetch(`/api/regioes/${regiaoParaExcluir}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({ title: 'Região excluída!' })
        carregarDados()
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao excluir',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir região',
      })
    } finally {
      setConfirmDialogOpen(false)
      setRegiaoParaExcluir(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Regiões de Atendimento</h2>
          <p className="text-muted-foreground">Gerencie as regiões e faixas de CEP</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selecionados.size > 0 && (
            <Button 
              variant="destructive" 
              onClick={() => setConfirmDeleteMultipleOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Deletar Selecionados ({selecionados.size})
            </Button>
          )}
          <Button 
            variant="outline"
            onClick={() => {
              if (filtroTransportadora > 0) {
                router.push(`/dashboard/transportadoras/${filtroTransportadora}/importar`)
              } else {
                setDialogImportarOpen(true)
              }
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importar Regiões
          </Button>
          <Button onClick={abrirDialogNovo}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Região
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <div className="p-4">
          <h3 className="font-semibold mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="filtroTransportadora">Transportadora</Label>
              <Select
                value={filtroTransportadora.toString()}
                onValueChange={(value) => setFiltroTransportadora(parseInt(value))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione uma transportadora" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Todas</SelectItem>
                  {transportadoras.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filtroStatus">Status</Label>
              <Select
                value={filtroStatus}
                onValueChange={(value) => setFiltroStatus(value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione um status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativas</SelectItem>
                  <SelectItem value="inativo">Inativas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-muted-foreground">
                {regioesFiltradas.length} regiões filtradas
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selecionados.size === pagination.paginatedItems.length && pagination.paginatedItems.length > 0}
                  onCheckedChange={selecionarTodos}
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Transportadora</TableHead>
              <TableHead>CEP Início</TableHead>
              <TableHead>CEP Fim</TableHead>
              <TableHead>Preços</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Checkbox
                    checked={selecionados.has(r.id)}
                    onCheckedChange={() => toggleSelecionado(r.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.transportadora.nome}</TableCell>
                <TableCell className="font-mono">{formatarCep(r.cepInicio)}</TableCell>
                <TableCell className="font-mono">{formatarCep(r.cepFim)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{r._count.precos} faixas</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={r.ativo ? 'default' : 'secondary'}>
                    {r.ativo ? 'Ativa' : 'Inativa'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/dashboard/regioes/${r.id}/precos`)}
                    title="Gerenciar Faixas de Preço"
                  >
                    <DollarSign className="h-4 w-4 text-primary" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/dashboard/regioes/${r.id}/taxas`)}
                    title="Gerenciar Taxas e ICMS"
                  >
                    <Receipt className="h-4 w-4 text-primary" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => abrirDialogEditar(r)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => iniciarExclusao(r.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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
        totalItems={regioesFiltradas.length}
        itemName="regiões"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar Região' : 'Nova Região'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome da Região</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Sul - RS"
              />
            </div>
            <div>
              <Label htmlFor="transportadora">Transportadora</Label>
              <Combobox
                options={transportadorasOptions}
                value={formData.transportadoraId.toString()}
                onValueChange={(value) => setFormData({ ...formData, transportadoraId: parseInt(value) })}
                placeholder="Selecione uma transportadora"
                searchPlaceholder="Pesquisar transportadora..."
                emptyText="Nenhuma transportadora encontrada."
              />
            </div>
            <div>
              <Label htmlFor="cepInicio">CEP Início</Label>
              <Input
                id="cepInicio"
                value={formatarCep(formData.cepInicio)}
                onChange={(e) =>
                  setFormData({ ...formData, cepInicio: limparCep(e.target.value) })
                }
                placeholder="00000-000"
                maxLength={9}
              />
            </div>
            <div>
              <Label htmlFor="cepFim">CEP Fim</Label>
              <Input
                id="cepFim"
                value={formatarCep(formData.cepFim)}
                onChange={(e) =>
                  setFormData({ ...formData, cepFim: limparCep(e.target.value) })
                }
                placeholder="99999-999"
                maxLength={9}
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked as boolean })}
              />
              <Label htmlFor="ativo" className="cursor-pointer">Região Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={confirmarExclusao}
        title="Excluir região"
        description="Tem certeza que deseja excluir esta região? Esta ação não pode ser desfeita."
      />

      <ConfirmDialog
        open={confirmDeleteMultipleOpen}
        onOpenChange={setConfirmDeleteMultipleOpen}
        onConfirm={deletarSelecionados}
        title={`Excluir ${selecionados.size} região(ões)`}
        description={`Tem certeza que deseja excluir ${selecionados.size} região(ões) selecionada(s)? Esta ação não pode ser desfeita.`}
        confirmText="Excluir Todas"
        cancelText="Cancelar"
      />

      <Dialog open={dialogImportarOpen} onOpenChange={setDialogImportarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecione a Transportadora</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="transportadoraImportar">Transportadora</Label>
              <Select
                value={transportadoraSelecionada.toString()}
                onValueChange={(value) => setTransportadoraSelecionada(parseInt(value))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione uma transportadora" />
                </SelectTrigger>
                <SelectContent>
                  {transportadoras.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogImportarOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if (transportadoraSelecionada > 0) {
                  router.push(`/dashboard/transportadoras/${transportadoraSelecionada}/importar`)
                }
              }}
              disabled={transportadoraSelecionada === 0}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
