"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { parsearCSV } from '@/lib/parsers/csv-parser'
import { PreviewTabela } from './preview-tabela'
import { ProgressoImportacao } from './progresso-importacao'
import type { RegiaoParaImportar } from '@/types/importacao'

interface UploadRegioesProps {
  transportadoraId: number
  onSucesso?: () => void
}

export function UploadRegioes({ transportadoraId, onSucesso }: UploadRegioesProps) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [regioes, setRegioes] = useState<RegiaoParaImportar[]>([])
  const [errosParser, setErrosParser] = useState<string[]>([])
  const [etapa, setEtapa] = useState<'upload' | 'preview' | 'processando' | 'concluido'>('upload')
  const [progresso, setProgresso] = useState(0)
  const [resultado, setResultado] = useState<{ regioesImportadas: number; faixasImportadas: number } | null>(null)
  const { toast } = useToast()

  const handleArquivoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast({
        variant: 'destructive',
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo CSV',
      })
      return
    }

    setArquivo(file)
    setEtapa('preview')
    setProgresso(10)

    try {
      const resultado = await parsearCSV(file)
      setProgresso(30)

      if (resultado.erros.length > 0) {
        setErrosParser(resultado.erros.map(e => `Linha ${e.linha}: ${e.mensagem}`))
      }

      if (resultado.regioes.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhuma região encontrada',
          description: 'O arquivo não contém dados válidos',
        })
        setEtapa('upload')
        return
      }

      setRegioes(resultado.regioes)
      setProgresso(50)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao processar arquivo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
      setEtapa('upload')
    }
  }

  const confirmarImportacao = async () => {
    setEtapa('processando')
    setProgresso(60)

    try {
      const response = await fetch(`/api/transportadoras/${transportadoraId}/importar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regioes }),
      })

      setProgresso(80)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.erro || 'Erro ao importar')
      }

      setProgresso(100)
      setResultado({
        regioesImportadas: data.regioesImportadas,
        faixasImportadas: data.faixasImportadas,
      })
      setEtapa('concluido')

      toast({
        title: 'Importação concluída!',
        description: data.mensagem,
      })

      if (onSucesso) {
        setTimeout(onSucesso, 2000)
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
      setEtapa('preview')
    }
  }

  const resetar = () => {
    setArquivo(null)
    setRegioes([])
    setErrosParser([])
    setEtapa('upload')
    setProgresso(0)
    setResultado(null)
  }

  if (etapa === 'processando' || etapa === 'concluido') {
    return (
      <ProgressoImportacao
        progresso={progresso}
        etapa={etapa}
        resultado={resultado}
        onVoltar={resetar}
      />
    )
  }

  if (etapa === 'preview' && regioes.length > 0) {
    return (
      <PreviewTabela
        regioes={regioes}
        erros={errosParser}
        onConfirmar={confirmarImportacao}
        onCancelar={resetar}
      />
    )
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Upload de Planilha</h3>
          <p className="text-sm text-muted-foreground">
            Faça upload de um arquivo CSV com as regiões e faixas de peso da transportadora
          </p>
        </div>

        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          
          <Label htmlFor="arquivo-upload" className="cursor-pointer">
            <div className="space-y-2">
              <p className="text-sm font-medium">Clique para selecionar o arquivo CSV</p>
              <p className="text-xs text-muted-foreground">
                Separador: ponto e vírgula (;), vírgula (,) ou tab
              </p>
            </div>
            <input
              id="arquivo-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleArquivoChange}
            />
          </Label>

          {arquivo && (
            <div className="mt-4 text-sm text-muted-foreground">
              Arquivo selecionado: <span className="font-medium">{arquivo.name}</span>
            </div>
          )}
        </div>

        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <div className="flex gap-2">
            <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-foreground">
                Colunas obrigatórias:
              </p>
              <p className="text-muted-foreground">
                <strong>REGIAO</strong>, <strong>CEP_INICIAL</strong>, <strong>CEP_FINAL</strong>
              </p>
              <p className="text-primary mt-2">
                <a 
                  href="/api/transportadoras/modelo-csv" 
                  className="underline hover:no-underline"
                  download
                >
                  Baixar modelo de planilha
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => document.getElementById('arquivo-upload')?.click()}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            Selecionar Arquivo
          </Button>
        </div>
      </div>
    </Card>
  )
}
