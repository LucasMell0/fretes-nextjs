"use client"

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, ArrowRight, X } from 'lucide-react'
import type { RegiaoParaImportar } from '@/types/importacao'

interface PreviewTabelaProps {
  regioes: RegiaoParaImportar[]
  erros: string[]
  onConfirmar: () => void
  onCancelar: () => void
}

export function PreviewTabela({ regioes, erros, onConfirmar, onCancelar }: PreviewTabelaProps) {
  const totalFaixas = regioes.reduce((acc, r) => acc + r.faixas.length, 0)

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Preview da Importação</h3>
            <p className="text-sm text-muted-foreground">
              Revise os dados antes de confirmar a importação
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">
              {regioes.length} regiões
            </Badge>
            <Badge variant="secondary">
              {totalFaixas} faixas
            </Badge>
          </div>
        </div>

        {erros.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-foreground">
                  Avisos encontrados:
                </p>
                <ul className="text-muted-foreground list-disc list-inside space-y-1">
                  {erros.slice(0, 5).map((erro, index) => (
                    <li key={index}>{erro}</li>
                  ))}
                  {erros.length > 5 && (
                    <li className="text-xs">... e mais {erros.length - 5} avisos</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border">
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Região</TableHead>
                  <TableHead>CEP Inicial</TableHead>
                  <TableHead>CEP Final</TableHead>
                  <TableHead className="text-right">ICMS (%)</TableHead>
                  <TableHead className="text-right">Faixas</TableHead>
                  <TableHead className="text-right">Kg Adicional</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regioes.map((regiao, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{regiao.nome}</TableCell>
                    <TableCell className="font-mono text-sm">{regiao.cepInicio}</TableCell>
                    <TableCell className="font-mono text-sm">{regiao.cepFim}</TableCell>
                    <TableCell className="text-right">
                      {regiao.icms.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{regiao.faixas.length}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {regiao.kgAdicional.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <div className="flex gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                Dados validados com sucesso!
              </p>
              <p className="text-muted-foreground mt-1">
                Todas as regiões contêm os dados obrigatórios e estão prontas para importação.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancelar}>
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button onClick={onConfirmar}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Confirmar Importação
          </Button>
        </div>
      </div>
    </Card>
  )
}
