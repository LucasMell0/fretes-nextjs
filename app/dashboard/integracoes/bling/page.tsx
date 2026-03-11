'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Download, CheckCircle2, XCircle, AlertCircle, Package, Plus, Trash2, RefreshCw } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface ResultadoImportacao {
  importados: number
  atualizados: number
  erros: number
  detalhes: Array<{
    sku: string
    status: string
    mensagem?: string
  }>
}

export default function BlingImportacaoPage() {
  const [criterio, setCriterio] = useState('2') // Ativos
  const [tipo, setTipo] = useState('P') // Produtos
  const [limite, setLimite] = useState('100')
  const [loading, setLoading] = useState(false)
  const [loadingIntegracao, setLoadingIntegracao] = useState(true)
  const [integracoesBling, setIntegracoesBling] = useState<any[]>([])
  const [integracaoBling, setIntegracaoBling] = useState<any>(null)
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)
  const { toast } = useToast()

  // Carregar integração Bling ativa
  useEffect(() => {
    buscarIntegracaoBling()
  }, [])

  const buscarIntegracaoBling = async () => {
    try {
      const response = await fetch('/api/usuarios/integracoes')
      if (response.ok) {
        const data = await response.json()
        // Buscar TODAS as integrações Bling (pode ter múltiplas contas)
        const blings = data.filter((i: any) => i.canal.slug === 'erp-bling')
        setIntegracoesBling(blings)
        
        // Selecionar a primeira com OAuth como padrão
        const blingComOAuth = blings.find((b: any) => b.accessToken)
        setIntegracaoBling(blingComOAuth || blings[0] || null)
      }
    } catch (error) {
      console.error('Erro ao buscar integração Bling:', error)
    } finally {
      setLoadingIntegracao(false)
    }
  }

  const handleConectarNovaConta = () => {
    // Redirecionar para criar nova integração e depois OAuth
    window.location.href = '/api/auth/bling/authorize'
  }

  const handleReconectar = async (integracaoId: number) => {
    // Redirecionar para OAuth desta integração específica
    window.location.href = `/api/auth/bling/authorize?integracaoId=${integracaoId}`
  }

  const handleDeletar = async (integracaoId: number) => {
    if (!confirm('Tem certeza que deseja remover esta conta do Bling?')) return

    try {
      const response = await fetch(`/api/usuarios/integracoes/${integracaoId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({ title: 'Conta removida com sucesso!' })
        buscarIntegracaoBling()
      } else {
        throw new Error('Erro ao deletar conta')
      }
    } catch (error) {
      toast({
        title: 'Erro ao deletar conta',
        variant: 'destructive',
      })
    }
  }

  const handleImportar = async () => {
    if (!integracaoBling) {
      toast({
        title: 'Erro',
        description: 'Integração Bling não encontrada',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setResultado(null)

    try {
      const response = await fetch('/api/bling/importar-produtos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integracaoId: integracaoBling.id,
          criterio: parseInt(criterio),
          tipo,
          limite: parseInt(limite),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erro ao importar produtos')
      }

      const data = await response.json()
      setResultado(data)

      toast({
        title: 'Importação concluída!',
        description: `${data.importados} produtos importados, ${data.atualizados} atualizados`,
      })
    } catch (error) {
      console.error('Erro:', error)
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integração Bling ERP</h1>
        <p className="text-muted-foreground">
          Importe produtos do Bling e sincronize estoques automaticamente
        </p>
      </div>

      {/* Contas Ativas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contas Ativas</CardTitle>
              <CardDescription>
                Gerencie suas contas conectadas do Bling
              </CardDescription>
            </div>
            <Button onClick={handleConectarNovaConta} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Conectar Nova Conta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingIntegracao ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : integracoesBling.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma conta do Bling conectada
              </p>
              <Button onClick={handleConectarNovaConta} className="mt-4" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Conectar Primeira Conta
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {integracoesBling.map((integracao) => (
                <div
                  key={integracao.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        {integracao.accessToken ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Conectada
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Sem OAuth
                          </Badge>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          Conta #{integracao.id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {integracao.accessToken && integracao.tokenExpiresAt
                            ? `Expira: ${new Date(integracao.tokenExpiresAt).toLocaleDateString()}`
                            : 'Criada em: ' + new Date(integracao.criadoEm).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!integracao.accessToken && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReconectar(integracao.id)}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Conectar OAuth
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeletar(integracao.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Importação Manual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Importar Produtos
            </CardTitle>
            <CardDescription>
              Importe produtos do Bling para o sistema de fretes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status da Integração */}
            {integracaoBling && integracaoBling.accessToken && (
              <div className="rounded-lg border bg-green-50 border-green-200 p-3">
                <p className="text-sm font-medium text-green-800">
                  ✅ Integração Bling conectada
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Conta Bling autorizada via OAuth2
                </p>
              </div>
            )}

            {integracaoBling && !integracaoBling.accessToken && (
              <div className="rounded-lg border bg-yellow-50 border-yellow-200 p-3">
                <p className="text-sm font-medium text-yellow-800">
                  ⚠️ Integração não configurada
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Conecte sua conta do Bling em Integrações
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="criterio">Critério de Listagem</Label>
              <Select value={criterio} onValueChange={setCriterio} disabled={loading}>
                <SelectTrigger id="criterio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Últimos incluídos</SelectItem>
                  <SelectItem value="2">Ativos</SelectItem>
                  <SelectItem value="3">Inativos</SelectItem>
                  <SelectItem value="4">Excluídos</SelectItem>
                  <SelectItem value="5">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Produto</Label>
              <Select value={tipo} onValueChange={setTipo} disabled={loading}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="T">Todos</SelectItem>
                  <SelectItem value="P">Produtos</SelectItem>
                  <SelectItem value="S">Serviços</SelectItem>
                  <SelectItem value="E">Composições</SelectItem>
                  <SelectItem value="PS">Produtos simples</SelectItem>
                  <SelectItem value="C">Com variações</SelectItem>
                  <SelectItem value="V">Variações</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limite">Produtos por Página</Label>
              <Input
                id="limite"
                type="number"
                min="1"
                max="100"
                value={limite}
                onChange={(e) => setLimite(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button
              onClick={handleImportar}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Importar Produtos
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Webhook de Estoque */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Webhook de Estoque
            </CardTitle>
            <CardDescription>
              Configure o Bling para enviar atualizações de estoque automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <p className="text-sm font-medium">URL do Webhook:</p>
              <code className="block text-xs bg-background p-2 rounded border">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/api/v1/erp-bling/webhook/{SEU_TOKEN}`
                  : '/api/v1/erp-bling/webhook/{SEU_TOKEN}'}
              </code>
              <p className="text-xs text-muted-foreground">
                Substitua {'{SEU_TOKEN}'} pelo token gerado na página de Integrações
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Eventos suportados:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Estoque criado</li>
                <li>• Estoque atualizado</li>
                <li>• Estoque deletado</li>
                <li>• Estoque virtual atualizado</li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                <strong>Como configurar no Bling:</strong>
                <br />
                1. Acesse Configurações → Webhooks
                <br />
                2. Clique em "Novo Webhook"
                <br />
                3. Selecione o evento "Estoque"
                <br />
                4. Cole a URL acima
                <br />
                5. Ative o webhook
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resultado da Importação */}
      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da Importação</CardTitle>
            <CardDescription>
              Resumo dos produtos importados do Bling
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Estatísticas */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{resultado.importados}</p>
                  <p className="text-xs text-muted-foreground">Importados</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{resultado.atualizados}</p>
                  <p className="text-xs text-muted-foreground">Atualizados</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{resultado.erros}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>
            </div>

            {/* Detalhes */}
            {resultado.detalhes && resultado.detalhes.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Detalhes</h3>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Mensagem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultado.detalhes.slice(0, 50).map((detalhe, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">
                            {detalhe.sku}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                detalhe.status === 'importado'
                                  ? 'default'
                                  : detalhe.status === 'atualizado'
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {detalhe.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {detalhe.mensagem}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {resultado.detalhes.length > 50 && (
                    <div className="p-3 border-t text-center text-sm text-muted-foreground">
                      Mostrando 50 de {resultado.detalhes.length} registros
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
