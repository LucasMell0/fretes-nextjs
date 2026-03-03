'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Regiao {
  id: number
  nome: string
  cepInicio: string
  cepFim: string
  transportadora: {
    nome: string
  }
}

interface Taxas {
  id: number
  freteTipo: string
  freteValor: number
  freteMinimo: number
  grisTipo: string
  grisValor: number
  grisMinimo: number
  despachoTipo: string
  despachoValor: number
  despachoMinimo: number
  pedagioValor: number
  tasTipo: string
  tasValor: number
  tasMinimo: number
  tdaAtivo: boolean
  tdaTipo: string
  tdaValor: number
  tdaMinimo: number
  tdeAtivo: boolean
  tdeTipo: string
  tdeValor: number
  tdeMinimo: number
  trfAtivo: boolean
  trfTipo: string
  trfValor: number
  trfMinimo: number
  seguroFluvialAtivo: boolean
  seguroFluvialTipo: string
  seguroFluvialValor: number
  seguroFluvialMinimo: number
  trtAtivo: boolean
  trtTipo: string
  trtValor: number
  trtMinimo: number
  suframaAtivo: boolean
  suframaTipo: string
  suframaValor: number
  suframaMinimo: number
  icms: number
}

// Componente TaxaCard movido para fora para evitar re-criação
const TaxaCard = ({ 
  titulo, 
  prefixo, 
  ativo, 
  onAtivoChange,
  formData,
  setFormData
}: { 
  titulo: string
  prefixo: string
  ativo?: boolean
  onAtivoChange?: (value: boolean) => void
  formData: any
  setFormData: (data: any) => void
}) => {
  const tipoKey = `${prefixo}Tipo` as keyof typeof formData
  const valorKey = `${prefixo}Valor` as keyof typeof formData
  const minimoKey = `${prefixo}Minimo` as keyof typeof formData
  
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{titulo}</h3>
        {ativo !== undefined && onAtivoChange && (
          <div className="flex items-center gap-2">
            <Switch
              id={`${prefixo}-ativo`}
              checked={ativo}
              onCheckedChange={(checked) => onAtivoChange(checked as boolean)}
            />
            <Label htmlFor={`${prefixo}-ativo`} className="text-sm cursor-pointer">Ativo</Label>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Tipo</Label>
          <Select
            value={formData[tipoKey] as string}
            onValueChange={(value) => setFormData({ ...formData, [tipoKey]: value })}
            disabled={ativo === false}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENTUAL">Percentual (%)</SelectItem>
              <SelectItem value="VALOR">Valor (R$)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Valor {formData[tipoKey] === 'PERCENTUAL' ? '(%)' : '(R$)'}</Label>
          <Input
            type="number"
            step={formData[tipoKey] === 'PERCENTUAL' ? '0.01' : '0.01'}
            min="0"
            value={formData[valorKey] as number}
            onChange={(e) => setFormData({ ...formData, [valorKey]: parseFloat(e.target.value) || 0 })}
            disabled={ativo === false}
          />
        </div>
        <div>
          <Label>Mínimo (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData[minimoKey] as number}
            onChange={(e) => setFormData({ ...formData, [minimoKey]: parseFloat(e.target.value) || 0 })}
            disabled={ativo === false}
          />
        </div>
      </div>
    </Card>
  )
}

export default function TaxasPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  
  const regiaoId = parseInt(params.id as string)
  
  const [regiao, setRegiao] = useState<Regiao | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  
  const [formData, setFormData] = useState({
    freteTipo: 'VALOR',
    freteValor: 0,
    freteMinimo: 0,
    grisTipo: 'PERCENTUAL',
    grisValor: 0,
    grisMinimo: 0,
    despachoTipo: 'VALOR',
    despachoValor: 0,
    despachoMinimo: 0,
    pedagioValor: 0,
    tasTipo: 'PERCENTUAL',
    tasValor: 0,
    tasMinimo: 0,
    tdaAtivo: false,
    tdaTipo: 'VALOR',
    tdaValor: 0,
    tdaMinimo: 0,
    tdeAtivo: false,
    tdeTipo: 'VALOR',
    tdeValor: 0,
    tdeMinimo: 0,
    trfAtivo: false,
    trfTipo: 'VALOR',
    trfValor: 0,
    trfMinimo: 0,
    seguroFluvialAtivo: false,
    seguroFluvialTipo: 'PERCENTUAL',
    seguroFluvialValor: 0,
    seguroFluvialMinimo: 0,
    trtAtivo: false,
    trtTipo: 'VALOR',
    trtValor: 0,
    trtMinimo: 0,
    suframaAtivo: false,
    suframaTipo: 'PERCENTUAL',
    suframaValor: 0,
    suframaMinimo: 0,
    icms: 0,
  })

  useEffect(() => {
    carregarDados()
  }, [regiaoId])

  const carregarDados = async () => {
    try {
      const res = await fetch(`/api/regioes/${regiaoId}/taxas`)
      const data = await res.json()
      
      if (data.erro) {
        toast({
          variant: 'destructive',
          title: data.erro,
        })
        router.push('/dashboard/regioes')
        return
      }
      
      setRegiao(data.regiao)
      
      if (data.taxas) {
        setFormData({
          freteTipo: data.taxas.freteTipo,
          freteValor: Number(data.taxas.freteValor),
          freteMinimo: Number(data.taxas.freteMinimo),
          grisTipo: data.taxas.grisTipo,
          grisValor: Number(data.taxas.grisValor),
          grisMinimo: Number(data.taxas.grisMinimo),
          despachoTipo: data.taxas.despachoTipo,
          despachoValor: Number(data.taxas.despachoValor),
          despachoMinimo: Number(data.taxas.despachoMinimo),
          pedagioValor: Number(data.taxas.pedagioValor),
          tasTipo: data.taxas.tasTipo,
          tasValor: Number(data.taxas.tasValor),
          tasMinimo: Number(data.taxas.tasMinimo),
          tdaAtivo: data.taxas.tdaAtivo,
          tdaTipo: data.taxas.tdaTipo,
          tdaValor: Number(data.taxas.tdaValor),
          tdaMinimo: Number(data.taxas.tdaMinimo),
          tdeAtivo: data.taxas.tdeAtivo,
          tdeTipo: data.taxas.tdeTipo,
          tdeValor: Number(data.taxas.tdeValor),
          tdeMinimo: Number(data.taxas.tdeMinimo),
          trfAtivo: data.taxas.trfAtivo,
          trfTipo: data.taxas.trfTipo,
          trfValor: Number(data.taxas.trfValor),
          trfMinimo: Number(data.taxas.trfMinimo),
          seguroFluvialAtivo: data.taxas.seguroFluvialAtivo,
          seguroFluvialTipo: data.taxas.seguroFluvialTipo,
          seguroFluvialValor: Number(data.taxas.seguroFluvialValor),
          seguroFluvialMinimo: Number(data.taxas.seguroFluvialMinimo),
          trtAtivo: data.taxas.trtAtivo,
          trtTipo: data.taxas.trtTipo,
          trtValor: Number(data.taxas.trtValor),
          trtMinimo: Number(data.taxas.trtMinimo),
          suframaAtivo: data.taxas.suframaAtivo,
          suframaTipo: data.taxas.suframaTipo,
          suframaValor: Number(data.taxas.suframaValor),
          suframaMinimo: Number(data.taxas.suframaMinimo),
          icms: Number(data.taxas.icms),
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

  const salvar = async () => {
    setSalvando(true)
    try {
      const res = await fetch(`/api/regioes/${regiaoId}/taxas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast({ title: 'Taxas salvas com sucesso!' })
      } else {
        const error = await res.json()
        toast({
          variant: 'destructive',
          title: 'Erro ao salvar',
          description: error.erro,
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar taxas',
      })
    } finally {
      setSalvando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!regiao) {
    return null
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Taxas e ICMS</h2>
          <p className="text-muted-foreground mt-1">
            {regiao.nome} - {regiao.transportadora.nome}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard/regioes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      <div className="space-y-4">
        {/* ICMS */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4">ICMS</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="icms">ICMS (%)</Label>
              <Input
                id="icms"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.icms}
                onChange={(e) => setFormData({ ...formData, icms: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </Card>

        {/* Taxas Obrigatórias */}
        <TaxaCard titulo="Frete Valor" prefixo="frete" formData={formData} setFormData={setFormData} />
        <TaxaCard titulo="GRIS" prefixo="gris" formData={formData} setFormData={setFormData} />
        <TaxaCard titulo="Despacho" prefixo="despacho" formData={formData} setFormData={setFormData} />
        
        {/* Pedágio - Valor fixo por 100kg */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Pedágio (valor fixo por 100kg)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="pedagioValor">Valor por 100kg (R$)</Label>
              <Input
                id="pedagioValor"
                type="number"
                step="0.01"
                min="0"
                value={formData.pedagioValor}
                onChange={(e) => setFormData({ ...formData, pedagioValor: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Valor cobrado a cada 100kg (ou fração)
              </p>
            </div>
          </div>
        </Card>
        
        <TaxaCard titulo="TAS" prefixo="tas" formData={formData} setFormData={setFormData} />

        {/* Taxas Opcionais */}
        <TaxaCard 
          titulo="TDA" 
          prefixo="tda" 
          ativo={formData.tdaAtivo}
          onAtivoChange={(value) => setFormData({ ...formData, tdaAtivo: value })}
          formData={formData}
          setFormData={setFormData}
        />
        <TaxaCard 
          titulo="TDE" 
          prefixo="tde" 
          ativo={formData.tdeAtivo}
          onAtivoChange={(value) => setFormData({ ...formData, tdeAtivo: value })}
          formData={formData}
          setFormData={setFormData}
        />
        <TaxaCard 
          titulo="TRF" 
          prefixo="trf" 
          ativo={formData.trfAtivo}
          onAtivoChange={(value) => setFormData({ ...formData, trfAtivo: value })}
          formData={formData}
          setFormData={setFormData}
        />
        <TaxaCard 
          titulo="Seguro Fluvial" 
          prefixo="seguroFluvial" 
          ativo={formData.seguroFluvialAtivo}
          onAtivoChange={(value) => setFormData({ ...formData, seguroFluvialAtivo: value })}
          formData={formData}
          setFormData={setFormData}
        />
        <TaxaCard 
          titulo="TRT" 
          prefixo="trt" 
          ativo={formData.trtAtivo}
          onAtivoChange={(value) => setFormData({ ...formData, trtAtivo: value })}
          formData={formData}
          setFormData={setFormData}
        />
        <TaxaCard 
          titulo="SUFRAMA" 
          prefixo="suframa" 
          ativo={formData.suframaAtivo}
          onAtivoChange={(value) => setFormData({ ...formData, suframaAtivo: value })}
          formData={formData}
          setFormData={setFormData}
        />

        {/* Botão Salvar */}
        <div className="flex justify-end pt-4">
          <Button onClick={salvar} disabled={salvando} size="lg">
            {salvando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Taxas
          </Button>
        </div>
      </div>
    </div>
  )
}
