"use client"

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Loader2, ArrowLeft } from 'lucide-react'

interface ProgressoImportacaoProps {
  progresso: number
  etapa: 'processando' | 'concluido'
  resultado: { regioesImportadas: number; faixasImportadas: number } | null
  onVoltar: () => void
}

export function ProgressoImportacao({ 
  progresso, 
  etapa, 
  resultado, 
  onVoltar 
}: ProgressoImportacaoProps) {
  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="text-center">
          {etapa === 'processando' ? (
            <>
              <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-4" />
              <h3 className="text-lg font-semibold">Importando dados...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Por favor, aguarde enquanto processamos a importação
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary mb-4" />
              <h3 className="text-lg font-semibold">Importação concluída!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Todos os dados foram importados com sucesso
              </p>
            </>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{progresso}%</span>
          </div>
          <Progress value={progresso} className="h-2" />
        </div>

        {resultado && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">
                {resultado.regioesImportadas}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Regiões importadas
              </p>
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">
                {resultado.faixasImportadas}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Faixas de peso
              </p>
            </div>
          </div>
        )}

        {etapa === 'concluido' && (
          <div className="flex justify-center">
            <Button onClick={onVoltar}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Nova Importação
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
