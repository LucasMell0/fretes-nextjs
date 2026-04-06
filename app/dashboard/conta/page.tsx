'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { User2, Lock, Loader2, Mail, Shield, Calendar, Hash, Eye, EyeOff, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useSession } from 'next-auth/react'

interface Usuario {
  id: number
  nome: string
  email: string
  tipo: string
  ativo: boolean
  dataCriacao: string
}

export default function ContaPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(true)
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)
  const [alterandoSenha, setAlterandoSenha] = useState(false)
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  const [showSenhaAtual, setShowSenhaAtual] = useState(false)
  const [showNovaSenha, setShowNovaSenha] = useState(false)
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false)

  const [formPerfil, setFormPerfil] = useState({
    nome: '',
    email: '',
  })

  const [formSenha, setFormSenha] = useState({
    senhaAtual: '',
    novaSenha: '',
    confirmarSenha: '',
  })

  useEffect(() => {
    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const carregarDados = async () => {
    try {
      const res = await fetch('/api/usuarios/perfil')
      const data = await res.json()

      if (res.ok) {
        setUsuario(data)
        setFormPerfil({
          nome: data.nome,
          email: data.email,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar dados',
          description: data.erro,
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
      })
    } finally {
      setLoading(false)
    }
  }

  const salvarPerfil = async () => {
    setSalvandoPerfil(true)

    try {
      const res = await fetch('/api/usuarios/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formPerfil),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Perfil atualizado!',
          description: 'Suas informações foram salvas com sucesso.',
        })
        setUsuario(prev => prev ? { ...prev, ...data } : null)

        await update({
          ...session,
          user: {
            ...session?.user,
            name: data.nome,
            email: data.email,
          },
        })

        router.refresh()
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao salvar',
          description: data.erro || 'Não foi possível atualizar o perfil',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar perfil',
      })
    } finally {
      setSalvandoPerfil(false)
    }
  }

  const alterarSenha = async () => {
    if (formSenha.novaSenha !== formSenha.confirmarSenha) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'As senhas não coincidem',
      })
      return
    }

    setAlterandoSenha(true)

    try {
      const res = await fetch('/api/usuarios/senha', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formSenha),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Senha alterada!',
          description: 'Sua senha foi atualizada com sucesso.',
        })
        setFormSenha({
          senhaAtual: '',
          novaSenha: '',
          confirmarSenha: '',
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao alterar senha',
          description: data.erro || 'Não foi possível alterar a senha',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar senha',
      })
    } finally {
      setAlterandoSenha(false)
    }
  }

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
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
        <h2 className="text-3xl font-bold">Minha Conta</h2>
        <p className="text-muted-foreground">Gerencie suas informações pessoais e segurança</p>
      </div>

      {/* Info cards row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tipo de Conta</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usuario?.tipo === 'ADMIN' ? 'Admin' : 'Usuário'}</div>
            <p className="text-xs text-muted-foreground">
              {usuario?.tipo === 'ADMIN' ? 'Acesso completo' : 'Acesso padrão'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <div className={`h-3 w-3 rounded-full ${usuario?.ativo ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usuario?.ativo ? 'Ativo' : 'Inativo'}</div>
            <p className="text-xs text-muted-foreground">Status da conta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membro desde</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usuario?.dataCriacao ? formatarData(usuario.dataCriacao) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">Data de criação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ID do Usuário</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">#{usuario?.id}</div>
            <p className="text-xs text-muted-foreground">Identificador único</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Informações Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User2 className="h-5 w-5" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>Atualize seus dados cadastrais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                value={formPerfil.nome}
                onChange={(e) => setFormPerfil({ ...formPerfil, nome: e.target.value })}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formPerfil.email}
                onChange={(e) => setFormPerfil({ ...formPerfil, email: e.target.value })}
                placeholder="seu@email.com"
              />
            </div>

            <Separator />

            <Button
              onClick={salvarPerfil}
              disabled={salvandoPerfil}
              className="w-full sm:w-auto"
            >
              {salvandoPerfil ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Segurança */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Segurança
            </CardTitle>
            <CardDescription>Altere sua senha para manter sua conta segura</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senhaAtual">Senha Atual</Label>
              <div className="relative">
                <Input
                  id="senhaAtual"
                  type={showSenhaAtual ? 'text' : 'password'}
                  value={formSenha.senhaAtual}
                  onChange={(e) => setFormSenha({ ...formSenha, senhaAtual: e.target.value })}
                  placeholder="Digite sua senha atual"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showSenhaAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="novaSenha">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="novaSenha"
                  type={showNovaSenha ? 'text' : 'password'}
                  value={formSenha.novaSenha}
                  onChange={(e) => setFormSenha({ ...formSenha, novaSenha: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNovaSenha(!showNovaSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showNovaSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirmarSenha"
                  type={showConfirmarSenha ? 'text' : 'password'}
                  value={formSenha.confirmarSenha}
                  onChange={(e) => setFormSenha({ ...formSenha, confirmarSenha: e.target.value })}
                  placeholder="Digite novamente"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Separator />

            <Button
              onClick={alterarSenha}
              disabled={alterandoSenha || !formSenha.senhaAtual || !formSenha.novaSenha}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              {alterandoSenha ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Alterar Senha
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
