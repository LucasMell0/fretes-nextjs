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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Loader2, Package } from 'lucide-react'

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

export default function CubagensPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  
  const produtoId = parseInt(params?.id as string)
  
  const [produto, setProduto] = useState<Produto | null>(null)
  const [cubagens, setCubagens] = useState<Cubagem[]>([])
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [cubagemParaExcluir, setCubagemParaExcluir] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    transportadoraId: 0,
    cubagem: null as number | null,
    peso: null as number | null,
  })

  useEffect(() => {
    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoId])

  const carregarDados = async () => {
    try {
      const res = await fetch(`/api/produtos/${produtoId}/cubagens`)
      const data = await res.json()
      
      if (data.erro) {
        toast({
          variant: 'destructive',
          title: data.erro,
        })
        router.push('/dashboard/produtos')
        return
      }
      
      setProduto(data.produto)
      setCubagens(data.cubagens)
      setTransportadoras(data.transportadoras)
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
    setFormData({
      transportadoraId: transportadoras.length > 0 ? transportadoras[0].id : 0,
      cubagem: null,
      peso: null,
    })
    setDialogOpen(true)
  }

  const salvar = async () => {
    if (formData.transportadoraId === 0) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma transportadora',
      })
      return
    }

    try {
      const res = await fetch(`/api/produtos/${produtoId}/cubagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast({ title: 'Cubagem salva!' })
        setDialogOpen(false)
        carregarDados()
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
        title: 'Erro ao salvar cubagem',
      })
    }
  }

  const iniciarExclusao = (id: number) => {
    setCubagemParaExcluir(id)
    setConfirmDialogOpen(true)
  }

  const confirmarExclusao = async () => {
    if (!cubagemParaExcluir) return

    try {
      const res = await fetch(`/api/produtos/${produtoId}/cubagens/${cubagemParaExcluir}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({ title: 'Cubagem excluída!' })
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
        title: 'Erro ao excluir cubagem',
      })
    } finally {
      setConfirmDialogOpen(false)
      setCubagemParaExcluir(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!produto) {
    return null
  }

  // Transportadoras disponíveis (que ainda não têm cubagem cadastrada)
  const transportadorasDisponiveis = transportadoras.filter(
    t => !cubagens.some(c => c.transportadora.id === t.id)
  )

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Peso e Cubagem por Transportadora</h2>
          <p className="text-muted-foreground mt-1">{produto.nome}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard/produtos')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Info do Produto */}
      <Card className="mb-6">
        <div className="p-4 border-b bg-muted/50">
          <h3 className="font-semibold text-sm">Produto</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">SKU</p>
              <p className="font-mono font-semibold">{produto.sku}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Peso Padrão</p>
              <p className="font-semibold">{Number(produto.peso).toFixed(4)} kg</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cubagem Padrão</p>
              <p className="font-semibold">{Number(produto.cubagem).toFixed(6)} m³</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Cubagens Cadastradas */}
      <Card className="mb-6">
        <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Configurações Específicas</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {cubagens.length} {cubagens.length === 1 ? 'transportadora' : 'transportadoras'} com peso/cubagem customizado
            </p>
          </div>
          <Button onClick={abrirDialogNovo} disabled={transportadorasDisponiveis.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Configuração
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
                    <Button size="sm" variant="ghost" onClick={() => iniciarExclusao(c.id)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhuma configuração específica cadastrada</p>
            <p className="text-sm mt-1">O produto usará o peso e cubagem padrão para todas transportadoras</p>
          </div>
        )}
      </Card>

      {/* Dialog de Adicionar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Peso e Cubagem Específicos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="transportadora">Transportadora</Label>
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
              <p className="text-xs text-muted-foreground mt-1">
                Peso padrão: {Number(produto.peso).toFixed(4)} kg
              </p>
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
              <p className="text-xs text-muted-foreground mt-1">
                Cubagem padrão: {Number(produto.cubagem).toFixed(6)} m³
              </p>
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
        title="Excluir cubagem"
        description="Tem certeza que deseja excluir esta cubagem? Esta ação não pode ser desfeita."
      />
    </div>
  )
}
