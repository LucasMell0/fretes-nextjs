'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Save, X } from 'lucide-react'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationWrapper } from '@/components/ui/pagination-wrapper'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Checkbox } from '@/components/ui/checkbox'

interface Regiao {
  id: number
  nome: string
  cepInicio: string
  cepFim: string
  transportadora: {
    nome: string
  }
}

interface Preco {
  id: number
  pesoInicial: number
  pesoFinal: number
  valor: number
  prazo: number
}

export default function PrecosPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  
  const regiaoId = parseInt(params?.id as string)
  
  const [regiao, setRegiao] = useState<Regiao | null>(null)
  const [precos, setPrecos] = useState<Preco[]>([])
  const pagination = usePagination(precos, 10)
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [kgAdicional, setKgAdicional] = useState<number>(0)
  const [salvandoKgAdicional, setSalvandoKgAdicional] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [precoParaExcluir, setPrecoParaExcluir] = useState<number | null>(null)
  const [confirmDeleteMultipleOpen, setConfirmDeleteMultipleOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    pesoInicial: 0,
    pesoFinal: 0,
    valor: 0,
    prazo: 0,
  })

  const [editData, setEditData] = useState<{
    pesoInicial: number
    pesoFinal: number
    valor: number
    prazo: number
  } | null>(null)

  useEffect(() => {
    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regiaoId])

  const carregarDados = async () => {
    try {
      const res = await fetch(`/api/regioes/${regiaoId}/precos`)
      const data = await res.json()
      
      if (data.erro) {
        toast({
          variant: 'destructive',
          title: data.erro,
        })
        router.push('/dashboard/regioes')
        return
      }
      
      setRegiao(data.regiao)
      setPrecos(data.precos || [])
      setKgAdicional(data.kgAdicional ? Number(data.kgAdicional.valorKgAdicional) : 0)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
      })
    } finally {
      setLoading(false)
    }
  }

  const abrirDialogNovo = () => {
    setEditandoId(null)
    setFormData({
      pesoInicial: 0,
      pesoFinal: 0,
      valor: 0,
      prazo: 0,
    })
    setDialogOpen(true)
  }

  const iniciarEdicao = (preco: Preco) => {
    setEditandoId(preco.id)
    setEditData({
      pesoInicial: Number(preco.pesoInicial),
      pesoFinal: Number(preco.pesoFinal),
      valor: Number(preco.valor),
      prazo: preco.prazo,
    })
  }

  const cancelarEdicao = () => {
    setEditandoId(null)
    setEditData(null)
  }

  const salvar = async () => {
    if (formData.pesoFinal < formData.pesoInicial) {
      toast({
        variant: 'destructive',
        title: 'Peso final não pode ser menor que peso inicial',
      })
      return
    }

    try {
      const res = await fetch(`/api/regioes/${regiaoId}/precos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast({ title: 'Faixa de preço criada!' })
        setDialogOpen(false)
        carregarDados()
      } else {
        const error = await res.json()
        toast({
          variant: 'destructive',
          title: 'Erro ao criar',
          description: error.erro,
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar preço',
      })
    }
  }

  const salvarEdicao = async (id: number, dados: Partial<Preco>) => {
    try {
      const res = await fetch(`/api/regioes/${regiaoId}/precos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      })

      if (res.ok) {
        toast({ title: 'Preço atualizado!' })
        setEditandoId(null)
        carregarDados()
      } else {
        const error = await res.json()
        toast({
          variant: 'destructive',
          title: 'Erro ao atualizar',
          description: error.erro,
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
      })
    }
  }

  const salvarKgAdicional = async () => {
    setSalvandoKgAdicional(true)
    try {
      const res = await fetch(`/api/regioes/${regiaoId}/kg-adicional`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valorKgAdicional: kgAdicional }),
      })

      if (res.ok) {
        toast({ title: 'Valor por KG adicional salvo!' })
      } else {
        const error = await res.json()
        toast({
          variant: 'destructive',
          title: 'Erro ao salvar',
          description: error.erro,
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar KG adicional',
      })
    } finally {
      setSalvandoKgAdicional(false)
    }
  }

  const iniciarExclusao = (id: number) => {
    setPrecoParaExcluir(id)
    setConfirmDialogOpen(true)
  }

  const confirmarExclusao = async () => {
    if (!precoParaExcluir) return

    try {
      const res = await fetch(`/api/regioes/${regiaoId}/precos/${precoParaExcluir}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({ title: 'Faixa de preço excluída!' })
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
        title: 'Erro ao excluir preço',
      })
    } finally {
      setConfirmDialogOpen(false)
      setPrecoParaExcluir(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!regiao) {
    return null
  }

  const formatarCep = (cep: string) => {
    return cep.replace(/(\d{5})(\d{3})/, '$1-$2')
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
      setSelecionados(new Set(pagination.paginatedItems.map(p => p.id)))
    }
  }

  const deletarSelecionados = async () => {
    if (selecionados.size === 0) return

    try {
      const deletePromises = Array.from(selecionados).map(id =>
        fetch(`/api/regioes/${regiaoId}/precos/${id}`, { method: 'DELETE' })
      )

      await Promise.all(deletePromises)

      toast({
        title: 'Pre\u00e7os deletados!',
        description: `${selecionados.size} faixa(s) de pre\u00e7o deletada(s) com sucesso`,
      })

      setSelecionados(new Set())
      setConfirmDeleteMultipleOpen(false)
      carregarDados()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao deletar faixas de pre\u00e7o',
      })
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Faixas de Preço</h2>
          <p className="text-muted-foreground mt-1">
            {regiao.nome} - {regiao.transportadora.nome}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard/regioes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Info da Região */}
      <Card className="mb-6">
        <div className="p-4 border-b bg-muted/50">
          <h3 className="font-semibold text-sm">Região</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">CEP Início</p>
              <p className="font-mono font-semibold">{formatarCep(regiao.cepInicio)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">CEP Fim</p>
              <p className="font-mono font-semibold">{formatarCep(regiao.cepFim)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Faixas Cadastradas</p>
              <p className="font-semibold">{precos.length}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* KG Adicional */}
      <Card className="mb-6">
        <div className="p-4 border-b bg-muted/50">
          <h3 className="font-semibold">Valor por Kg Adicional</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quando o peso exceder a maior faixa cadastrada, este valor será cobrado por cada kg adicional
          </p>
        </div>
        <div className="p-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="kgAdicional">Valor por Kg (R$)</Label>
              <Input
                id="kgAdicional"
                type="number"
                step="0.0001"
                min="0"
                value={kgAdicional}
                onChange={(e) => setKgAdicional(parseFloat(e.target.value) || 0)}
                placeholder="0.6000"
              />
            </div>
            <Button onClick={salvarKgAdicional} disabled={salvandoKgAdicional}>
              {salvandoKgAdicional ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </Card>

      {/* Faixas de Preço */}
      <Card className="mb-6">
        <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Faixas de Preço</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Defina os valores por faixa de peso
            </p>
          </div>
          <div className="flex gap-2">
            {selecionados.size > 0 && (
              <Button 
                variant="destructive" 
                onClick={() => setConfirmDeleteMultipleOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Deletar Selecionados ({selecionados.size})
              </Button>
            )}
            <Button onClick={abrirDialogNovo}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Faixa
            </Button>
          </div>
        </div>
        {precos.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selecionados.size === pagination.paginatedItems.length && pagination.paginatedItems.length > 0}
                    onCheckedChange={selecionarTodos}
                  />
                </TableHead>
                <TableHead className="font-semibold">Peso Inicial (kg)</TableHead>
                <TableHead className="font-semibold">Peso Final (kg)</TableHead>
                <TableHead className="font-semibold">Valor (R$)</TableHead>
                <TableHead className="font-semibold">Prazo (dias)</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.paginatedItems.map((p) => (
                <TableRow key={p.id} className={editandoId === p.id ? 'bg-muted/50' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selecionados.has(p.id)}
                      onCheckedChange={() => toggleSelecionado(p.id)}
                      disabled={editandoId === p.id}
                    />
                  </TableCell>
                  <TableCell>
                    {editandoId === p.id && editData ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editData.pesoInicial}
                        onChange={(e) => setEditData({ ...editData, pesoInicial: parseFloat(e.target.value) || 0 })}
                        className="w-32 h-8"
                      />
                    ) : (
                      <span className="font-medium">{Number(p.pesoInicial).toFixed(2)} kg</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editandoId === p.id && editData ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editData.pesoFinal}
                        onChange={(e) => setEditData({ ...editData, pesoFinal: parseFloat(e.target.value) || 0 })}
                        className="w-32 h-8"
                      />
                    ) : (
                      <span className="font-medium">{Number(p.pesoFinal).toFixed(2)} kg</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editandoId === p.id && editData ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editData.valor}
                        onChange={(e) => setEditData({ ...editData, valor: parseFloat(e.target.value) || 0 })}
                        className="w-32 h-8"
                      />
                    ) : (
                      <span className="font-medium">R$ {Number(p.valor).toFixed(2)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editandoId === p.id && editData ? (
                      <Input
                        type="number"
                        min="0"
                        value={editData.prazo}
                        onChange={(e) => setEditData({ ...editData, prazo: parseInt(e.target.value) || 0 })}
                        className="w-24 h-8"
                      />
                    ) : (
                      <span className="font-medium">{p.prazo} dias</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {editandoId === p.id ? (
                        <>
                          <Button size="sm" variant="default" onClick={() => editData && salvarEdicao(p.id, editData)}>
                            <Save className="h-3.5 w-3.5 mr-1" />
                            Salvar
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelarEdicao}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => iniciarEdicao(p)} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => iniciarExclusao(p.id)} title="Excluir">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            Nenhuma faixa de preço cadastrada
          </div>
        )}
      </Card>

      {precos.length > 0 && (
        <PaginationWrapper
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.changePage}
          generatePageNumbers={pagination.generatePageNumbers}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          totalItems={precos.length}
          itemName="faixas de preço"
        />
      )}

      {/* Dialog de Nova Faixa */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Faixa de Preço</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pesoInicial">Peso Inicial (kg)</Label>
                <Input
                  id="pesoInicial"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.pesoInicial}
                  onChange={(e) => setFormData({ ...formData, pesoInicial: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="pesoFinal">Peso Final (kg)</Label>
                <Input
                  id="pesoFinal"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.pesoFinal}
                  onChange={(e) => setFormData({ ...formData, pesoFinal: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="valor">Valor (R$)</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="prazo">Prazo (dias)</Label>
                <Input
                  id="prazo"
                  type="number"
                  min="0"
                  value={formData.prazo}
                  onChange={(e) => setFormData({ ...formData, prazo: parseInt(e.target.value) || 0 })}
                />
              </div>
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
        title="Excluir faixa de preço"
        description="Tem certeza que deseja excluir esta faixa de preço? Esta ação não pode ser desfeita."
      />

      <ConfirmDialog
        open={confirmDeleteMultipleOpen}
        onOpenChange={setConfirmDeleteMultipleOpen}
        onConfirm={deletarSelecionados}
        title={`Excluir ${selecionados.size} faixa(s) de preço`}
        description={`Tem certeza que deseja excluir ${selecionados.size} faixa(s) de preço selecionada(s)? Esta ação não pode ser desfeita.`}
        confirmText="Excluir Todas"
        cancelText="Cancelar"
      />
    </div>
  )
}
