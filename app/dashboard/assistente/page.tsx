'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Sparkles, Pencil, Trash2, MessageSquare, Loader2, Wrench, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ChatView } from '@/components/assistente/chat-view'
import { IndicadorCota, type IndicadorCotaRef } from '@/components/assistente/indicador-cota'

type Agente = 'ESCRITA' | 'CONSULTA'

interface Conversa {
  id: number
  agente: Agente
  titulo: string
  dataCriacao: string
  dataAtualizacao: string
}

const TEMPLATES: Record<Agente, { titulo: string; prompt: string }[]> = {
  ESCRITA: [
    { titulo: 'Criar uma nova região', prompt: 'Quero criar uma nova região chamada "" cobrindo os CEPs de  até , com faixas de peso de 0–10kg, 10–30kg e 30–100kg.' },
    { titulo: 'Copiar config de transportadora', prompt: 'Copie todas as regiões e taxas da transportadora "" para a transportadora "".' },
    { titulo: 'Ajustar uma taxa em massa', prompt: 'Ajuste o GRIS de todas as regiões da transportadora "" para 0.5%.' },
    { titulo: 'Cadastrar faixas de peso', prompt: 'Para a região "" da transportadora "", crie estas faixas de peso: 0-10kg R$ 20 prazo 3; 10-30kg R$ 35 prazo 4; 30-100kg R$ 60 prazo 5.' },
  ],
  CONSULTA: [
    { titulo: 'Cotar frete', prompt: 'Quanto custa o frete de 2 unidades do produto "" para a cidade  ()?' },
    { titulo: 'Diagnosticar transportadora', prompt: 'Por que a transportadora "" não está aparecendo nas cotações para o CEP ?' },
    { titulo: 'Analytics histórico', prompt: 'Quantas cotações foram feitas este mês? Quais SKUs foram mais cotados?' },
    { titulo: 'Auditar configuração', prompt: 'Confira as faixas de peso da transportadora "": tem gaps? sobreposições? algo estranho?' },
  ],
}

export default function AssistentePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [conversas, setConversas] = useState<Conversa[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [criando, setCriando] = useState<Agente | null>(null)
  const [conversaAtivaId, setConversaAtivaId] = useState<number | null>(
    searchParams.get('conversa') ? Number(searchParams.get('conversa')) : null
  )
  const [confirmExcluirId, setConfirmExcluirId] = useState<number | null>(null)
  const [renomeandoId, setRenomeandoId] = useState<number | null>(null)
  const [renomearValor, setRenomearValor] = useState('')
  const indicadorCotaRef = useRef<IndicadorCotaRef>(null)

  const carregarConversas = useCallback(async () => {
    try {
      const res = await fetch('/api/assistente/conversas')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setConversas(data)
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao carregar conversas' })
    } finally {
      setLoadingLista(false)
    }
  }, [toast])

  useEffect(() => {
    carregarConversas()
  }, [carregarConversas])

  const criarConversa = async (agente: Agente) => {
    try {
      setCriando(agente)
      const res = await fetch('/api/assistente/conversas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agente }),
      })
      if (!res.ok) throw new Error()
      const conversa: Conversa = await res.json()
      setConversas([conversa, ...conversas])
      setConversaAtivaId(conversa.id)
      router.replace(`/dashboard/assistente?conversa=${conversa.id}`)
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao criar conversa' })
    } finally {
      setCriando(null)
    }
  }

  const excluirConversa = async () => {
    if (!confirmExcluirId) return
    try {
      const res = await fetch(`/api/assistente/conversas/${confirmExcluirId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setConversas(conversas.filter(c => c.id !== confirmExcluirId))
      if (conversaAtivaId === confirmExcluirId) {
        setConversaAtivaId(null)
        router.replace('/dashboard/assistente')
      }
      toast({ title: 'Conversa excluída' })
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao excluir' })
    } finally {
      setConfirmExcluirId(null)
    }
  }

  const renomearConversa = async (id: number) => {
    const titulo = renomearValor.trim()
    if (!titulo) {
      setRenomeandoId(null)
      return
    }
    try {
      const res = await fetch(`/api/assistente/conversas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo }),
      })
      if (!res.ok) throw new Error()
      setConversas(conversas.map(c => (c.id === id ? { ...c, titulo } : c)))
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao renomear' })
    } finally {
      setRenomeandoId(null)
    }
  }

  const conversaAtiva = conversas.find(c => c.id === conversaAtivaId) || null
  const conversasEscrita = conversas.filter(c => c.agente === 'ESCRITA')
  const conversasConsulta = conversas.filter(c => c.agente === 'CONSULTA')

  return (
    <div className="flex h-full -m-4 min-h-0 overflow-hidden">
      {/* Sidebar de conversas */}
      <aside className="w-72 border-r flex flex-col min-h-0">
        <div className="p-3 border-b space-y-2">
          <Button
            onClick={() => criarConversa('ESCRITA')}
            disabled={criando !== null}
            variant="default"
            className="w-full justify-start"
          >
            {criando === 'ESCRITA' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wrench className="mr-2 h-4 w-4" />
            )}
            Nova conversa de Escrita
          </Button>
          <Button
            onClick={() => criarConversa('CONSULTA')}
            disabled={criando !== null}
            variant="outline"
            className="w-full justify-start"
          >
            {criando === 'CONSULTA' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Nova conversa de Consulta
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {loadingLista ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : conversas.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8 px-4">
              Você ainda não tem conversas. Crie uma para começar.
            </div>
          ) : (
            <>
              {conversasEscrita.length > 0 && (
                <ListaConversas
                  label="Escrita"
                  conversas={conversasEscrita}
                  conversaAtivaId={conversaAtivaId}
                  renomeandoId={renomeandoId}
                  renomearValor={renomearValor}
                  onSelecionar={(id) => {
                    setConversaAtivaId(id)
                    router.replace(`/dashboard/assistente?conversa=${id}`)
                  }}
                  onRenomearInicio={(c) => {
                    setRenomeandoId(c.id)
                    setRenomearValor(c.titulo)
                  }}
                  onRenomearChange={setRenomearValor}
                  onRenomearConfirmar={renomearConversa}
                  onExcluir={(id) => setConfirmExcluirId(id)}
                />
              )}
              {conversasConsulta.length > 0 && (
                <ListaConversas
                  label="Consulta"
                  conversas={conversasConsulta}
                  conversaAtivaId={conversaAtivaId}
                  renomeandoId={renomeandoId}
                  renomearValor={renomearValor}
                  onSelecionar={(id) => {
                    setConversaAtivaId(id)
                    router.replace(`/dashboard/assistente?conversa=${id}`)
                  }}
                  onRenomearInicio={(c) => {
                    setRenomeandoId(c.id)
                    setRenomearValor(c.titulo)
                  }}
                  onRenomearChange={setRenomearValor}
                  onRenomearConfirmar={renomearConversa}
                  onExcluir={(id) => setConfirmExcluirId(id)}
                />
              )}
            </>
          )}
        </div>
        <IndicadorCota ref={indicadorCotaRef} />
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0">
        {conversaAtiva ? (
          <ChatView
            key={conversaAtiva.id}
            conversa={conversaAtiva}
            onMensagemEnviada={() => indicadorCotaRef.current?.recarregar()}
          />
        ) : (
          <EstadoVazio onUsarTemplate={async (agente, prompt) => {
            // Cria conversa nova e abre com o prompt pré-preenchido (via query string)
            try {
              setCriando(agente)
              const res = await fetch('/api/assistente/conversas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agente }),
              })
              if (!res.ok) throw new Error()
              const c: Conversa = await res.json()
              setConversas([c, ...conversas])
              setConversaAtivaId(c.id)
              router.replace(`/dashboard/assistente?conversa=${c.id}&prompt=${encodeURIComponent(prompt)}`)
            } catch {
              toast({ variant: 'destructive', title: 'Erro ao criar conversa' })
            } finally {
              setCriando(null)
            }
          }} />
        )}
      </main>

      <ConfirmDialog
        open={confirmExcluirId !== null}
        onOpenChange={(open) => { if (!open) setConfirmExcluirId(null) }}
        onConfirm={excluirConversa}
        title="Excluir conversa"
        description="A conversa e todas as mensagens serão removidas. Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </div>
  )
}

interface ListaConversasProps {
  label: string
  conversas: Conversa[]
  conversaAtivaId: number | null
  renomeandoId: number | null
  renomearValor: string
  onSelecionar: (id: number) => void
  onRenomearInicio: (c: Conversa) => void
  onRenomearChange: (v: string) => void
  onRenomearConfirmar: (id: number) => void
  onExcluir: (id: number) => void
}

function ListaConversas({
  label,
  conversas,
  conversaAtivaId,
  renomeandoId,
  renomearValor,
  onSelecionar,
  onRenomearInicio,
  onRenomearChange,
  onRenomearConfirmar,
  onExcluir,
}: ListaConversasProps) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-1">
        {label}
      </div>
      <div className="space-y-0.5">
        {conversas.map((c) => (
          <div
            key={c.id}
            className={cn(
              'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer',
              conversaAtivaId === c.id && 'bg-accent'
            )}
            onClick={() => onSelecionar(c.id)}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {renomeandoId === c.id ? (
              <Input
                autoFocus
                value={renomearValor}
                onChange={(e) => onRenomearChange(e.target.value)}
                onBlur={() => onRenomearConfirmar(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRenomearConfirmar(c.id)
                  if (e.key === 'Escape') onRenomearConfirmar(c.id)
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-6 px-1 text-sm"
              />
            ) : (
              <span className="flex-1 truncate">{c.titulo}</span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onRenomearInicio(c)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Renomear
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onExcluir(c.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </div>
  )
}

function EstadoVazio({ onUsarTemplate }: { onUsarTemplate: (agente: Agente, prompt: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <Sparkles className="h-12 w-12 mx-auto mb-3 text-primary" />
          <h2 className="text-2xl font-bold">Assistente IA</h2>
          <p className="text-muted-foreground mt-1">
            Crie e configure dados, ou consulte fretes em linguagem natural.
          </p>
        </div>

        {(() => {
          const linhas = Math.max(TEMPLATES.ESCRITA.length, TEMPLATES.CONSULTA.length)
          return (
            <div className="grid md:grid-cols-2 gap-x-6 gap-y-3 items-stretch">
              {/* Cabeçalhos */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Wrench className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Escrita</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cria, edita e exclui dados — sempre com aprovação antes de aplicar.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Search className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Consulta</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cota fretes, diagnostica, audita configuração. Não altera dados.
                </p>
              </div>

              {/* Cards intercalados (esquerda Escrita, direita Consulta) — mesma linha estica até o card mais alto */}
              {Array.from({ length: linhas }).flatMap((_, i) => {
                const e = TEMPLATES.ESCRITA[i]
                const c = TEMPLATES.CONSULTA[i]
                return [
                  e ? (
                    <button
                      key={`e-${i}`}
                      onClick={() => onUsarTemplate('ESCRITA', e.prompt)}
                      className="text-left rounded-lg border p-3 hover:bg-accent transition-colors h-full flex flex-col"
                    >
                      <div className="font-medium text-sm">{e.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{e.prompt}</div>
                    </button>
                  ) : <div key={`e-${i}`} />,
                  c ? (
                    <button
                      key={`c-${i}`}
                      onClick={() => onUsarTemplate('CONSULTA', c.prompt)}
                      className="text-left rounded-lg border p-3 hover:bg-accent transition-colors h-full flex flex-col"
                    >
                      <div className="font-medium text-sm">{c.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.prompt}</div>
                    </button>
                  ) : <div key={`c-${i}`} />,
                ]
              })}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
