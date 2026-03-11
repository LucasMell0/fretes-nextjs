'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, ExternalLink } from 'lucide-react'

interface DialogConfigurarBlingProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  integracaoId: number
  onSucesso: () => void
}

export function DialogConfigurarBling({
  open,
  onOpenChange,
  integracaoId,
  onSucesso,
}: DialogConfigurarBlingProps) {
  const { toast } = useToast()
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSalvar = async () => {
    if (!apiKey.trim()) {
      toast({
        title: 'Erro',
        description: 'API Key é obrigatória',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/usuarios/integracoes/${integracaoId}/configurar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erro ao configurar integração')
      }

      toast({
        title: 'Sucesso!',
        description: 'Integração Bling configurada com sucesso',
      })

      setApiKey('')
      onOpenChange(false)
      onSucesso()
    } catch (error) {
      console.error('Erro:', error)
      toast({
        title: 'Erro ao configurar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configurar Integração Bling</DialogTitle>
          <DialogDescription>
            Configure sua API Key do Bling para ativar a integração
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key do Bling *</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Cole sua API Key aqui"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <p className="text-sm font-medium">Como obter sua API Key:</p>
            <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
              <li>Acesse o Bling e faça login</li>
              <li>Vá em <strong>Configurações → API</strong></li>
              <li>Clique em <strong>Gerar nova chave</strong></li>
              <li>Copie a chave gerada</li>
              <li>Cole aqui e salve</li>
            </ol>
            <a
              href="https://www.bling.com.br/configuracoes.api.php"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
            >
              Abrir configurações do Bling
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-xs text-yellow-800">
              <strong>⚠️ Importante:</strong> Sua API Key é armazenada de forma segura e 
              vinculada à sua conta. Mantenha-a confidencial e não compartilhe com terceiros.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar e Ativar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
