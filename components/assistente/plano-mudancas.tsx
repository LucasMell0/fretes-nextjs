'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { Loader2, Trash2, Pencil, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react'

// Operação tal como recebida do agente (formato livre por tipo).
// Mantemos como Record<string, unknown> aqui — schema rigoroso fica do lado servidor.
type OperacaoBruta = Record<string, unknown> & { tipo: string }

interface PlanoMudancasProps {
  conversaId: number
  operacoes: OperacaoBruta[]
  onAplicado: () => void
}

type Tipo = 'create' | 'update' | 'delete' | 'upsert'

function tipoCategoria(t: string): Tipo {
  if (t.startsWith('criar_')) return 'create'
  if (t.startsWith('editar_')) return 'update'
  if (t.startsWith('excluir_')) return 'delete'
  return 'upsert'
}

const RÓTULOS_TIPO: Record<string, string> = {
  criar_transportadora: 'Criar Transportadora',
  editar_transportadora: 'Editar Transportadora',
  excluir_transportadora: 'Excluir Transportadora',
  criar_regiao: 'Criar Região',
  editar_regiao: 'Editar Região',
  excluir_regiao: 'Excluir Região',
  criar_faixa_peso: 'Criar Faixa de Peso',
  editar_faixa_peso: 'Editar Faixa de Peso',
  excluir_faixa_peso: 'Excluir Faixa de Peso',
  definir_kg_adicional: 'Definir Kg Adicional',
  definir_taxas: 'Definir Taxas',
  editar_produto: 'Editar Produto',
}

// Campos editáveis por tipo (primitivos: string/number/boolean), nunca IDs nem dataAtualizacaoEsperada
const CAMPOS_EDITAVEIS: Record<string, string[]> = {
  criar_transportadora: ['nome', 'fatorCubagem', 'margemLucro'],
  editar_transportadora: ['nome', 'fatorCubagem', 'margemLucro', 'ativo'],
  criar_regiao: ['nome', 'cepInicio', 'cepFim'],
  editar_regiao: ['nome', 'cepInicio', 'cepFim', 'ativo'],
  criar_faixa_peso: ['pesoInicial', 'pesoFinal', 'valor', 'prazo'],
  editar_faixa_peso: ['pesoInicial', 'pesoFinal', 'valor', 'prazo'],
  definir_kg_adicional: ['valorKgAdicional'],
  definir_taxas: [],
  editar_produto: ['nome', 'peso', 'cubagem', 'ativo'],
}

export function PlanoMudancas({ conversaId, operacoes, onAplicado }: PlanoMudancasProps) {
  const { toast } = useToast()
  const [opsEstado, setOpsEstado] = useState(() =>
    operacoes.map((op, i) => ({ op: { ...op }, marcado: true, idx: i }))
  )
  const [confirmouDelete, setConfirmouDelete] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [resultado, setResultado] = useState<null | { sucesso: boolean; mensagem?: string }>(null)

  const totalDeletes = useMemo(
    () => operacoes.filter(o => tipoCategoria(o.tipo) === 'delete').length,
    [operacoes]
  )
  const temDelete = totalDeletes > 0
  const opsMarcadasParaAplicar = opsEstado.filter(o => o.marcado).map(o => o.op)
  const podeAplicar = opsMarcadasParaAplicar.length > 0 && (!temDelete || confirmouDelete) && !resultado

  const editarCampo = (idx: number, campo: string, valor: unknown) => {
    setOpsEstado(prev =>
      prev.map(o => (o.idx === idx ? { ...o, op: { ...o.op, [campo]: valor } } : o))
    )
  }

  const toggleMarcado = (idx: number) => {
    setOpsEstado(prev => prev.map(o => (o.idx === idx ? { ...o, marcado: !o.marcado } : o)))
  }

  const aplicar = async () => {
    setAplicando(true)
    try {
      const res = await fetch('/api/assistente/aplicar-plano', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversaId, operacoes: opsMarcadasParaAplicar }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResultado({ sucesso: false, mensagem: data.erro || 'Falha ao aplicar' })
        toast({ variant: 'destructive', title: 'Plano não aplicado', description: data.erro })
        return
      }
      setResultado({ sucesso: true, mensagem: `${data.aplicadas} operação(ões) aplicadas com sucesso` })
      toast({ title: 'Plano aplicado', description: `${data.aplicadas} mudança(s) salvas` })
      onAplicado()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido'
      setResultado({ sucesso: false, mensagem: msg })
      toast({ variant: 'destructive', title: 'Erro', description: msg })
    } finally {
      setAplicando(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card mt-2">
      <div className="p-3 border-b flex items-center gap-2">
        <span className="text-sm font-semibold">Plano de Mudanças</span>
        <Badge variant="secondary" className="text-xs">
          {opsEstado.length} operação(ões)
        </Badge>
        {temDelete && (
          <Badge variant="destructive" className="text-xs">
            {totalDeletes} exclusão(ões)
          </Badge>
        )}
      </div>

      <div className="divide-y">
        {opsEstado.map(({ op, marcado, idx }) => {
          const cat = tipoCategoria(op.tipo)
          const rotulo = RÓTULOS_TIPO[op.tipo] || op.tipo
          const campos = CAMPOS_EDITAVEIS[op.tipo] || []
          return (
            <div
              key={idx}
              className={cn(
                'p-3 flex gap-2',
                !marcado && 'opacity-50',
                cat === 'delete' && marcado && 'bg-destructive/5'
              )}
            >
              <Checkbox
                checked={marcado}
                onCheckedChange={() => toggleMarcado(idx)}
                disabled={!!resultado}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {cat === 'create' && <Plus className="h-3.5 w-3.5 text-green-600" />}
                  {cat === 'update' && <Pencil className="h-3.5 w-3.5 text-blue-600" />}
                  {cat === 'delete' && <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                  {cat === 'upsert' && <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />}
                  {rotulo}
                  {(op.id as number | undefined) && (
                    <Badge variant="outline" className="text-xs ml-auto font-mono">
                      #{String(op.id)}
                    </Badge>
                  )}
                </div>
                {campos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {campos.map((campo) => {
                      const v = op[campo]
                      if (v === undefined || v === null) return null
                      return (
                        <div key={campo} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground w-24 shrink-0">{campo}:</span>
                          {typeof v === 'boolean' ? (
                            <Checkbox
                              checked={v}
                              onCheckedChange={(c) => editarCampo(idx, campo, !!c)}
                              disabled={!!resultado || !marcado}
                            />
                          ) : typeof v === 'number' ? (
                            <Input
                              type="number"
                              step="any"
                              value={String(v)}
                              onChange={(e) => editarCampo(idx, campo, parseFloat(e.target.value) || 0)}
                              disabled={!!resultado || !marcado}
                              className="h-6 px-1.5 text-xs"
                            />
                          ) : (
                            <Input
                              value={String(v)}
                              onChange={(e) => editarCampo(idx, campo, e.target.value)}
                              disabled={!!resultado || !marcado}
                              className="h-6 px-1.5 text-xs"
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground font-mono">
                    {JSON.stringify(op).slice(0, 300)}
                    {JSON.stringify(op).length > 300 && '…'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-3 border-t bg-muted/30 space-y-2">
        {temDelete && (
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <Checkbox
              checked={confirmouDelete}
              onCheckedChange={(c) => setConfirmouDelete(!!c)}
              disabled={!!resultado}
              className="mt-0.5"
            />
            <div className="flex items-center gap-1.5 text-destructive font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Confirmo a exclusão de {totalDeletes} registro(s)
            </div>
          </label>
        )}
        {resultado && (
          <div className={cn(
            'text-xs rounded-md px-2 py-1.5',
            resultado.sucesso ? 'bg-green-500/10 text-green-700' : 'bg-destructive/10 text-destructive'
          )}>
            {resultado.mensagem}
          </div>
        )}
        <div className="flex justify-end">
          <Button
            onClick={aplicar}
            disabled={!podeAplicar || aplicando}
            size="sm"
          >
            {aplicando ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Aplicando…
              </>
            ) : resultado?.sucesso ? (
              'Aplicado'
            ) : (
              `Aplicar ${opsMarcadasParaAplicar.length > 0 ? `(${opsMarcadasParaAplicar.length})` : 'tudo'}`
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
