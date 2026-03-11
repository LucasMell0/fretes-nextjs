'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Calculator, Loader2, Package, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'

interface ProdutoDB {
  id: number
  nome: string
  sku: string
  peso: number
  cubagem: number
  ativo: boolean
  produtoPai?: {
    id: number
    nome: string
    peso: number
    cubagem: number
    usarDadosPaiParaVariacoes: boolean
  }
}

interface ProdutoSelecionado {
  sku: string
  quantidade: number
  valor: number
}

interface ResultadoCotacao {
  transportadora_id: number
  transportadora_nome: string
  valor_frete: number
  prazo_entrega: number
  peso_real: number
  peso_cubado: number
  peso_taxado: number
  peso_final: number
  detalhes: {
    valor_base: number
    valor_kg_adicional: number
    valor_taxas: number
    valor_icms: number
    faixa_utilizada: string
    taxas_aplicadas: Array<{
      nome: string
      tipo: string
      valor: number
      valor_calculado: number
    }>
  }
}

export default function CotacaoPage() {
  const { toast } = useToast()
  const [cep, setCep] = useState('')
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<ProdutoDB[]>([])
  const [produtosSelecionados, setProdutosSelecionados] = useState<Map<string, { quantidade: number; valor: number }>>(new Map())
  const [loading, setLoading] = useState(false)
  const [loadingProdutos, setLoadingProdutos] = useState(true)
  const [resultados, setResultados] = useState<ResultadoCotacao[]>([])
  const [busca, setBusca] = useState('')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const itensPorPagina = 10

  useEffect(() => {
    carregarProdutos()
  }, [])

  const carregarProdutos = async () => {
    try {
      const res = await fetch('/api/produtos')
      const data = await res.json()
      
      // Filtrar produtos ativos
      const produtosAtivos = data.filter((p: any) => p.ativo)
      
      // Encontrar IDs de produtos pai que têm variações
      const produtosPaiComVariacoes = new Set(
        produtosAtivos
          .filter((p: any) => p.produtoPaiId !== null)
          .map((p: any) => p.produtoPaiId)
      )
      
      // Exibir apenas:
      // 1. Produtos que SÃO variações (produtoPaiId !== null)
      // 2. Produtos pai que NÃO têm variações
      const produtosFiltrados = produtosAtivos.filter((p: any) => {
        // Se é variação, exibe
        if (p.produtoPaiId !== null) return true
        
        // Se é produto pai SEM variações, exibe
        if (!produtosPaiComVariacoes.has(p.id)) return true
        
        // Se é produto pai COM variações, NÃO exibe
        return false
      })
      
      setProdutosDisponiveis(produtosFiltrados)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar produtos',
      })
    } finally {
      setLoadingProdutos(false)
    }
  }

  const toggleProduto = useCallback((sku: string) => {
    setProdutosSelecionados(prev => {
      const novaSeleção = new Map(prev)
      if (novaSeleção.has(sku)) {
        novaSeleção.delete(sku)
      } else {
        novaSeleção.set(sku, { quantidade: 1, valor: 0 })
      }
      return novaSeleção
    })
  }, [])

  const atualizarQuantidade = useCallback((sku: string, quantidade: number) => {
    setProdutosSelecionados(prev => {
      const novaSeleção = new Map(prev)
      const atual = novaSeleção.get(sku)
      if (quantidade > 0 && atual) {
        novaSeleção.set(sku, { ...atual, quantidade })
      }
      return novaSeleção
    })
  }, [])

  const atualizarValor = useCallback((sku: string, valor: number) => {
    setProdutosSelecionados(prev => {
      const novaSeleção = new Map(prev)
      const atual = novaSeleção.get(sku)
      if (atual) {
        novaSeleção.set(sku, { ...atual, valor })
      }
      return novaSeleção
    })
  }, [])

  const formatarCep = (valor: string) => {
    const numeros = valor.replace(/\D/g, '')
    if (numeros.length <= 5) {
      return numeros
    }
    return `${numeros.slice(0, 5)}-${numeros.slice(5, 8)}`
  }

  const obterDadosExibicao = useCallback((produto: ProdutoDB) => {
    const usarDadosPai = produto.produtoPai && produto.produtoPai.usarDadosPaiParaVariacoes
    return {
      peso: usarDadosPai && produto.produtoPai ? produto.produtoPai.peso : produto.peso,
      cubagem: usarDadosPai && produto.produtoPai ? produto.produtoPai.cubagem : produto.cubagem,
      usandoDadosPai: usarDadosPai || false
    }
  }, [])

  // Filtrar produtos por busca
  const produtosFiltrados = useMemo(() => {
    if (!busca.trim()) return produtosDisponiveis
    
    const termo = busca.toLowerCase()
    return produtosDisponiveis.filter(p => 
      p.nome.toLowerCase().includes(termo) ||
      p.sku.toLowerCase().includes(termo)
    )
  }, [produtosDisponiveis, busca])

  // Paginação
  const totalPaginas = Math.ceil(produtosFiltrados.length / itensPorPagina)
  const produtosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina
    const fim = inicio + itensPorPagina
    return produtosFiltrados.slice(inicio, fim)
  }, [produtosFiltrados, paginaAtual, itensPorPagina])

  // Reset página ao buscar
  useEffect(() => {
    setPaginaAtual(1)
  }, [busca])

  const realizarCotacao = async () => {
    if (!cep) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Informe o CEP de destino',
      })
      return
    }

    if (produtosSelecionados.size === 0) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Selecione pelo menos um produto',
      })
      return
    }

    setLoading(true)
    setResultados([])

    const produtos = Array.from(produtosSelecionados.entries()).map(([sku, { quantidade, valor }]) => ({
      sku,
      quantidade,
      valor,
    }))

    try {
      const response = await fetch('/api/cotacoes/cotar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cep,
          produtos,
          origem: 'MANUAL',
        }),
      })

      const data = await response.json()

      if (data.sucesso) {
        setResultados(data.cotacoes)
        toast({
          title: 'Cotação realizada!',
          description: `${data.total_transportadoras} transportadora(s) encontrada(s)`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro na cotação',
          description: data.mensagem || 'Erro desconhecido',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao realizar cotação',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold">Cotação de Frete</h2>
        <p className="text-muted-foreground">Simule fretes para seus produtos</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados da Cotação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cep">CEP de Destino</Label>
              <Input
                id="cep"
                placeholder="00000-000"
                value={cep}
                onChange={(e) => setCep(formatarCep(e.target.value))}
                maxLength={9}
              />
            </div>

            <div className="space-y-2">
              <Label>Produtos</Label>
              
              {/* Campo de busca */}
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou SKU..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-8"
                />
              </div>
              
              {loadingProdutos ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : produtosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="mx-auto h-12 w-12 mb-2 text-muted-foreground" />
                  <p>{busca ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <div className="text-xs text-muted-foreground p-2 border-b bg-muted/50 flex items-center justify-between">
                    <span>{produtosFiltrados.length} produto(s) {busca && `encontrado(s)`}</span>
                    {totalPaginas > 1 && (
                      <span>Página {paginaAtual} de {totalPaginas}</span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {produtosPaginados.map((produto) => {
                    const dadosExibicao = obterDadosExibicao(produto)
                    return (
                      <div
                        key={produto.sku}
                        className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-accent/50"
                      >
                        <Checkbox
                          id={`produto-${produto.sku}`}
                          checked={produtosSelecionados.has(produto.sku)}
                          onCheckedChange={() => toggleProduto(produto.sku)}
                        />
                        <label
                          htmlFor={`produto-${produto.sku}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium">{produto.nome}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                            <span>SKU: {produto.sku}</span>
                            <span>|</span>
                            <span className="flex items-center gap-1">
                              {Number(dadosExibicao.peso).toFixed(2)} kg
                              {dadosExibicao.usandoDadosPai && (
                                <Badge variant="outline" className="text-xs px-1 py-0 h-3">
                                  Pai
                                </Badge>
                              )}
                            </span>
                            <span>|</span>
                            <span className="flex items-center gap-1">
                              {Number(dadosExibicao.cubagem).toFixed(4)} m³
                              {dadosExibicao.usandoDadosPai && (
                                <Badge variant="outline" className="text-xs px-1 py-0 h-3">
                                  Pai
                                </Badge>
                              )}
                            </span>
                          </div>
                      </label>
                      {produtosSelecionados.has(produto.sku) && (
                        <div className="flex gap-2">
                          <div className="w-20">
                            <Input
                              type="number"
                              min="1"
                              value={produtosSelecionados.get(produto.sku)?.quantidade || 1}
                              onChange={(e) =>
                                atualizarQuantidade(produto.sku, parseInt(e.target.value) || 1)
                              }
                              className="h-8 text-sm"
                              placeholder="Qtd"
                            />
                          </div>
                          <div className="w-28">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={produtosSelecionados.get(produto.sku)?.valor || 0}
                              onChange={(e) =>
                                atualizarValor(produto.sku, parseFloat(e.target.value) || 0)
                              }
                              className="h-8 text-sm"
                              placeholder="R$ Valor"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    )
                  })}
                  </div>
                  
                  {/* Paginação */}
                  {totalPaginas > 1 && (
                    <div className="flex items-center justify-between p-2 border-t bg-muted/30">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                        disabled={paginaAtual === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Anterior
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {paginaAtual} / {totalPaginas}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                        disabled={paginaAtual === totalPaginas}
                      >
                        Próxima
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
              
              {produtosSelecionados.size > 0 && (
                <div className="text-sm text-muted-foreground mt-2">
                  {produtosSelecionados.size} produto(s) selecionado(s)
                </div>
              )}
            </div>

            <Button
              className="w-full"
              onClick={realizarCotacao}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculando...
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Calcular Frete
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
          </CardHeader>
          <CardContent>
            {resultados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma cotação realizada ainda
              </div>
            ) : (
              <div className="space-y-4">
                {resultados.map((resultado, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border p-4 ${
                      index === 0 ? 'border-primary bg-primary/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{resultado.transportadora_nome}</h3>
                        {index === 0 && (
                          <span className="text-xs text-primary font-medium">
                            Melhor Opção
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          R$ {resultado.valor_frete.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {resultado.prazo_entrega} dias úteis
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm mt-4 pt-4 border-t">
                      <div>
                        <span className="text-muted-foreground">Peso Real:</span>
                        <span className="ml-2 font-medium">{resultado.peso_real.toFixed(2)} kg</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Peso Cubado:</span>
                        <span className="ml-2 font-medium">{resultado.peso_cubado.toFixed(2)} kg</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Peso Taxado:</span>
                        <span className="ml-2 font-medium">{resultado.peso_taxado.toFixed(2)} kg</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Peso Final:</span>
                        <span className="ml-2 font-medium">{resultado.peso_final.toFixed(2)} kg</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor Base:</span>
                        <span>R$ {resultado.detalhes.valor_base.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Kg Adicional:</span>
                        <span>R$ {resultado.detalhes.valor_kg_adicional.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Taxas:</span>
                        <span>R$ {resultado.detalhes.valor_taxas.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ICMS:</span>
                        <span>R$ {resultado.detalhes.valor_icms.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-base pt-2 border-t">
                        <span>Total:</span>
                        <span className="text-primary">R$ {resultado.valor_frete.toFixed(2)}</span>
                      </div>
                    </div>

                    {resultado.detalhes.taxas_aplicadas.length > 0 && (
                      <details className="mt-4 pt-4 border-t">
                        <summary className="cursor-pointer text-sm font-medium text-foreground">
                          Ver detalhes das taxas
                        </summary>
                        <div className="mt-2 space-y-1 text-sm">
                          {resultado.detalhes.taxas_aplicadas.map((taxa, i) => (
                            <div key={i} className="flex justify-between text-muted-foreground">
                              <span>{taxa.nome}:</span>
                              <span>R$ {taxa.valor_calculado.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
