'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { User2, Lock, Loader2, Mail, Shield } from 'lucide-react'
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formPerfil),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Perfil atualizado!',
          description: 'Suas informações foram salvas com sucesso.',
        })
        setUsuario(prev => prev ? { ...prev, ...data } : null)
        
        // Atualizar sessão NextAuth para refletir mudanças na sidebar
        await update({
          ...session,
          user: {
            ...session?.user,
            name: data.nome,
            email: data.email,
          },
        })
        
        // Forçar re-renderização da sidebar (Server Component)
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
        headers: {
          'Content-Type': 'application/json',
        },
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
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Minha Conta</h2>
        <p className="text-muted-foreground">Gerencie suas informações pessoais e segurança</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Informações da Conta */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User2 className="h-5 w-5" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>
              Atualize seus dados cadastrais
            </CardDescription>
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
              <div className="flex gap-2">
                <Mail className="h-4 w-4 mt-3 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formPerfil.email}
                  onChange={(e) => setFormPerfil({ ...formPerfil, email: e.target.value })}
                  placeholder="seu@email.com"
                  className="flex-1"
                />
              </div>
            </div>

            <Separator className="my-4" />

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
                'Salvar Alterações'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Resumo da Conta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Detalhes da Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Tipo de Conta</Label>
              <div className="mt-1">
                <Badge variant={usuario?.tipo === 'ADMIN' ? 'default' : 'secondary'}>
                  {usuario?.tipo === 'ADMIN' ? 'Administrador' : 'Usuário'}
                </Badge>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="mt-1">
                <Badge variant={usuario?.ativo ? 'default' : 'secondary'}>
                  {usuario?.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Membro desde</Label>
              <p className="text-sm font-medium mt-1">
                {usuario?.dataCriacao ? formatarData(usuario.dataCriacao) : '-'}
              </p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">ID do Usuário</Label>
              <p className="text-sm font-mono mt-1">#{usuario?.id}</p>
            </div>
          </CardContent>
        </Card>

        {/* Segurança - Alterar Senha */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Segurança
            </CardTitle>
            <CardDescription>
              Altere sua senha para manter sua conta segura
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="senhaAtual">Senha Atual</Label>
                <Input
                  id="senhaAtual"
                  type="password"
                  value={formSenha.senhaAtual}
                  onChange={(e) => setFormSenha({ ...formSenha, senhaAtual: e.target.value })}
                  placeholder="Digite sua senha atual"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="novaSenha">Nova Senha</Label>
                <Input
                  id="novaSenha"
                  type="password"
                  value={formSenha.novaSenha}
                  onChange={(e) => setFormSenha({ ...formSenha, novaSenha: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
                <Input
                  id="confirmarSenha"
                  type="password"
                  value={formSenha.confirmarSenha}
                  onChange={(e) => setFormSenha({ ...formSenha, confirmarSenha: e.target.value })}
                  placeholder="Digite novamente"
                />
              </div>
            </div>

            <Separator className="my-4" />

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
