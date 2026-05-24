'use client'

import { useState, useEffect } from 'react'
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
import { Loader2 } from 'lucide-react'

interface BulkPesoCubagemModalProps {
  produtoIds: number[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (aplicados: number) => void
}

export function BulkPesoCubagemModal({ produtoIds, open, onOpenChange, onSuccess }: BulkPesoCubagemModalProps) {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)
  const [peso, setPeso] = useState<number | null>(null)
  const [cubagem, setCubagem] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      setPeso(null)
      setCubagem(null)
    }
  }, [open])

  const salvar = async () => {
    if (peso == null && cubagem == null) {
      toast({ variant: 'destructive', title: 'Informe pelo menos peso ou cubagem' })
      return
    }

    try {
      setSalvando(true)
      const res = await fetch('/api/produtos/bulk/peso-cubagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produtoIds, peso, cubagem }),
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
      toast({ variant: 'destructive', title: 'Erro ao aplicar' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar peso/cubagem padrão em lote</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Atualiza o <strong>peso e/ou cubagem padrão</strong> de <strong>{produtoIds.length}</strong> produto(s).
            Diferente das cubagens por transportadora — essa é a configuração padrão do próprio produto.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="bulk-peso-padrao">Peso (kg)</Label>
            <Input
              id="bulk-peso-padrao"
              type="number"
              step="0.0001"
              placeholder="Deixe vazio para não alterar"
              value={peso ?? ''}
              onChange={(e) => setPeso(e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>

          <div>
            <Label htmlFor="bulk-cubagem-padrao">Cubagem (m³)</Label>
            <Input
              id="bulk-cubagem-padrao"
              type="number"
              step="0.000001"
              placeholder="Deixe vazio para não alterar"
              value={cubagem ?? ''}
              onChange={(e) => setCubagem(e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Informe pelo menos um. Campos em branco mantêm o valor atual de cada produto.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || (peso == null && cubagem == null)}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aplicar em {produtoIds.length} produto(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
