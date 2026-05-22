'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface Transportadora {
  id: number
  nome: string
}

interface BulkCubagensModalProps {
  produtoIds: number[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (aplicados: number) => void
}

export function BulkCubagensModal({ produtoIds, open, onOpenChange, onSuccess }: BulkCubagensModalProps) {
  const { toast } = useToast()
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([])
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [formData, setFormData] = useState({
    transportadoraId: 0,
    cubagem: null as number | null,
    peso: null as number | null,
  })

  const carregarTransportadoras = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/transportadoras')
      const data = await res.json()
      const ativas = (Array.isArray(data) ? data : []).filter((t: { ativo: boolean }) => t.ativo)
      setTransportadoras(ativas)
      setFormData(fd => ({
        ...fd,
        transportadoraId: ativas.length > 0 ? ativas[0].id : 0,
      }))
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao carregar transportadoras' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (open) {
      carregarTransportadoras()
      setFormData({ transportadoraId: 0, cubagem: null, peso: null })
    }
  }, [open, carregarTransportadoras])

  const salvar = async () => {
    if (formData.transportadoraId === 0) {
      toast({ variant: 'destructive', title: 'Selecione uma transportadora' })
      return
    }
    if (formData.cubagem == null && formData.peso == null) {
      toast({ variant: 'destructive', title: 'Informe pelo menos peso ou cubagem' })
      return
    }

    try {
      setSalvando(true)
      const res = await fetch('/api/produtos/bulk/cubagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produtoIds,
          transportadoraId: formData.transportadoraId,
          peso: formData.peso,
          cubagem: formData.cubagem,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erro', description: data.erro || 'Falha ao aplicar' })
        return
      }

      toast({
        title: 'Aplicado com sucesso',
        description: `${data.aplicados} produto(s) atualizado(s)${data.ignorados ? ` · ${data.ignorados} ignorado(s)` : ''}.`,
      })
      onOpenChange(false)
      onSuccess?.(data.aplicados)
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao aplicar cubagens em lote' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar peso/cubagem em lote</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Aplica em <strong>{produtoIds.length}</strong> produto(s) selecionado(s) para a transportadora escolhida.
            Se já existir configuração, será sobrescrita.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-transportadora">Transportadora</Label>
              <Select
                value={formData.transportadoraId.toString()}
                onValueChange={(value) => setFormData({ ...formData, transportadoraId: parseInt(value) })}
              >
                <SelectTrigger id="bulk-transportadora" className="mt-1">
                  <SelectValue placeholder="Selecione uma transportadora" />
                </SelectTrigger>
                <SelectContent>
                  {transportadoras.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="bulk-peso">Peso (kg)</Label>
              <Input
                id="bulk-peso"
                type="number"
                step="0.0001"
                placeholder="Deixe vazio para não alterar peso"
                value={formData.peso ?? ''}
                onChange={(e) => setFormData({ ...formData, peso: e.target.value ? parseFloat(e.target.value) : null })}
              />
            </div>

            <div>
              <Label htmlFor="bulk-cubagem">Cubagem (m³)</Label>
              <Input
                id="bulk-cubagem"
                type="number"
                step="0.000001"
                placeholder="Deixe vazio para não alterar cubagem"
                value={formData.cubagem ?? ''}
                onChange={(e) => setFormData({ ...formData, cubagem: e.target.value ? parseFloat(e.target.value) : null })}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Informe pelo menos um dos dois. Valores em branco mantêm o padrão do produto.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || loading}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aplicar em {produtoIds.length} produto(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
