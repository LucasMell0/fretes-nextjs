'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Package, Loader2, Copy, Check, AlertCircle, Plus, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react'

interface Canal {
  id: number
  nome: string
  slug: string
  tipo: 'MARKETPLACE' | 'ERP' | 'WEBHOOK'
  logoUrl: string | null
  endpointPattern: string
  metodosHttp: string[]
}

interface Integracao {
  id: number
  canalId: number
  token: string
  ativo: boolean
  status?: string
  configurado?: boolean
  ultimaRequisicao: string | null
  accessToken?: string | null
  refreshToken?: string | null
  tokenExpiresAt?: string | null
  criadoEm?: string
  totalRequisicoes: number
  canal: Canal
  _count: {
    logs: number
  }
}

export default function IntegracoesPage() {
  const { toast } = useToast()
  const [canais, setCanais] = useState<Canal[]>([])
  const [integracoes, setIntegracoes] = useState<Integracao[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [integracaoParaExcluir, setIntegracaoParaExcluir] = useState<number | null>(null)

  useEffect(() => {
    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const carregarDados = async () => {
    try {
      const [canaisRes, integracoesRes] = await Promise.all([
        fetch('/api/canais'),
        fetch('/api/usuarios/integracoes'),
      ])

      const canaisData = await canaisRes.json()
      const integracoesData = await integracoesRes.json()

      // Garantir que sejam arrays
      setCanais(Array.isArray(canaisData) ? canaisData : [])
      setIntegracoes(Array.isArray(integracoesData) ? integracoesData : [])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
      })
      // Garantir arrays vazios em caso de erro
      setCanais([])
      setIntegracoes([])
    } finally {
      setLoading(false)
    }
  }

  const ativarIntegracao = async (canalId: number, canal: Canal) => {
    try {
      const res = await fetch('/api/usuarios/integracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canalId }),
      })

      if (res.ok) {
        const data = await res.json()
        
        console.log('📝 Resposta da criação:', data)
        console.log('📝 Canal slug:', canal.slug)
        console.log('📝 Integração ID:', data.integracao?.id)
        
        // Se for Bling, redirecionar para OAuth
        if (canal.slug === 'erp-bling') {
          console.log('🔄 Redirecionando para OAuth do Bling...')
          console.log('🔗 URL OAuth:', `/api/auth/bling/authorize?integracaoId=${data.integracao.id}`)
          toast({ title: 'Redirecionando para autorização do Bling...' })
          window.location.href = `/api/auth/bling/authorize?integracaoId=${data.integracao.id}`
        } else {
          toast({ title: 'Integração ativada com sucesso!' })
          carregarDados()
        }
      } else {
        const error = await res.json()
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: error.erro,
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao ativar integração',
      })
    }
  }
  
  const toggleIntegracao = async (integracaoId: number, ativo: boolean) => {
    try {
      const res = await fetch(`/api/usuarios/integracoes/${integracaoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo }),
      })

      if (res.ok) {
        toast({ title: ativo ? 'Integração ativada' : 'Integração desativada' })
        carregarDados()
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao atualizar integração',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar integração',
      })
    }
  }

  const copiarEndpoint = (integracao: Integracao) => {
    const endpoint = window.location.origin + integracao.canal.endpointPattern.replace('{token}', integracao.token)
    navigator.clipboard.writeText(endpoint)
    setCopiedToken(integracao.token)
    toast({ title: 'Endpoint copiado!' })
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const canaisMarketplace = useMemo(
    () => canais.filter((c) => c.tipo === 'MARKETPLACE'),
    [canais]
  )

  const canaisERP = useMemo(
    () => canais.filter((c) => c.tipo === 'ERP'),
    [canais]
  )

  const getIntegracoesPorCanal = (canalId: number) => {
    return integracoes.filter((i) => i.canal.id === canalId)
  }

  const iniciarExclusao = (id: number) => {
    setIntegracaoParaExcluir(id)
    setConfirmDialogOpen(true)
  }

  const confirmarExclusao = async () => {
    if (!integracaoParaExcluir) return

    try {
      await fetch(`/api/usuarios/integracoes/${integracaoParaExcluir}`, { method: 'DELETE' })
      toast({ title: 'Integração removida!' })
      carregarDados()
    } catch (error) {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    } finally {
      setConfirmDialogOpen(false)
      setIntegracaoParaExcluir(null)
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
      <div className="mb-6">
        <h2 className="text-3xl font-bold">Integrações</h2>
        <p className="text-muted-foreground">
          Gerencie integrações com marketplaces e sistemas ERP
        </p>
      </div>

      <Tabs defaultValue="marketplaces" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="marketplaces">
            Marketplaces ({canaisMarketplace.length})
          </TabsTrigger>
          <TabsTrigger value="erp">
            ERP / Webhooks ({canaisERP.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="marketplaces" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {canaisMarketplace.map((canal) => {
              const integracoesCanal = getIntegracoesPorCanal(canal.id)
              return (
                <MultiIntegracaoCard
                  key={canal.id}
                  canal={canal}
                  integracoes={integracoesCanal}
                  onAtivar={() => ativarIntegracao(canal.id, canal)}
                  onToggle={(id, ativo) => toggleIntegracao(id, ativo)}
                  onDeletar={iniciarExclusao}
                  copiedToken={copiedToken}
                  onCopyEndpoint={copiarEndpoint}
                />
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="erp" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {canaisERP.map((canal) => {
              const integracoesCanal = getIntegracoesPorCanal(canal.id)

              // Tratamento especial para Bling (OAuth)
              if (canal.slug === 'erp-bling') {
                return (
                  <MultiIntegracaoCard
                    key={canal.id}
                    canal={canal}
                    integracoes={integracoesCanal}
                    onAtivar={() => {
                      window.location.href = '/api/auth/bling/authorize'
                    }}
                    onReconectar={(id: number) => {
                      window.location.href = `/api/auth/bling/authorize?integracaoId=${id}`
                    }}
                    onToggle={(id, ativo) => toggleIntegracao(id, ativo)}
                    onDeletar={iniciarExclusao}
                    copiedToken={copiedToken}
                    onCopyEndpoint={copiarEndpoint}
                    isOAuth={true}
                  />
                )
              }

              // Outros canais ERP (webhook padrão)
              return (
                <MultiIntegracaoCard
                  key={canal.id}
                  canal={canal}
                  integracoes={integracoesCanal}
                  onAtivar={() => ativarIntegracao(canal.id, canal)}
                  onToggle={(id, ativo) => toggleIntegracao(id, ativo)}
                  onDeletar={iniciarExclusao}
                  copiedToken={copiedToken}
                  onCopyEndpoint={copiarEndpoint}
                />
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={confirmarExclusao}
        title="Excluir integração"
        description="Tem certeza que deseja excluir esta integração? Esta ação não pode ser desfeita."
      />
    </div>
  )
}

// Componente genérico para múltiplas contas por canal
interface MultiIntegracaoCardProps {
  canal: Canal
  integracoes: Integracao[]
  onAtivar: () => void
  onReconectar?: (id: number) => void
  onToggle: (id: number, ativo: boolean) => void
  onDeletar: (id: number) => void
  copiedToken: string | null
  onCopyEndpoint: (integracao: Integracao) => void
  isOAuth?: boolean
}

function MultiIntegracaoCard({
  canal,
  integracoes,
  onAtivar,
  onReconectar,
  onToggle,
  onDeletar,
  copiedToken,
  onCopyEndpoint,
  isOAuth = false,
}: MultiIntegracaoCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              {canal.logoUrl ? (
                <Image src={canal.logoUrl} alt={canal.nome} width={32} height={32} className="h-8 w-8" />
              ) : (
                <span className="text-lg font-bold text-primary">
                  {canal.nome.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <CardTitle className="text-base">{canal.nome}</CardTitle>
              <CardDescription className="text-xs">
                {integracoes.length} conta{integracoes.length !== 1 ? 's' : ''} conectada{integracoes.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={onAtivar}>
            <Plus className="h-3 w-3 mr-1" />
            Nova Conta
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {integracoes.length === 0 ? (
          <div className="text-center py-6">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Nenhuma conta conectada
            </p>
            <Button onClick={onAtivar} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Conectar {canal.nome}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {integracoes.map((integracao) => (
              <div
                key={integracao.id}
                className="rounded-lg border p-3 space-y-3"
              >
                {/* Header da conta */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isOAuth ? (
                      integracao.accessToken ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          OAuth OK
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Sem OAuth
                        </Badge>
                      )
                    ) : (
                      <Badge variant={integracao.ativo ? "default" : "secondary"}>
                        {integracao.ativo ? 'Ativa' : 'Inativa'}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      #{integracao.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isOAuth && !integracao.accessToken && onReconectar && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onReconectar(integracao.id)}
                        className="h-7 px-2"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    )}
                    {!isOAuth && (
                      <Switch
                        checked={integracao.ativo}
                        onCheckedChange={(ativo) => onToggle(integracao.id, ativo)}
                      />
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeletar(integracao.id)}
                      className="h-7 px-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Endpoint */}
                {integracao.token && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Endpoint Estoque</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={`${window.location.origin}${canal.endpointPattern.replace('{token}', integracao.token)}`}
                        readOnly
                        className="font-mono text-xs h-8"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => onCopyEndpoint(integracao)}
                        className="h-8 w-8"
                      >
                        {copiedToken === integracao.token ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
