'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        toast({
          variant: 'destructive',
          title: 'Erro ao fazer login',
          description: 'Email ou senha incorretos.',
        })
      } else {
        toast({
          title: 'Login realizado!',
          description: 'Redirecionando para o dashboard...',
        })
        router.push('/dashboard')
        router.refresh()
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Ocorreu um erro ao fazer login.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative w-full min-h-screen bg-zinc-950 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
        backgroundSize: '32px 32px',
      }} />
      <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-emerald-500/8 blur-[150px]" />
      <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[120px]" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-between p-12">
          <div>
            <Image
              src="/logos/ginte-white.png"
              alt="Ginte"
              width={140}
              height={46}
              priority
            />
          </div>

          <div className="space-y-8 max-w-lg">
            <h1 className="text-5xl font-bold tracking-tight text-white leading-[1.1]">
              Gestão Inteligente
              <br />
              <span className="text-emerald-400">de Cotações</span>
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed">
              Gerencie transportadoras, regiões, produtos e realize cotações de frete de forma automatizada em uma única plataforma.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-4">
              <div className="space-y-1">
                <p className="text-2xl font-bold text-white">99.9%</p>
                <p className="text-sm text-zinc-500">Uptime</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-white">&lt;1s</p>
                <p className="text-sm text-zinc-500">Tempo de cotação</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-white">24/7</p>
                <p className="text-sm text-zinc-500">Disponibilidade</p>
              </div>
            </div>
          </div>

          <div className="text-sm text-zinc-600">
            &copy; 2026 Ginte. Todos os direitos reservados.
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex items-center justify-center w-full lg:flex-1 px-6 py-12">
          <div className="w-full max-w-sm space-y-8">
            {/* Mobile Logo */}
            <div className="flex lg:hidden items-center justify-center mb-4">
              <Image
                src="/logos/ginte-white.png"
                alt="Ginte"
                width={130}
                height={44}
                priority
              />
            </div>

            {/* Login card */}
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 backdrop-blur-sm p-8 space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Bem-vindo de volta
                </h1>
                <p className="text-sm text-zinc-400">
                  Entre com suas credenciais para acessar o sistema
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-zinc-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@email.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11 bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-zinc-300">Senha</Label>
                    <Link
                      href="#"
                      className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
                      onClick={(e) => e.preventDefault()}
                    >
                      Esqueceu a senha?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.querySelector<HTMLFormElement>('form')?.requestSubmit() } }}
                      required
                      disabled={isLoading}
                      className="h-11 pr-10 bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 font-medium" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="text-center text-sm text-zinc-500">
                Não tem uma conta?{' '}
                <Link href="#" className="text-emerald-400 hover:underline font-medium" onClick={(e) => e.preventDefault()}>
                  Entre em contato
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
