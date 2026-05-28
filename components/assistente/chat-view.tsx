'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { Sparkles, Loader2, Send, User, Search, Wrench, ChevronDown, ChevronRight, Paperclip, X, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlanoMudancas } from './plano-mudancas'

type Agente = 'ESCRITA' | 'CONSULTA'

export interface Conversa {
  id: number
  agente: Agente
  titulo: string
}

interface MensagemBackend {
  id: number
  role: 'USER' | 'ASSISTANT' | 'TOOL'
  conteudo: string
  toolCalls?: { executadas?: ToolCallRegistrada[]; plano?: OperacaoBruta[] } | null
  dataCriacao: string
}

interface ToolCallRegistrada {
  name: string
  args: unknown
  result: unknown
}

type OperacaoBruta = Record<string, unknown> & { tipo: string }

interface MensagemUI {
  id: string
  role: 'user' | 'assistant'
  conteudo: string
  toolCalls?: ToolCallRegistrada[]
  plano?: OperacaoBruta[]
  pendente?: boolean
}

const MENSAGENS_LOADING = [
  'Buscando informações…',
  'Consultando dados…',
  'Aguarde, organizando…',
  'Cruzando referências…',
  'Quase lá…',
]

interface ChatViewProps {
  conversa: Conversa
  onMensagemEnviada?: () => void
}

export function ChatView({ conversa, onMensagemEnviada }: ChatViewProps) {
  const { toast } = useToast()
  const [mensagens, setMensagens] = useState<MensagemUI[]>([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [loadingHist, setLoadingHist] = useState(true)
  const [loadingMsg, setLoadingMsg] = useState(MENSAGENS_LOADING[0])
  const [toolCallsAtuais, setToolCallsAtuais] = useState<ToolCallRegistrada[]>([])
  const [arquivos, setArquivos] = useState<File[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_ARQUIVOS = 3
  const MAX_BYTES = 5 * 1024 * 1024
  const TIPOS_ACEITOS = '.csv,.xlsx,.xls,.pdf,.txt'

  const adicionarArquivos = (lista: FileList | null) => {
    if (!lista) return
    const novos: File[] = []
    for (const f of Array.from(lista)) {
      if (f.size > MAX_BYTES) {
        toast({ variant: 'destructive', title: 'Arquivo muito grande', description: `${f.name} excede 5MB` })
        continue
      }
      novos.push(f)
    }
    const combinados = [...arquivos, ...novos].slice(0, MAX_ARQUIVOS)
    if (arquivos.length + novos.length > MAX_ARQUIVOS) {
      toast({ title: `Máximo de ${MAX_ARQUIVOS} arquivos por mensagem` })
    }
    setArquivos(combinados)
  }

  const removerArquivo = (idx: number) => {
    setArquivos(arquivos.filter((_, i) => i !== idx))
  }

  // Rotaciona mensagens de loading
  useEffect(() => {
    if (!enviando) return
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % MENSAGENS_LOADING.length
      setLoadingMsg(MENSAGENS_LOADING[i])
    }, 1500)
    return () => clearInterval(interval)
  }, [enviando])

  // Auto-scroll quando mensagens mudam
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensagens])

  // Carrega histórico ao abrir conversa
  const carregarHistorico = useCallback(async () => {
    setLoadingHist(true)
    try {
      const res = await fetch(`/api/assistente/conversas/${conversa.id}`)
      if (!res.ok) throw new Error()
      const data: { mensagens: MensagemBackend[] } = await res.json()
      const ui: MensagemUI[] = data.mensagens
        .filter(m => m.role !== 'TOOL')
        .map(m => ({
          id: String(m.id),
          role: m.role === 'USER' ? 'user' : 'assistant',
          conteudo: m.conteudo,
          toolCalls: m.toolCalls?.executadas,
          plano: m.toolCalls?.plano,
        }))
      setMensagens(ui)
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao carregar histórico' })
    } finally {
      setLoadingHist(false)
    }
  }, [conversa.id, toast])

  useEffect(() => {
    carregarHistorico()
  }, [carregarHistorico])

  const enviar = async () => {
    const texto = input.trim()
    if ((!texto && arquivos.length === 0) || enviando) return

    const arquivosEnvio = arquivos
    const textoFinal = texto || (arquivosEnvio.length > 0 ? 'Analise o(s) arquivo(s) anexado(s).' : '')
    setInput('')
    setArquivos([])
    setEnviando(true)
    setToolCallsAtuais([])

    const conteudoExibicao = textoFinal + (arquivosEnvio.length > 0
      ? `\n\n📎 ${arquivosEnvio.map(a => a.name).join(', ')}`
      : '')
    const userMsg: MensagemUI = { id: `tmp-user-${Date.now()}`, role: 'user', conteudo: conteudoExibicao }
    const assistantMsg: MensagemUI = { id: `tmp-asst-${Date.now()}`, role: 'assistant', conteudo: '', pendente: true }
    setMensagens(prev => [...prev, userMsg, assistantMsg])

    try {
      let res: Response
      if (arquivosEnvio.length > 0) {
        const form = new FormData()
        form.append('conteudo', textoFinal)
        arquivosEnvio.forEach(a => form.append('arquivos', a))
        res = await fetch(`/api/assistente/conversas/${conversa.id}/mensagens`, {
          method: 'POST',
          body: form,
        })
      } else {
        res = await fetch(`/api/assistente/conversas/${conversa.id}/mensagens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conteudo: textoFinal }),
        })
      }
      if (!res.ok) {
        const erro = await res.json().catch(() => ({ erro: 'Erro desconhecido' }))
        const titulo = res.status === 429 ? 'Cota mensal esgotada' : 'Erro ao enviar'
        toast({ variant: 'destructive', title: titulo, description: erro.erro || 'Falha ao enviar mensagem' })
        setMensagens(prev => prev.filter(m => m.id !== assistantMsg.id))
        return
      }
      if (!res.body) throw new Error('Resposta sem body')
      onMensagemEnviada?.()

      // Parse SSE
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let textoAccum = ''
      const toolsAccum: ToolCallRegistrada[] = []
      let planoAccum: OperacaoBruta[] | undefined

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() || ''
        for (const block of blocks) {
          const lines = block.split('\n')
          let eventName = 'message'
          let dataStr = ''
          for (const ln of lines) {
            if (ln.startsWith('event: ')) eventName = ln.slice(7)
            else if (ln.startsWith('data: ')) dataStr += ln.slice(6)
          }
          if (!dataStr) continue
          let data: unknown
          try { data = JSON.parse(dataStr) } catch { continue }

          if (eventName === 'token') {
            const { delta } = data as { delta: string }
            textoAccum += delta
            setMensagens(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, conteudo: textoAccum } : m))
          } else if (eventName === 'tool_call') {
            const { name, args } = data as { name: string; args: unknown }
            toolsAccum.push({ name, args, result: null })
            setToolCallsAtuais([...toolsAccum])
          } else if (eventName === 'tool_result') {
            const { name, result } = data as { name: string; result: unknown }
            const pendente = [...toolsAccum].reverse().find(t => t.name === name && t.result === null)
            if (pendente) pendente.result = result
            setToolCallsAtuais([...toolsAccum])
          } else if (eventName === 'plano') {
            const { operacoes } = data as { operacoes: OperacaoBruta[] }
            planoAccum = operacoes
          } else if (eventName === 'final') {
            const { text } = data as { text: string }
            textoAccum = text || textoAccum
          } else if (eventName === 'done') {
            setMensagens(prev => prev.map(m =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    conteudo: textoAccum,
                    toolCalls: toolsAccum.length > 0 ? toolsAccum : undefined,
                    plano: planoAccum,
                    pendente: false,
                  }
                : m
            ))
            setToolCallsAtuais([])
          } else if (eventName === 'error') {
            const { mensagem } = data as { mensagem: string }
            throw new Error(mensagem)
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido'
      toast({ variant: 'destructive', title: 'Erro', description: msg })
      setMensagens(prev => prev.filter(m => m.id !== assistantMsg.id))
    } finally {
      setEnviando(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  if (loadingHist) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const turnosUsuario = mensagens.filter(m => m.role === 'user').length
  const proximoLimite = turnosUsuario >= 80

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b p-3 flex items-center gap-2">
        {conversa.agente === 'ESCRITA' ? (
          <Wrench className="h-4 w-4 text-primary" />
        ) : (
          <Search className="h-4 w-4 text-primary" />
        )}
        <span className="font-semibold text-sm">{conversa.titulo}</span>
        <span className="text-xs text-muted-foreground ml-2">
          {conversa.agente === 'ESCRITA' ? 'Agente de Escrita' : 'Agente de Consulta'}
        </span>
        {proximoLimite && (
          <span className="ml-auto text-xs text-amber-600">
            {turnosUsuario}/100 turnos — considere começar uma nova conversa
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {mensagens.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Comece digitando uma pergunta abaixo.
          </div>
        )}
        {mensagens.map(m => (
          <MensagemBolha
            key={m.id}
            mensagem={m}
            conversaId={conversa.id}
            onPlanoAplicado={() => {
              // Marca o plano como "aplicado" removendo do objeto da mensagem
              setMensagens(prev => prev.map(x => x.id === m.id ? { ...x, plano: undefined } : x))
              onMensagemEnviada?.()
            }}
          />
        ))}
        {enviando && toolCallsAtuais.length > 0 && (
          <ToolCallsBlock toolCalls={toolCallsAtuais} />
        )}
        {enviando && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{loadingMsg}</span>
          </div>
        )}
      </div>

      <div className="border-t p-3 shrink-0 flex flex-col justify-center min-h-[5rem]">
        <div className="space-y-2">
          {arquivos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {arquivos.map((arq, i) => (
                <div
                  key={`${arq.name}-${i}`}
                  className="flex items-center gap-1.5 rounded-md border bg-muted/40 pl-2 pr-1 py-0.5 text-xs"
                >
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="max-w-[200px] truncate">{arq.name}</span>
                  <span className="text-muted-foreground">{Math.round(arq.size / 1024)}KB</span>
                  <button
                    onClick={() => removerArquivo(i)}
                    className="text-muted-foreground hover:text-destructive p-0.5"
                    aria-label="Remover"
                    disabled={enviando}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept={TIPOS_ACEITOS}
              multiple
              className="hidden"
              onChange={(e) => {
                adicionarArquivos(e.target.files)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={enviando || arquivos.length >= MAX_ARQUIVOS}
              title="Anexar arquivo (xlsx, csv, pdf, txt — até 5MB)"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                conversa.agente === 'CONSULTA'
                  ? 'Pergunte sobre cotações, transportadoras, produtos…'
                  : 'Descreva o que quer criar/editar/excluir…'
              }
              rows={2}
              className="resize-none flex-1"
              disabled={enviando}
            />
            <Button onClick={enviar} disabled={enviando || (!input.trim() && arquivos.length === 0)}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MensagemBolha({
  mensagem,
  conversaId,
  onPlanoAplicado,
}: {
  mensagem: MensagemUI
  conversaId: number
  onPlanoAplicado: () => void
}) {
  const isUser = mensagem.role === 'user'
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
      )}>
        {isUser ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div className={cn('max-w-[80%] space-y-2 flex-1', isUser && 'items-end flex flex-col flex-none')}>
        {mensagem.toolCalls && mensagem.toolCalls.length > 0 && (
          <ToolCallsBlock toolCalls={mensagem.toolCalls} />
        )}
        {mensagem.conteudo || mensagem.pendente ? (
          <div className={cn(
            'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}>
            {mensagem.conteudo || <span className="text-muted-foreground italic">…</span>}
          </div>
        ) : null}
        {mensagem.plano && mensagem.plano.length > 0 && !isUser && (
          <PlanoMudancas
            conversaId={conversaId}
            operacoes={mensagem.plano}
            onAplicado={onPlanoAplicado}
          />
        )}
      </div>
    </div>
  )
}

function ToolCallsBlock({ toolCalls }: { toolCalls: ToolCallRegistrada[] }) {
  const [aberto, setAberto] = useState(false)
  return (
    <div className="rounded-md border bg-background text-xs">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-accent text-muted-foreground"
      >
        {aberto ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>{toolCalls.length} ação{toolCalls.length > 1 ? 'ões' : ''} do agente</span>
      </button>
      {aberto && (
        <div className="border-t p-2 space-y-2 max-h-72 overflow-y-auto font-mono">
          {toolCalls.map((tc, i) => (
            <div key={i} className="space-y-1">
              <div className="text-primary">▶ {tc.name}({JSON.stringify(tc.args)})</div>
              {tc.result !== null && (
                <div className="pl-3 text-muted-foreground break-all">
                  ↳ {JSON.stringify(tc.result).slice(0, 400)}
                  {JSON.stringify(tc.result).length > 400 && '…'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
