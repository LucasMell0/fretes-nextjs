'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Copy, Check } from 'lucide-react'

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
  status: string
  ultimaRequisicao: string | null
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

  useEffect(() => {
    carregarDados()
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

  const ativarIntegracao = async (canalId: number) => {
    try {
      const res = await fetch('/api/usuarios/integracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canalId }),
      })

      if (res.ok) {
        toast({ title: 'Integração ativada com sucesso!' })
        carregarDados()
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

  const copiarToken = (token: string) => {
    navigator.clipboard.writeText(token)
    setCopiedToken(token)
    toast({ title: 'Token copiado!' })
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

  const getIntegracao = (canalId: number) => {
    return integracoes.find((i) => i.canalId === canalId)
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
              const integracao = getIntegracao(canal.id)
              return (
                <IntegracaoCard
                  key={canal.id}
                  canal={canal}
                  integracao={integracao}
                  onAtivar={() => ativarIntegracao(canal.id)}
                  onToggle={(ativo) => toggleIntegracao(integracao!.id, ativo)}
                  onCopyEndpoint={() => copiarEndpoint(integracao!)}
                  onCopyToken={() => copiarToken(integracao!.token)}
                  copiedToken={copiedToken}
                />
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="erp" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {canaisERP.map((canal) => {
              const integracao = getIntegracao(canal.id)
              return (
                <IntegracaoCard
                  key={canal.id}
                  canal={canal}
                  integracao={integracao}
                  onAtivar={() => ativarIntegracao(canal.id)}
                  onToggle={(ativo) => toggleIntegracao(integracao!.id, ativo)}
                  onCopyEndpoint={() => copiarEndpoint(integracao!)}
                  onCopyToken={() => copiarToken(integracao!.token)}
                  copiedToken={copiedToken}
                />
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface IntegracaoCardProps {
  canal: Canal
  integracao?: Integracao
  onAtivar: () => void
  onToggle: (ativo: boolean) => void
  onCopyEndpoint: () => void
  onCopyToken: () => void
  copiedToken: string | null
}

function IntegracaoCard({
  canal,
  integracao,
  onAtivar,
  onToggle,
  onCopyEndpoint,
  onCopyToken,
  copiedToken,
}: IntegracaoCardProps) {
  const endpointCompleto = integracao
    ? `${window.location.origin}${canal.endpointPattern.replace('{token}', integracao.token)}`
    : canal.endpointPattern

  const formatarData = (data: string | null) => {
    if (!data) return 'Nunca'
    const diff = Date.now() - new Date(data).getTime()
    const minutos = Math.floor(diff / 60000)
    if (minutos < 1) return 'Agora'
    if (minutos < 60) return `há ${minutos} min`
    const horas = Math.floor(minutos / 60)
    if (horas < 24) return `há ${horas}h`
    return `há ${Math.floor(horas / 24)} dias`
  }

  return (
    <Card className={integracao?.ativo ? 'border-primary' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              {canal.logoUrl ? (
                <img src={canal.logoUrl} alt={canal.nome} className="h-8 w-8" />
              ) : (
                <span className="text-lg font-bold text-primary">
                  {canal.nome.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <CardTitle className="text-base">{canal.nome}</CardTitle>
              <CardDescription className="text-xs">
                {canal.tipo === 'MARKETPLACE' ? 'Canal de Venda' : 'Webhook ERP'}
              </CardDescription>
            </div>
          </div>
          {integracao && (
            <Switch
              checked={integracao.ativo}
              onCheckedChange={onToggle}
            />
          )}
        </div>
      </CardHeader>

      <CardContent>
        {integracao ? (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Endpoint</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={endpointCompleto}
                  readOnly
                  className="font-mono text-xs h-9"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={onCopyEndpoint}
                  className="h-9 w-9"
                >
                  {copiedToken === integracao.token ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button onClick={onAtivar} className="w-full">
            Ativar Integração
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
