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
import { Plus, Pencil, Trash2, Loader2, Package, Box, ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from '@/components/ui/input-group'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Atributo {
  id: number
  atributo: string
  valor: string
}

interface Produto {
  id: number
  produtoPaiId: number | null
  nome: string
  sku: string
  peso: number
  cubagem: number
  crossDocking: number
  estoque: number
  ativo: boolean
  atributos: Atributo[]
  variacoes?: Produto[]
  _count?: {
    cubagens: number
    variacoes: number
  }
}

export default function ProdutosPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtosExibir, setProdutosExibir] = useState<Produto[]>([])
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [buscaTexto, setBuscaTexto] = useState('')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [itensPorPagina] = useState(10)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [formData, setFormData] = useState({
    nome: '',
    sku: '',
    peso: 0,
    cubagem: 0,
    crossDocking: 0,
    estoque: 0,
    ativo: true,
  })
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<number | null>(null)

  const carregarProdutos = async () => {
    try {
      const res = await fetch('/api/produtos')
      const data = await res.json()
      
      setProdutos(data)
      aplicarFiltros(data, buscaTexto)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar produtos',
      })
    } finally {
      setLoading(false)
    }
  }

  const aplicarFiltros = (todosProdutos: Produto[], busca: string) => {
    // Filtrar apenas produtos que não são variações (produtoPaiId === null)
    let produtosPai = todosProdutos.filter((p: Produto) => p.produtoPaiId === null)
    
    // Aplicar busca por nome ou SKU
    if (busca.trim()) {
      const buscaLower = busca.toLowerCase()
      produtosPai = produtosPai.filter(p => 
        p.nome.toLowerCase().includes(buscaLower) ||
        p.sku.toLowerCase().includes(buscaLower) ||
        // Buscar também nas variações
        p.variacoes?.some(v => 
          v.nome.toLowerCase().includes(buscaLower) ||
          v.sku.toLowerCase().includes(buscaLower)
        )
      )
    }
    
    setProdutosExibir(produtosPai)
  }

  const handleBuscaChange = (valor: string) => {
    setBuscaTexto(valor)
    aplicarFiltros(produtos, valor)
  }

  const limparBusca = () => {
    setBuscaTexto('')
    aplicarFiltros(produtos, '')
    setPaginaAtual(1)
  }

  // Paginação
  const totalPaginas = Math.ceil(produtosExibir.length / itensPorPagina)
  const indiceInicio = (paginaAtual - 1) * itensPorPagina
  const indiceFim = indiceInicio + itensPorPagina
  const produtosPaginados = produtosExibir.slice(indiceInicio, indiceFim)

  const mudarPagina = (novaPagina: number) => {
    if (novaPagina >= 1 && novaPagina <= totalPaginas) {
      setPaginaAtual(novaPagina)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const gerarNumerosPaginas = () => {
    const paginas: (number | string)[] = []
    const maxPaginasVisiveis = 5
    
    if (totalPaginas <= maxPaginasVisiveis) {
      for (let i = 1; i <= totalPaginas; i++) {
        paginas.push(i)
      }
    } else {
      if (paginaAtual <= 3) {
        for (let i = 1; i <= 3; i++) paginas.push(i)
        paginas.push('...')
        paginas.push(totalPaginas)
      } else if (paginaAtual >= totalPaginas - 2) {
        paginas.push(1)
        paginas.push('...')
        for (let i = totalPaginas - 2; i <= totalPaginas; i++) paginas.push(i)
      } else {
        paginas.push(1)
        paginas.push('...')
        for (let i = paginaAtual - 1; i <= paginaAtual + 1; i++) paginas.push(i)
        paginas.push('...')
        paginas.push(totalPaginas)
      }
    }
    
    return paginas
  }

  const toggleExpansao = (produtoId: number) => {
    const novosExpandidos = new Set(expandidos)
    if (novosExpandidos.has(produtoId)) {
      novosExpandidos.delete(produtoId)
    } else {
      novosExpandidos.add(produtoId)
    }
    setExpandidos(novosExpandidos)
  }

  const formatarAtributos = (atributos: Atributo[]) => {
    if (!atributos || atributos.length === 0) return ''
    return atributos.map(a => `${a.atributo}: ${a.valor}`).join(' | ')
  }

  useEffect(() => {
    carregarProdutos()
  }, [])

  const abrirDialogNovo = () => {
    setEditando(null)
    setFormData({
      nome: '',
      sku: '',
      peso: 0,
      cubagem: 0,
      crossDocking: 0,
      estoque: 0,
      ativo: true,
    })
    setDialogOpen(true)
  }

  const abrirDialogEditar = (produto: Produto) => {
    setEditando(produto)
    setFormData({
      nome: produto.nome,
      sku: produto.sku,
      peso: Number(produto.peso),
      cubagem: Number(produto.cubagem),
      crossDocking: produto.crossDocking,
      estoque: produto.estoque,
      ativo: produto.ativo,
    })
    setDialogOpen(true)
  }

  const salvar = async () => {
    try {
      const url = editando ? `/api/produtos/${editando.id}` : '/api/produtos'

      const res = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast({
          title: editando ? 'Produto atualizado!' : 'Produto criado!',
        })
        setDialogOpen(false)
        carregarProdutos()
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
        title: 'Erro ao salvar produto',
      })
    }
  }

  const iniciarExclusao = (id: number) => {
    setProdutoParaExcluir(id)
    setConfirmDialogOpen(true)
  }

  const confirmarExclusao = async () => {
    if (!produtoParaExcluir) return

    try {
      const res = await fetch(`/api/produtos/${produtoParaExcluir}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({ title: 'Produto excluído!' })
        carregarProdutos()
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao excluir',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir produto',
      })
    } finally {
      setConfirmDialogOpen(false)
      setProdutoParaExcluir(null)
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
          <h2 className="text-3xl font-bold">Produtos</h2>
          <p className="text-muted-foreground">Gerencie os produtos cadastrados</p>
        </div>
        <Button onClick={abrirDialogNovo}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      {/* Campo de Busca */}
      <div className="mb-6">
        <InputGroup>
          <InputGroupInput
            placeholder="Buscar por nome ou SKU (inclui variações)..."
            value={buscaTexto}
            onChange={(e) => handleBuscaChange(e.target.value)}
            className="ps-10"
          />
          <InputGroupAddon align="inline-start">
            <Search className="h-4 w-4" />
          </InputGroupAddon>
          {buscaTexto && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                onClick={limparBusca}
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        {buscaTexto && (
          <p className="text-sm text-muted-foreground mt-2">
            Exibindo <strong>{produtosExibir.length}</strong> de <strong>{produtos.filter(p => p.produtoPaiId === null).length}</strong> produtos
          </p>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Peso</TableHead>
              <TableHead>Cubagem</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produtosPaginados.map((p) => (
              <>
                {/* Linha do produto pai */}
                <TableRow key={p.id} className={p._count?.variacoes ? 'font-medium' : ''}>
                  <TableCell className="font-mono">
                    <div className="flex items-center gap-2">
                      {p._count?.variacoes ? (
                        <button
                          onClick={() => toggleExpansao(p.id)}
                          className="hover:bg-accent rounded p-1"
                        >
                          {expandidos.has(p.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      ) : (
                        <span className="w-6" />
                      )}
                      {p.sku}
                      {p._count?.variacoes ? (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {p._count.variacoes} variações
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{p.nome}</TableCell>
                  <TableCell>{Number(p.peso).toFixed(2)} kg</TableCell>
                  <TableCell>{Number(p.cubagem).toFixed(4)}</TableCell>
                  <TableCell>{p.estoque}</TableCell>
                  <TableCell>
                    <Badge variant={p.ativo ? 'default' : 'secondary'}>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/dashboard/produtos/${p.id}/variacoes`)}
                      title="Gerenciar Variações"
                    >
                      <Package className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/dashboard/produtos/${p.id}/cubagens`)}
                      title="Cubagens por Transportadora"
                    >
                      <Box className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirDialogEditar(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => iniciarExclusao(p.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>

                {/* Linhas das variações (se expandido) */}
                {expandidos.has(p.id) && p.variacoes?.map((variacao) => (
                  <TableRow key={variacao.id} className="bg-muted/50">
                    <TableCell className="font-mono text-sm">
                      <div className="pl-8">{variacao.sku}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-1">
                        <span>{variacao.nome}</span>
                        {variacao.atributos.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {formatarAtributos(variacao.atributos)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{Number(variacao.peso).toFixed(2)} kg</TableCell>
                    <TableCell className="text-sm">{Number(variacao.cubagem).toFixed(4)}</TableCell>
                    <TableCell className="text-sm">{variacao.estoque}</TableCell>
                    <TableCell>
                      <Badge variant={variacao.ativo ? 'default' : 'secondary'} className="text-xs">
                        {variacao.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/dashboard/produtos/${variacao.id}/cubagens`)}
                        title="Cubagens por Transportadora"
                      >
                        <Box className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => abrirDialogEditar(variacao)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => iniciarExclusao(variacao.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    mudarPagina(paginaAtual - 1)
                  }}
                  className={paginaAtual === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              
              {gerarNumerosPaginas().map((numero, index) => (
                <PaginationItem key={index}>
                  {numero === '...' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        mudarPagina(numero as number)
                      }}
                      isActive={paginaAtual === numero}
                    >
                      {numero}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    mudarPagina(paginaAtual + 1)
                  }}
                  className={paginaAtual === totalPaginas ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          
          <p className="text-center text-sm text-muted-foreground mt-2">
            Mostrando {indiceInicio + 1} a {Math.min(indiceFim, produtosExibir.length)} de {produtosExibir.length} produtos
          </p>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                disabled={!!editando}
              />
            </div>
            <div>
              <Label htmlFor="peso">Peso (kg)</Label>
              <Input
                id="peso"
                type="number"
                step="0.01"
                value={formData.peso}
                onChange={(e) =>
                  setFormData({ ...formData, peso: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label htmlFor="cubagem">Cubagem (m³)</Label>
              <Input
                id="cubagem"
                type="number"
                step="0.0001"
                value={formData.cubagem}
                onChange={(e) =>
                  setFormData({ ...formData, cubagem: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label htmlFor="crossDocking">Cross-Docking (dias)</Label>
              <Input
                id="crossDocking"
                type="number"
                value={formData.crossDocking}
                onChange={(e) =>
                  setFormData({ ...formData, crossDocking: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label htmlFor="estoque">Estoque</Label>
              <Input
                id="estoque"
                type="number"
                value={formData.estoque}
                onChange={(e) =>
                  setFormData({ ...formData, estoque: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked as boolean })}
              />
              <Label htmlFor="ativo" className="cursor-pointer">Ativo</Label>
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
        title="Excluir produto"
        description="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
      />
    </div>
  )
}
