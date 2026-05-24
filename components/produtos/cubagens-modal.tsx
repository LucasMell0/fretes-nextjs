'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Loader2, Package, Pencil } from 'lucide-react'

interface Transportadora {
  id: number
  nome: string
}

interface Cubagem {
  id: number
  cubagem: number | null
  peso: number | null
  transportadora: Transportadora
}

interface Produto {
  id: number
  nome: string
  sku: string
  cubagem: number
  peso: number
}

interface CubagensModalProps {
  produtoId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: () => void
}

export function CubagensModal({ produtoId, open, onOpenChange, onChanged }: CubagensModalProps) {
  const { toast } = useToast()

  const [produto, setProduto] = useState<Produto | null>(null)
  const [cubagens, setCubagens] = useState<Cubagem[]>([])
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [cubagemParaExcluir, setCubagemParaExcluir] = useState<number | null>(null)

  const [formData, setFormData] = useState({
    transportadoraId: 0,
    cubagem: null as number | null,
    peso: null as number | null,
  })

  const carregarDados = useCallback(async () => {
    if (!produtoId) return
    try {
      setLoading(true)
      const res = await fetch(`/api/produtos/${produtoId}/cubagens`)
      const data = await res.json()

      if (data.erro) {
        toast({ variant: 'destructive', title: data.erro })
        onOpenChange(false)
        return
      }

      setProduto(data.produto)
      setCubagens(data.cubagens)
      setTransportadoras(data.transportadoras)
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao carregar dados' })
    } finally {
      setLoading(false)
    }
  }, [produtoId, toast, onOpenChange])

  useEffect(() => {
    if (open && produtoId) {
      carregarDados()
    } else if (!open) {
      // reset ao fechar
      setProduto(null)
      setCubagens([])
      setTransportadoras([])
    }
  }, [open, produtoId, carregarDados])

  const abrirFormNovo = () => {
    setEditandoId(null)
    setFormData({
      transportadoraId: transportadorasDisponiveis.length > 0 ? transportadorasDisponiveis[0].id : 0,
      cubagem: null,
      peso: null,
    })
    setFormOpen(true)
  }

  const abrirFormEditar = (c: Cubagem) => {
    setEditandoId(c.id)
    setFormData({
      transportadoraId: c.transportadora.id,
      cubagem: c.cubagem != null ? Number(c.cubagem) : null,
      peso: c.peso != null ? Number(c.peso) : null,
    })
    setFormOpen(true)
  }

  const salvar = async () => {
    if (formData.transportadoraId === 0) {
      toast({ variant: 'destructive', title: 'Selecione uma transportadora' })
      return
    }
    if (!produtoId) return

    try {
      const res = await fetch(`/api/produtos/${produtoId}/cubagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast({ title: editandoId ? 'Cubagem atualizada!' : 'Cubagem salva!' })
        setFormOpen(false)
        setEditandoId(null)
        await carregarDados()
        onChanged?.()
      } else {
        const error = await res.json()
        toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.erro })
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao salvar cubagem' })
    }
  }

  const iniciarExclusao = (id: number) => {
    setCubagemParaExcluir(id)
    setConfirmDialogOpen(true)
  }

  const confirmarExclusao = async () => {
    if (!cubagemParaExcluir || !produtoId) return

    try {
      const res = await fetch(`/api/produtos/${produtoId}/cubagens/${cubagemParaExcluir}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({ title: 'Cubagem excluída!' })
        await carregarDados()
        onChanged?.()
      } else {
        toast({ variant: 'destructive', title: 'Erro ao excluir' })
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao excluir cubagem' })
    } finally {
      setConfirmDialogOpen(false)
      setCubagemParaExcluir(null)
    }
  }

  // Transportadoras disponíveis (sem cubagem cadastrada)
  const transportadorasDisponiveis = transportadoras.filter(
    t => !cubagens.some(c => c.transportadora.id === t.id)
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Peso e Cubagem por Transportadora</DialogTitle>
            {produto && (
              <p className="text-sm text-muted-foreground">{produto.nome}</p>
            )}
          </DialogHeader>

          {loading || !produto ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              {/* Info do Produto */}
              <div className="rounded-md border bg-muted/30 p-4 mb-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">SKU</p>
                    <p className="font-mono font-semibold text-sm">{produto.sku}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Peso Padrão</p>
                    <p className="font-semibold text-sm">{Number(produto.peso).toFixed(4)} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Cubagem Padrão</p>
                    <p className="font-semibold text-sm">{Number(produto.cubagem).toFixed(6)} m³</p>
                  </div>
                </div>
              </div>

              {/* Lista de Configurações */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">Configurações Específicas</h3>
                  <p className="text-xs text-muted-foreground">
                    {cubagens.length} {cubagens.length === 1 ? 'transportadora' : 'transportadoras'} com peso/cubagem customizado
                  </p>
                </div>
                <Button onClick={abrirFormNovo} disabled={transportadorasDisponiveis.length === 0} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </div>

              {cubagens.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold">Transportadora</TableHead>
                      <TableHead className="font-semibold">Peso (kg)</TableHead>
                      <TableHead className="font-semibold">Cubagem (m³)</TableHead>
                      <TableHead className="text-right font-semibold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cubagens.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.transportadora.nome}</TableCell>
                        <TableCell>
                          {c.peso != null ? (
                            <span className="font-mono font-semibold">{Number(c.peso).toFixed(4)}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Padrão</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {c.cubagem != null ? (
                            <span className="font-mono font-semibold">{Number(c.cubagem).toFixed(6)}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Padrão</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            <Button size="sm" variant="ghost" onClick={() => abrirFormEditar(c)} title="Editar">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => iniciarExclusao(c.id)} title="Excluir">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-muted-foreground border rounded-md">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhuma configuração específica cadastrada</p>
                  <p className="text-sm mt-1">Usará peso e cubagem padrão para todas transportadoras</p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub-dialog: adicionar/editar configuração */}
      <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditandoId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editandoId ? 'Editar Peso e Cubagem Específicos' : 'Adicionar Peso e Cubagem Específicos'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="transportadora">Transportadora</Label>
              {editandoId ? (
                <div className="mt-1 px-3 py-2 rounded-md border bg-muted/30 text-sm font-medium">
                  {cubagens.find(c => c.id === editandoId)?.transportadora.nome || '—'}
                </div>
              ) : (
                <Select
                  value={formData.transportadoraId.toString()}
                  onValueChange={(value) => setFormData({ ...formData, transportadoraId: parseInt(value) })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione uma transportadora" />
                  </SelectTrigger>
                  <SelectContent>
                    {transportadorasDisponiveis.map(t => (
                      <SelectItem key={t.id} value={t.id.toString()}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label htmlFor="peso">Peso (kg)</Label>
              <Input
                id="peso"
                type="number"
                step="0.0001"
                placeholder="Deixe vazio para usar o padrão"
                value={formData.peso ?? ''}
                onChange={(e) => setFormData({ ...formData, peso: e.target.value ? parseFloat(e.target.value) : null })}
              />
              {produto && (
                <p className="text-xs text-muted-foreground mt-1">
                  Peso padrão: {Number(produto.peso).toFixed(4)} kg
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="cubagem">Cubagem (m³)</Label>
              <Input
                id="cubagem"
                type="number"
                step="0.000001"
                placeholder="Deixe vazio para usar o padrão"
                value={formData.cubagem ?? ''}
                onChange={(e) => setFormData({ ...formData, cubagem: e.target.value ? parseFloat(e.target.value) : null })}
              />
              {produto && (
                <p className="text-xs text-muted-foreground mt-1">
                  Cubagem padrão: {Number(produto.cubagem).toFixed(6)} m³
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); setEditandoId(null) }}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={confirmarExclusao}
        title="Excluir cubagem"
        description="Tem certeza que deseja excluir esta cubagem? Esta ação não pode ser desfeita."
      />
    </>
  )
}
