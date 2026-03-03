'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Plus, Pencil, Save, X, Trash2, Loader2, Eye } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface ProdutoVariacao {
  id: number
  atributo: string
  valor: string
}

interface Variacao {
  id: number
  nome: string
  sku: string
  peso: number
  cubagem: number
  crossDocking: number
  estoque: number
  ativo: boolean
  atributos: ProdutoVariacao[]
}

interface Produto {
  id: number
  nome: string
  sku: string
  peso: number
  cubagem: number
  crossDocking: number
}

interface TipoVariacao {
  nome: string
  valores: string[]
}

export default function VariacoesPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  
  const produtoId = parseInt(params.id as string)
  
  const [produtoPai, setProdutoPai] = useState<Produto | null>(null)
  const [variacoes, setVariacoes] = useState<Variacao[]>([])
  const [loading, setLoading] = useState(true)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editData, setEditData] = useState<any>({})
  
  // Gerador de variações
  const [salvando, setSalvando] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [variacaoParaExcluir, setVariacaoParaExcluir] = useState<number | null>(null)
  const [skuBase, setSkuBase] = useState('')
  const [tipos, setTipos] = useState<TipoVariacao[]>([])
  const [novoTipoNome, setNovoTipoNome] = useState('')
  const [novoValor, setNovoValor] = useState<{ [key: number]: string }>({})
  const [mostrarPreview, setMostrarPreview] = useState(false)

  useEffect(() => {
    carregarDados()
  }, [produtoId])

  const carregarDados = async () => {
    try {
      const res = await fetch(`/api/produtos/${produtoId}/variacoes`)
      const data = await res.json()
      
      if (data.erro) {
        toast({
          variant: 'destructive',
          title: data.erro,
        })
        router.push('/dashboard/produtos')
        return
      }
      
      setProdutoPai(data.produtoPai)
      setVariacoes(data.variacoes)
      setSkuBase(data.produtoPai.sku)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
      })
    } finally {
      setLoading(false)
    }
  }

  const adicionarTipo = () => {
    if (!novoTipoNome.trim()) {
      toast({
        variant: 'destructive',
        title: 'Digite o nome do tipo de variação',
      })
      return
    }

    if (tipos.find(t => t.nome.toLowerCase() === novoTipoNome.toLowerCase())) {
      toast({
        variant: 'destructive',
        title: 'Este tipo já foi adicionado',
      })
      return
    }

    setTipos([...tipos, { nome: novoTipoNome, valores: [] }])
    setNovoTipoNome('')
  }

  const removerTipo = (index: number) => {
    setTipos(tipos.filter((_, i) => i !== index))
  }

  const adicionarValor = (tipoIndex: number) => {
    const valor = novoValor[tipoIndex]?.trim()
    
    if (!valor) return

    const tipo = tipos[tipoIndex]
    if (tipo.valores.includes(valor)) {
      toast({
        variant: 'destructive',
        title: 'Este valor já foi adicionado',
      })
      return
    }

    const novosTipos = [...tipos]
    novosTipos[tipoIndex].valores.push(valor)
    setTipos(novosTipos)
    
    setNovoValor({ ...novoValor, [tipoIndex]: '' })
  }

  const removerValor = (tipoIndex: number, valorIndex: number) => {
    const novosTipos = [...tipos]
    novosTipos[tipoIndex].valores.splice(valorIndex, 1)
    setTipos(novosTipos)
  }

  const gerarCombinacoes = () => {
    if (tipos.length === 0) return []

    let combinacoes: Array<Array<{ tipo: string; valor: string }>> = [[]]

    tipos.forEach(tipo => {
      const novasCombinacoes: Array<Array<{ tipo: string; valor: string }>> = []
      combinacoes.forEach(combinacao => {
        tipo.valores.forEach(valor => {
          novasCombinacoes.push([...combinacao, { tipo: tipo.nome, valor }])
        })
      })
      combinacoes = novasCombinacoes
    })

    return combinacoes
  }

  const gerarVariacoes = async () => {
    if (tipos.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Adicione pelo menos um tipo de variação',
      })
      return
    }

    const temValores = tipos.every(t => t.valores.length > 0)
    if (!temValores) {
      toast({
        variant: 'destructive',
        title: 'Todos os tipos precisam ter valores',
      })
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`/api/produtos/${produtoId}/variacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuBase, tipos }),
      })

      const data = await res.json()

      if (data.sucesso) {
        toast({
          title: `${data.total} variação(ões) gerada(s)!`,
        })
        
        if (data.erros && data.erros.length > 0) {
          toast({
            variant: 'destructive',
            title: 'Alguns SKUs já existiam',
            description: data.erros.join(', '),
          })
        }

        setTipos([])
        setMostrarPreview(false)
        carregarDados()
      } else {
        toast({
          variant: 'destructive',
          title: data.erro || 'Erro ao gerar variações',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar variações',
      })
    } finally {
      setLoading(false)
    }
  }

  const iniciarEdicao = (variacao: Variacao) => {
    setEditandoId(variacao.id)
    setEditData({
      peso: variacao.peso,
      cubagem: variacao.cubagem,
      crossDocking: variacao.crossDocking,
      estoque: variacao.estoque,
    })
  }

  const cancelarEdicao = () => {
    setEditandoId(null)
    setEditData({})
  }

  const salvarVariacao = async (id: number) => {
    try {
      // Filtrar valores inválidos (NaN, undefined, null) mas permitir 0
      const dadosLimpos: any = {}
      
      if (typeof editData.peso === 'number' && !isNaN(editData.peso)) {
        dadosLimpos.peso = editData.peso
      }
      if (typeof editData.cubagem === 'number' && !isNaN(editData.cubagem)) {
        dadosLimpos.cubagem = editData.cubagem
      }
      if (typeof editData.crossDocking === 'number' && !isNaN(editData.crossDocking)) {
        dadosLimpos.crossDocking = editData.crossDocking
      }
      if (typeof editData.estoque === 'number' && !isNaN(editData.estoque)) {
        dadosLimpos.estoque = editData.estoque
      }

      const res = await fetch(`/api/produtos/${produtoId}/variacoes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosLimpos),
      })

      if (res.ok) {
        toast({ title: 'Variação atualizada!' })
        setEditandoId(null)
        carregarDados()
      } else {
        const error = await res.json()
        toast({
          variant: 'destructive',
          title: 'Erro ao atualizar',
          description: error.erro || 'Verifique os valores',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar variação',
      })
    }
  }

  const iniciarExclusao = (id: number) => {
    setVariacaoParaExcluir(id)
    setConfirmDialogOpen(true)
  }

  const confirmarExclusao = async () => {
    if (!variacaoParaExcluir) return

    try {
      const res = await fetch(`/api/produtos/${produtoId}/variacoes/${variacaoParaExcluir}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({ title: 'Variação excluída!' })
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
        title: 'Erro ao excluir variação',
      })
    } finally {
      setConfirmDialogOpen(false)
      setVariacaoParaExcluir(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!produtoPai) {
    return null
  }

  const combinacoes = gerarCombinacoes()

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Variações de Produto</h2>
          <p className="text-muted-foreground mt-1">{produtoPai.nome}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard/produtos')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Info do Produto Pai */}
      <Card className="mb-6">
        <div className="p-4 border-b bg-muted/50">
          <h3 className="font-semibold text-sm">Produto Pai</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">SKU Base</p>
              <p className="font-mono font-semibold">{produtoPai.sku}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Peso</p>
              <p className="font-semibold">{Number(produtoPai.peso).toFixed(4)} kg</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cubagem</p>
              <p className="font-semibold">{Number(produtoPai.cubagem).toFixed(6)} m³</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cross-Docking</p>
              <p className="font-semibold">{produtoPai.crossDocking} dias</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Variações Existentes */}
      {variacoes.length > 0 && (
        <Card className="mb-6">
          <div className="p-4 border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Variações Cadastradas</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {variacoes.length} {variacoes.length === 1 ? 'variação' : 'variações'}
                </p>
              </div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">SKU</TableHead>
                <TableHead className="font-semibold">Atributos</TableHead>
                <TableHead className="font-semibold">Peso (kg)</TableHead>
                <TableHead className="font-semibold">Cubagem (m³)</TableHead>
                <TableHead className="font-semibold">Cross-D</TableHead>
                <TableHead className="font-semibold">Estoque</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variacoes.map((v) => (
                <TableRow key={v.id} className={editandoId === v.id ? 'bg-muted/50' : ''}>
                  <TableCell className="font-mono text-sm font-medium">{v.sku}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {v.atributos.map((a, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          <span className="font-medium">{a.atributo}:</span> {a.valor}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {editandoId === v.id ? (
                      <Input
                        type="number"
                        step="0.0001"
                        value={editData.peso}
                        onChange={(e) => setEditData({ ...editData, peso: parseFloat(e.target.value) })}
                        className="w-28 h-8"
                      />
                    ) : (
                      <span className="font-medium">{Number(v.peso).toFixed(4)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editandoId === v.id ? (
                      <Input
                        type="number"
                        step="0.000001"
                        value={editData.cubagem}
                        onChange={(e) => setEditData({ ...editData, cubagem: parseFloat(e.target.value) })}
                        className="w-32 h-8"
                      />
                    ) : (
                      <span className="font-medium">{Number(v.cubagem).toFixed(6)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editandoId === v.id ? (
                      <Input
                        type="number"
                        value={editData.crossDocking}
                        onChange={(e) => setEditData({ ...editData, crossDocking: parseInt(e.target.value) })}
                        className="w-20 h-8"
                      />
                    ) : (
                      <Badge variant="outline">{v.crossDocking}d</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editandoId === v.id ? (
                      <Input
                        type="number"
                        value={editData.estoque}
                        onChange={(e) => setEditData({ ...editData, estoque: parseInt(e.target.value) })}
                        className="w-20 h-8"
                      />
                    ) : (
                      <Badge variant={v.estoque > 0 ? 'default' : 'secondary'}>
                        {v.estoque}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {editandoId === v.id ? (
                        <>
                          <Button size="sm" variant="default" onClick={() => salvarVariacao(v.id)}>
                            <Save className="h-3.5 w-3.5 mr-1" />
                            Salvar
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelarEdicao}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => iniciarEdicao(v)} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => iniciarExclusao(v.id)} title="Excluir">
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
        </Card>
      )}

      {/* Gerador de Variações */}
      <Card>
        <div className="p-4 border-b bg-muted/50">
          <h3 className="font-semibold flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Gerar Variações Automaticamente
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Crie múltiplas variações a partir de tipos e valores
          </p>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="skuBase">SKU Base</Label>
            <Input
              id="skuBase"
              value={skuBase}
              onChange={(e) => setSkuBase(e.target.value)}
              placeholder="PROD-001"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              As variações terão este SKU + sufixo dos atributos
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div>
              <Label className="text-sm font-semibold">Adicionar Tipo de Variação</Label>
              <p className="text-xs text-muted-foreground mt-1">Ex: Cor, Tamanho, Modelo</p>
            </div>
            <div className="flex gap-2">
              <Input
                value={novoTipoNome}
                onChange={(e) => setNovoTipoNome(e.target.value)}
                placeholder="Nome do tipo (ex: Cor)"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarTipo())}
              />
              <Button onClick={adicionarTipo}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Lista de Tipos */}
          {tipos.map((tipo, tipoIndex) => (
            <Card key={tipoIndex}>
              <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                <h4 className="font-semibold">{tipo.nome}</h4>
                <Button size="sm" variant="outline" onClick={() => removerTipo(tipoIndex)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={novoValor[tipoIndex] || ''}
                    onChange={(e) => setNovoValor({ ...novoValor, [tipoIndex]: e.target.value })}
                    placeholder="Digite uma opção (ex: Azul)"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarValor(tipoIndex))}
                  />
                  <Button variant="secondary" onClick={() => adicionarValor(tipoIndex)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Opções adicionadas:</p>
                  <div className="flex flex-wrap gap-2">
                    {tipo.valores.map((valor, valorIndex) => (
                      <Badge key={valorIndex} variant="secondary" className="pl-3 pr-1 py-1">
                        {valor}
                        <button
                          onClick={() => removerValor(tipoIndex, valorIndex)}
                          className="ml-2 hover:bg-destructive/20 rounded-sm p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {tipo.valores.length === 0 && (
                      <span className="text-sm text-muted-foreground">Nenhuma opção adicionada</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <div className="flex gap-3 pt-2">
            <Button 
              onClick={gerarVariacoes} 
              className="flex-1" 
              disabled={tipos.length === 0}
              size="lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              Gerar Todas as Variações
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setMostrarPreview(!mostrarPreview)}
              disabled={combinacoes.length === 0}
            >
              <Eye className="mr-2 h-4 w-4" />
              {mostrarPreview ? 'Ocultar' : 'Visualizar'} Preview
            </Button>
          </div>

          {/* Preview */}
          {mostrarPreview && combinacoes.length > 0 && (
            <Card className="border-2 border-primary/20">
              <div className="p-4 border-b bg-primary/5">
                <h4 className="font-semibold flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Variações que serão criadas
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Total: <strong>{combinacoes.length}</strong> {combinacoes.length === 1 ? 'variação' : 'variações'}
                </p>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {combinacoes.map((comb, i) => {
                    const sufixo = comb.map(c => c.valor.toUpperCase()).join('-')
                    const sku = `${skuBase}-${sufixo}`
                    return (
                      <div key={i} className="p-3 bg-muted/50 rounded-lg border hover:border-primary/30 transition-colors">
                        <code className="text-sm font-mono font-bold text-primary">{sku}</code>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {comb.map((c, j) => (
                            <Badge key={j} variant="outline" className="text-xs">
                              {c.tipo}: {c.valor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={confirmarExclusao}
        title="Excluir variação"
        description="Tem certeza que deseja excluir esta variação? Esta ação não pode ser desfeita."
      />
    </div>
  )
}
