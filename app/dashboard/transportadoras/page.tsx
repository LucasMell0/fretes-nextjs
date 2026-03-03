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
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationWrapper } from '@/components/ui/pagination-wrapper'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Transportadora {
  id: number
  nome: string
  fatorCubagem: number
  margemLucro: number
  ativo: boolean
  _count?: {
    regioes: number
  }
}

export default function TransportadorasPage() {
  const { toast } = useToast()
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([])
  const [loading, setLoading] = useState(true)
  
  const pagination = usePagination(transportadoras, 10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Transportadora | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [transportadoraParaExcluir, setTransportadoraParaExcluir] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    nome: '',
    fatorCubagem: 300,
    margemLucro: 0,
    ativo: true,
  })

  const carregarTransportadoras = async () => {
    try {
      const res = await fetch('/api/transportadoras')
      const data = await res.json()
      
      if (Array.isArray(data)) {
        setTransportadoras(data)
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar transportadoras',
          description: data.erro || 'Formato de resposta inválido',
        })
        setTransportadoras([])
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar transportadoras',
      })
      setTransportadoras([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarTransportadoras()
  }, [])

  const abrirDialogNovo = () => {
    setEditando(null)
    setFormData({ nome: '', fatorCubagem: 300, margemLucro: 0, ativo: true })
    setDialogOpen(true)
  }

  const abrirDialogEditar = (transportadora: Transportadora) => {
    setEditando(transportadora)
    setFormData({
      nome: transportadora.nome,
      fatorCubagem: Number(transportadora.fatorCubagem),
      margemLucro: Number(transportadora.margemLucro),
      ativo: transportadora.ativo,
    })
    setDialogOpen(true)
  }

  const salvar = async () => {
    try {
      const url = editando
        ? `/api/transportadoras/${editando.id}`
        : '/api/transportadoras'
      
      const res = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast({
          title: editando ? 'Transportadora atualizada!' : 'Transportadora criada!',
        })
        setDialogOpen(false)
        carregarTransportadoras()
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
        title: 'Erro ao salvar transportadora',
      })
    }
  }

  const iniciarExclusao = (id: number) => {
    setTransportadoraParaExcluir(id)
    setConfirmDialogOpen(true)
  }

  const confirmarExclusao = async () => {
    if (!transportadoraParaExcluir) return

    try {
      const res = await fetch(`/api/transportadoras/${transportadoraParaExcluir}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({ title: 'Transportadora excluída!' })
        carregarTransportadoras()
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao excluir',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir transportadora',
      })
    } finally {
      setConfirmDialogOpen(false)
      setTransportadoraParaExcluir(null)
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Transportadoras</h2>
          <p className="text-muted-foreground">Gerencie as transportadoras cadastradas</p>
        </div>
        <Button onClick={abrirDialogNovo}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Transportadora
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Fator Cubagem</TableHead>
              <TableHead>Margem Lucro (%)</TableHead>
              <TableHead>Regiões</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.nome}</TableCell>
                <TableCell>{Number(t.fatorCubagem)}</TableCell>
                <TableCell>{Number(t.margemLucro)}%</TableCell>
                <TableCell>{t._count?.regioes || 0}</TableCell>
                <TableCell>
                  <Badge variant={t.ativo ? 'default' : 'secondary'}>
                    {t.ativo ? 'Ativa' : 'Inativa'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => abrirDialogEditar(t)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => iniciarExclusao(t.id)}
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
        totalItems={transportadoras.length}
        itemName="transportadoras"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar Transportadora' : 'Nova Transportadora'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="fatorCubagem">Fator de Cubagem</Label>
              <Input
                id="fatorCubagem"
                type="number"
                value={formData.fatorCubagem}
                onChange={(e) =>
                  setFormData({ ...formData, fatorCubagem: parseFloat(e.target.value) })
                }
              />
            </div>
            <div>
              <Label htmlFor="margemLucro">% Aumento no Frete (Margem de Lucro)</Label>
              <Input
                id="margemLucro"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.margemLucro}
                onChange={(e) =>
                  setFormData({ ...formData, margemLucro: parseFloat(e.target.value) || 0 })
                }
                placeholder="Ex: 20 para adicionar 20%"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Percentual que será adicionado ao valor final do frete
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked as boolean })}
              />
              <Label htmlFor="ativo" className="cursor-pointer">Ativa</Label>
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
        title="Excluir transportadora"
        description="Tem certeza que deseja excluir esta transportadora? Esta ação não pode ser desfeita."
      />
    </div>
  )
}
