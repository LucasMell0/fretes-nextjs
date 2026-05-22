'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Plus, Pencil, Trash2, Loader2, Package, Box, ChevronDown, ChevronRight, Search, X, Download, CheckCircle2, XCircle } from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationWrapper } from '@/components/ui/pagination-wrapper'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  usarDadosPaiParaVariacoes?: boolean
  atributos: Atributo[]
  variacoes?: Produto[]
  produtoPai?: {
    id: number
    nome: string
    peso: number
    cubagem: number
    usarDadosPaiParaVariacoes: boolean
  }
  _count?: {
    cubagens: number
    variacoes: number
  }
}

// Remove acentos e normaliza para busca case-insensitive
const normalizar = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Verifica se o texto bate com a query: split por palavras + match por início de palavra.
// Multi-termo: TODOS os termos da query precisam achar um match em alguma palavra do texto.
// Ex: query="rei caf" bate em "Rei do Café" (rei→Rei, caf→Café), não em "Ferreiro".
const matchBusca = (texto: string, query: string): boolean => {
  const q = normalizar(query).trim()
  if (!q) return true
  const palavrasTexto = normalizar(texto).split(/[\s\-_.,;:/\\()|]+/).filter(Boolean)
  const termos = q.split(/\s+/)
  return termos.every(t => palavrasTexto.some(p => p.startsWith(t)))
}

export default function ProdutosPage() {
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Estado inicial vem da URL (?busca=foo&pagina=3&perPage=25)
  // assim voltar de outras páginas (ex: /dashboard/produtos/[id]/cubagens) restaura o lugar.
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtosExibir, setProdutosExibir] = useState<Produto[]>([])
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [buscaTexto, setBuscaTexto] = useState(searchParams.get('busca') || '')
  const [paginaAtual, setPaginaAtual] = useState(Number(searchParams.get('pagina')) || 1)
  const [itensPorPagina, setItensPorPagina] = useState(Number(searchParams.get('perPage')) || 10)
  const [aplicandoUsarDadosPai, setAplicandoUsarDadosPai] = useState(false)
  const [confirmUsarDadosPaiOpen, setConfirmUsarDadosPaiOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dialogImportacao, setDialogImportacao] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState<{ importados: number; atualizados: number; erros: number; detalhes: Array<{ sku: string; status: string; mensagem?: string }> } | null>(null)
  const [produtosBling, setProdutosBling] = useState<Array<{ id: number; nome: string; codigo: string; formato?: string; estoque?: { saldoVirtualTotal: number } }>>([])
  const [carregandoProdutos, setCarregandoProdutos] = useState(false)
  const [produtosSelecionados, setProdutosSelecionados] = useState<Set<number>>(new Set()) // Para import Bling
  const [produtosTabelaSelecionados, setProdutosTabelaSelecionados] = useState<Set<number>>(new Set()) // Para tabela principal
  const [integracoesBling, setIntegracoesBling] = useState<Array<{ id: number; nome?: string; accessToken?: string | null; canal: { slug: string } }>>([])
  const [integracaoSelecionada, setIntegracaoSelecionada] = useState<string>('')
  const [carregandoIntegracoes, setCarregandoIntegracoes] = useState(false)
  const [buscaBling, setBuscaBling] = useState('')
  const [formData, setFormData] = useState({
    nome: '',
    sku: '',
    peso: 0,
    cubagem: 0,
    crossDocking: 0,
    estoque: 0,
    ativo: true,
    usarDadosPaiParaVariacoes: false,
  })
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<number | null>(null)
  const [confirmDeleteMultipleOpen, setConfirmDeleteMultipleOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)

  // Sincroniza estado de listagem com URL (usa replace para não poluir histórico)
  useEffect(() => {
    const params = new URLSearchParams()
    if (buscaTexto) params.set('busca', buscaTexto)
    if (paginaAtual !== 1) params.set('pagina', String(paginaAtual))
    if (itensPorPagina !== 10) params.set('perPage', String(itensPorPagina))
    const qs = params.toString()
    const url = qs ? `${pathname}?${qs}` : pathname
    if (url !== `${pathname}${window.location.search}`) {
      router.replace(url, { scroll: false })
    }
  }, [buscaTexto, paginaAtual, itensPorPagina, pathname, router])

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

  // Filtrar produtos Bling por busca
  const produtosBlingFiltrados = useMemo(() => {
    if (!buscaBling.trim()) return produtosBling
    return produtosBling.filter(p =>
      matchBusca(p.nome, buscaBling) ||
      (p.codigo ? matchBusca(p.codigo, buscaBling) : false)
    )
  }, [produtosBling, buscaBling])

  const paginationBling = usePagination(produtosBlingFiltrados, 10)

  const aplicarFiltros = (todosProdutos: Produto[], busca: string) => {
    // Filtrar apenas produtos que não são variações (produtoPaiId === null)
    let produtosPai = todosProdutos.filter((p: Produto) => p.produtoPaiId === null)
    
    // Aplicar busca por nome ou SKU (acentos-insensitive, match por início de palavra, multi-termo AND)
    if (busca.trim()) {
      produtosPai = produtosPai.filter(p =>
        matchBusca(p.nome, busca) ||
        matchBusca(p.sku, busca) ||
        p.variacoes?.some(v =>
          matchBusca(v.nome, busca) ||
          matchBusca(v.sku, busca)
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
  }

  const aplicarUsarDadosPaiEmTodos = async () => {
    setConfirmUsarDadosPaiOpen(false)
    try {
      setAplicandoUsarDadosPai(true)
      const res = await fetch('/api/produtos/bulk/usar-dados-pai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao aplicar configuração')

      toast({
        title: 'Configuração aplicada',
        description: `${data.atualizados} produto(s) atualizado(s) para usar dados do pai.`,
      })

      await carregarProdutos()
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao aplicar configuração',
        variant: 'destructive',
      })
    } finally {
      setAplicandoUsarDadosPai(false)
    }
  }

  const toggleProdutoTabela = (id: number) => {
    const novoSet = new Set(produtosTabelaSelecionados)
    if (novoSet.has(id)) {
      novoSet.delete(id)
    } else {
      novoSet.add(id)
    }
    setProdutosTabelaSelecionados(novoSet)
  }

  const selecionarTodosTabela = () => {
    const produtosVisiveis = produtosExibir.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina)
    if (produtosTabelaSelecionados.size === produtosVisiveis.length && produtosVisiveis.length > 0) {
      setProdutosTabelaSelecionados(new Set())
    } else {
      setProdutosTabelaSelecionados(new Set(produtosVisiveis.map(p => p.id)))
    }
  }

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

  const obterDadosExibicao = (produto: Produto, produtoPai?: Produto) => {
    const usarDadosPai = produtoPai && produtoPai.usarDadosPaiParaVariacoes
    return {
      peso: usarDadosPai ? produtoPai.peso : produto.peso,
      cubagem: usarDadosPai ? produtoPai.cubagem : produto.cubagem,
      usandoDadosPai: usarDadosPai || false
    }
  }

  useEffect(() => {
    carregarProdutos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (dialogImportacao) {
      buscarIntegracoesBling()
    } else {
      // Limpar ao fechar o modal
      setProdutosBling([])
      setProdutosSelecionados(new Set())
      setResultadoImport(null)
      setIntegracaoSelecionada('')
      setBuscaBling('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogImportacao])

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
      usarDadosPaiParaVariacoes: false,
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
      usarDadosPaiParaVariacoes: produto.usarDadosPaiParaVariacoes || false,
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

  const deletarSelecionados = async () => {
    if (produtosTabelaSelecionados.size === 0) return

    try {
      const deletePromises = Array.from(produtosTabelaSelecionados).map(id =>
        fetch(`/api/produtos/${id}`, { method: 'DELETE' })
      )

      await Promise.all(deletePromises)

      toast({
        title: 'Produtos deletados!',
        description: `${produtosTabelaSelecionados.size} produto(s) deletado(s) com sucesso`,
      })

      setProdutosTabelaSelecionados(new Set())
      setConfirmDeleteMultipleOpen(false)
      carregarProdutos()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao deletar produtos',
      })
    }
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

  const buscarIntegracoesBling = async () => {
    try {
      setCarregandoIntegracoes(true)
      const integracoesRes = await fetch('/api/usuarios/integracoes')
      const integracoes = await integracoesRes.json()
      const blingIntegracoes = integracoes.filter((i: { canal: { slug: string }; accessToken?: string | null }) => i.canal.slug === 'erp-bling' && i.accessToken)
      
      setIntegracoesBling(blingIntegracoes)
      
      // Se houver apenas 1 integração, selecionar automaticamente
      if (blingIntegracoes.length === 1) {
        setIntegracaoSelecionada(blingIntegracoes[0].id.toString())
      }
      
      if (blingIntegracoes.length === 0) {
        toast({
          title: 'Nenhuma conta Bling conectada',
          description: 'Conecte sua conta do Bling em Integrações para importar produtos.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar integrações',
      })
    } finally {
      setCarregandoIntegracoes(false)
    }
  }

  const listarProdutosBling = async () => {
    if (!integracaoSelecionada) {
      toast({
        title: 'Selecione uma conta',
        description: 'Selecione a conta Bling da qual deseja importar produtos.',
        variant: 'destructive',
      })
      return
    }

    try {
      setCarregandoProdutos(true)
      setProdutosBling([])
      setProdutosSelecionados(new Set())

      const params = new URLSearchParams({
        integracaoId: integracaoSelecionada
      })

      const response = await fetch(`/api/bling/listar-produtos?${params}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erro ao listar produtos')
      }

      const data = await response.json()
      setProdutosBling(data.produtos || [])

      toast({
        title: 'Produtos carregados!',
        description: `${data.produtos.length} produtos encontrados no Bling`,
      })
    } catch (error) {
      console.error('Erro ao listar produtos:', error)
      toast({
        title: 'Erro ao listar produtos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setCarregandoProdutos(false)
    }
  }

  const toggleProdutoSelecionado = (id: number) => {
    const novoSet = new Set(produtosSelecionados)
    if (novoSet.has(id)) {
      novoSet.delete(id)
    } else {
      novoSet.add(id)
    }
    setProdutosSelecionados(novoSet)
  }

  const selecionarTodos = () => {
    if (produtosSelecionados.size === produtosBlingFiltrados.length) {
      setProdutosSelecionados(new Set())
    } else {
      setProdutosSelecionados(new Set(produtosBlingFiltrados.map(p => p.id)))
    }
  }

  const importarProdutosSelecionados = async () => {
    if (produtosSelecionados.size === 0) {
      toast({
        title: 'Nenhum produto selecionado',
        description: 'Selecione pelo menos um produto para importar',
        variant: 'destructive',
      })
      return
    }

    if (!integracaoSelecionada) {
      toast({
        title: 'Selecione uma conta',
        description: 'Selecione a conta Bling para importar os produtos.',
        variant: 'destructive',
      })
      return
    }

    try {
      setImportando(true)
      setResultadoImport(null)

      const response = await fetch('/api/bling/importar-produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integracaoId: integracaoSelecionada,
          produtoIds: Array.from(produtosSelecionados),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erro ao importar produtos')
      }

      const data = await response.json()
      setResultadoImport(data)

      toast({
        title: 'Importação concluída!',
        description: `${data.importados} importados, ${data.atualizados} atualizados`,
      })

      // Limpar seleção e recarregar
      setProdutosSelecionados(new Set())
      carregarProdutos()
    } catch (error) {
      console.error('Erro na importação:', error)
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setImportando(false)
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
        <div className="flex gap-2">
          {produtosTabelaSelecionados.size > 0 && (
            <Button 
              variant="destructive" 
              onClick={() => setConfirmDeleteMultipleOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Deletar Selecionados ({produtosTabelaSelecionados.size})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setConfirmUsarDadosPaiOpen(true)}
            disabled={aplicandoUsarDadosPai}
          >
            {aplicandoUsarDadosPai
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Aplicar &quot;usar dados do pai&quot; em todos
          </Button>
          <Button variant="outline" onClick={() => setDialogImportacao(true)}>
            <Download className="mr-2 h-4 w-4" />
            Importar do Bling
          </Button>
          <Button onClick={abrirDialogNovo}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Campo de Busca */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou SKU (inclui variações)..."
            value={buscaTexto}
            onChange={(e) => handleBuscaChange(e.target.value)}
            className="pl-10 pr-10"
          />
          {buscaTexto && (
            <Button
              size="icon"
              variant="ghost"
              onClick={limparBusca}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
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
              <TableHead className="w-12">
                <Checkbox
                  checked={produtosTabelaSelecionados.size === produtosPaginados.length && produtosPaginados.length > 0}
                  onCheckedChange={selecionarTodosTabela}
                />
              </TableHead>
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
                  <TableCell>
                    <Checkbox
                      checked={produtosTabelaSelecionados.has(p.id)}
                      onCheckedChange={() => toggleProdutoTabela(p.id)}
                    />
                  </TableCell>
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
                {expandidos.has(p.id) && p.variacoes?.map((variacao) => {
                  const dadosExibicao = obterDadosExibicao(variacao, p)
                  return (
                  <TableRow key={variacao.id} className="bg-muted/50">
                    <TableCell></TableCell>
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
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <span>{Number(dadosExibicao.peso).toFixed(2)} kg</span>
                        {dadosExibicao.usandoDadosPai && (
                          <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                            Pai
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <span>{Number(dadosExibicao.cubagem).toFixed(4)}</span>
                        {dadosExibicao.usandoDadosPai && (
                          <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                            Pai
                          </Badge>
                        )}
                      </div>
                    </TableCell>
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
                  )
                })}
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

          <div className="flex items-center justify-center gap-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Mostrando {indiceInicio + 1} a {Math.min(indiceFim, produtosExibir.length)} de {produtosExibir.length} produtos
            </p>
            <div className="flex items-center gap-2">
              <Label htmlFor="itens-por-pagina" className="text-sm text-muted-foreground">
                Itens por página:
              </Label>
              <Select
                value={String(itensPorPagina)}
                onValueChange={(v) => {
                  setItensPorPagina(Number(v))
                  setPaginaAtual(1)
                }}
              >
                <SelectTrigger id="itens-por-pagina" className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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
            {!editando?.produtoPaiId && (
              <div className="col-span-2">
                <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/50">
                  <Switch
                    id="usarDadosPai"
                    checked={formData.usarDadosPaiParaVariacoes}
                    onCheckedChange={(checked) => setFormData({ ...formData, usarDadosPaiParaVariacoes: checked as boolean })}
                  />
                  <div className="flex-1">
                    <Label htmlFor="usarDadosPai" className="cursor-pointer font-medium">
                      Usar dados do pai para variações
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Quando ativo, as variações deste produto usarão automaticamente o peso e cubagem do produto pai. O estoque continua individual.
                    </p>
                  </div>
                </div>
              </div>
            )}
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
        confirmText="Excluir"
        cancelText="Cancelar"
      />

      <ConfirmDialog
        open={confirmDeleteMultipleOpen}
        onOpenChange={setConfirmDeleteMultipleOpen}
        onConfirm={deletarSelecionados}
        title={`Excluir ${produtosTabelaSelecionados.size} produto(s)`}
        description={`Tem certeza que deseja excluir ${produtosTabelaSelecionados.size} produto(s) selecionado(s)? Esta ação não pode ser desfeita.`}
        confirmText="Excluir Todos"
        cancelText="Cancelar"
      />

      <ConfirmDialog
        open={confirmUsarDadosPaiOpen}
        onOpenChange={setConfirmUsarDadosPaiOpen}
        onConfirm={aplicarUsarDadosPaiEmTodos}
        title="Aplicar &quot;usar dados do pai&quot; em todos"
        description="Isso ativa a opção 'usar dados do pai para variações' em TODOS os produtos cadastrados. Confirma?"
        confirmText="Aplicar em todos"
        cancelText="Cancelar"
      />

      {/* Dialog de Importação do Bling */}
      <Dialog open={dialogImportacao} onOpenChange={setDialogImportacao}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Produtos do Bling</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <strong>Configuração automática:</strong> Buscando apenas produtos <strong>ATIVOS</strong> e <strong>PRODUTOS PAI</strong> (sem variações individuais).
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                O sistema irá buscar todas as páginas automaticamente até encontrar todos os produtos.
              </p>
            </div>

            {/* Selecionar Conta Bling */}
            <div>
              <Label htmlFor="conta-bling">Conta Bling</Label>
              {carregandoIntegracoes ? (
                <div className="flex items-center gap-2 p-3 border rounded-md mt-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Carregando contas...</span>
                </div>
              ) : integracoesBling.length === 0 ? (
                <div className="p-3 border rounded-md mt-1 bg-destructive/10 border-destructive/20">
                  <p className="text-sm text-destructive">
                    Nenhuma conta Bling conectada. Configure em <strong>Integrações</strong>.
                  </p>
                </div>
              ) : (
                <Select
                  value={integracaoSelecionada}
                  onValueChange={setIntegracaoSelecionada}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a conta Bling" />
                  </SelectTrigger>
                  <SelectContent>
                    {integracoesBling.map((integracao) => (
                      <SelectItem key={integracao.id} value={integracao.id.toString()}>
                        {integracao.nome || `Conta Bling ${integracao.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Botão Buscar */}
            <Button 
              onClick={listarProdutosBling} 
              disabled={carregandoProdutos || !integracaoSelecionada || integracoesBling.length === 0}
              className="w-full"
            >
              {carregandoProdutos && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {carregandoProdutos ? 'Buscando...' : 'Buscar Produtos do Bling'}
            </Button>

            {/* Campo de Busca */}
            {produtosBling.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou SKU..."
                  value={buscaBling}
                  onChange={(e) => setBuscaBling(e.target.value)}
                  className="pl-10 pr-10"
                />
                {buscaBling && (
                  <button
                    onClick={() => setBuscaBling('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {/* Lista de Produtos com Checkbox */}
            {produtosBling.length > 0 && (
              <>
                <div className="border rounded-lg">
                  <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={produtosSelecionados.size === produtosBlingFiltrados.length && produtosBlingFiltrados.length > 0}
                        onCheckedChange={selecionarTodos}
                      />
                      <Label htmlFor="select-all" className="cursor-pointer">
                        Selecionar Todos ({produtosSelecionados.size} de {produtosBlingFiltrados.length})
                      </Label>
                    </div>
                    <Badge variant="outline">{produtosBling.length} produtos encontrados</Badge>
                  </div>
                  {produtosBlingFiltrados.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum produto encontrado</p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      {paginationBling.paginatedItems.map((produto: { id: number; nome: string; codigo: string; formato?: string; estoque?: { saldoVirtualTotal: number } }) => (
                        <div
                          key={produto.id}
                          className="p-3 border-b last:border-b-0 hover:bg-muted/50 flex items-center gap-3"
                        >
                          <Checkbox
                            id={`produto-${produto.id}`}
                            checked={produtosSelecionados.has(produto.id)}
                            onCheckedChange={() => toggleProdutoSelecionado(produto.id)}
                          />
                          <div className="flex-1 cursor-pointer" onClick={() => toggleProdutoSelecionado(produto.id)}>
                            <div className="font-medium">{produto.nome}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-4">
                              <span>SKU: <span className="font-mono">{produto.codigo}</span></span>
                              <span>Estoque: {Math.floor(produto.estoque?.saldoVirtualTotal || 0)}</span>
                              {produto.formato === 'V' && (
                                <Badge variant="secondary" className="text-xs">Com Variações</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Paginação */}
                <PaginationWrapper
                  currentPage={paginationBling.currentPage}
                  totalPages={paginationBling.totalPages}
                  onPageChange={paginationBling.changePage}
                  generatePageNumbers={paginationBling.generatePageNumbers}
                  startIndex={paginationBling.startIndex}
                  endIndex={paginationBling.endIndex}
                  totalItems={produtosBlingFiltrados.length}
                  itemName="produtos"
                />
              </>
            )}

            {/* Resultado da Importação */}
            {resultadoImport && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <h4 className="font-semibold mb-3">Resultado da Importação</h4>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      <strong>{resultadoImport.importados}</strong> importados
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">
                      <strong>{resultadoImport.atualizados}</strong> atualizados
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm">
                      <strong>{resultadoImport.erros}</strong> erros
                    </span>
                  </div>
                </div>
                
                {resultadoImport.detalhes && resultadoImport.detalhes.length > 0 && (
                  <div className="max-h-48 overflow-y-auto text-xs space-y-1">
                    {resultadoImport.detalhes.slice(0, 10).map((detalhe: { sku: string; status: string; mensagem?: string }, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        {detalhe.status === 'importado' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                        {detalhe.status === 'atualizado' && <Download className="h-3 w-3 text-blue-500" />}
                        {detalhe.status === 'erro' && <XCircle className="h-3 w-3 text-red-500" />}
                        <span className="font-mono">{detalhe.sku}</span>
                        <span className="text-muted-foreground">{detalhe.mensagem}</span>
                      </div>
                    ))}
                    {resultadoImport.detalhes.length > 10 && (
                      <p className="text-muted-foreground text-center pt-2">
                        E mais {resultadoImport.detalhes.length - 10} produtos...
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogImportacao(false)}>
              Fechar
            </Button>
            <Button 
              onClick={importarProdutosSelecionados} 
              disabled={importando || produtosSelecionados.size === 0}
            >
              {importando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {importando ? 'Importando...' : `Importar Selecionados (${produtosSelecionados.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
