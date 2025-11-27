import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { aplicarDescontoComanda, removerDescontoComanda } from '@/lib/store'
import { useToast } from '@/components/ui/use-toast'
import { Trash2 } from 'lucide-react'

export function DescontoComandaDialog({ comanda, subtotal, onApply, onClose, codigoEmpresa }) {
  const { toast } = useToast()
  const [tipo, setTipo] = useState(comanda?.desconto_tipo || 'percentual')
  const [valor, setValor] = useState(comanda?.desconto_valor || 0)
  const [motivo, setMotivo] = useState(comanda?.desconto_motivo || '')
  const [loading, setLoading] = useState(false)

  if (!comanda) return null

  const descontoValor =
    tipo === 'percentual'
      ? (subtotal * valor) / 100
      : valor

  const totalComDesconto = Math.max(0, subtotal - descontoValor)

  const handleAplicar = async () => {
    try {
      setLoading(true)

      // Validações
      if (valor < 0) {
        toast({ title: 'Erro', description: 'Desconto não pode ser negativo', variant: 'destructive' })
        return
      }
      if (tipo === 'percentual' && valor > 100) {
        toast({ title: 'Erro', description: 'Desconto percentual não pode ser maior que 100%', variant: 'destructive' })
        return
      }
      if (descontoValor > subtotal) {
        toast({ title: 'Erro', description: 'Desconto não pode ser maior que o subtotal', variant: 'destructive' })
        return
      }

      console.log('Aplicando desconto comanda:', {
        comandaId: comanda.id,
        desconto_tipo: tipo,
        desconto_valor: Number(valor),
        desconto_motivo: motivo || null,
        codigoEmpresa
      })

      const result = await aplicarDescontoComanda({
        comandaId: comanda.id,
        desconto_tipo: tipo,
        desconto_valor: Number(valor),
        desconto_motivo: motivo || null,
        codigoEmpresa
      })

      console.log('Resultado comanda:', result)

      toast({ title: 'Sucesso', description: 'Desconto aplicado na comanda!', variant: 'success' })
      onApply()
      onClose()
    } catch (err) {
      console.error('Erro ao aplicar desconto:', err)
      toast({ title: 'Erro', description: err.message || 'Falha ao aplicar desconto', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleRemover = async () => {
    try {
      setLoading(true)
      await removerDescontoComanda({ comandaId: comanda.id, codigoEmpresa })
      toast({ title: 'Sucesso', description: 'Desconto removido!', variant: 'success' })
      onApply()
      onClose()
    } catch (err) {
      console.error('Erro ao remover desconto:', err)
      toast({ title: 'Erro', description: err.message || 'Falha ao remover desconto', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Desconto da Comanda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo de Desconto */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Tipo de Desconto</Label>
            <div className="flex gap-2">
              <Button
                variant={tipo === 'percentual' ? 'default' : 'outline'}
                onClick={() => setTipo('percentual')}
                disabled={loading}
                className="flex-1"
              >
                Percentual (%)
              </Button>
              <Button
                variant={tipo === 'fixo' ? 'default' : 'outline'}
                onClick={() => setTipo('fixo')}
                disabled={loading}
                className="flex-1"
              >
                Fixo (R$)
              </Button>
            </div>
          </div>

          {/* Valor */}
          <div>
            <Label htmlFor="desconto-valor" className="text-sm font-semibold">
              Valor {tipo === 'percentual' ? '(%)' : '(R$)'}
            </Label>
            <div className="relative mt-1">
              <Input
                id="desconto-valor"
                type="text"
                name="desconto-valor"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={tipo === 'percentual' 
                  ? (valor === 0 ? '' : valor)
                  : (valor === 0 ? '' : `R$ ${valor.toFixed(2)}`)
                }
                onChange={(e) => {
                  let inputVal = e.target.value.trim()
                  
                  if (inputVal === '') {
                    setValor(0)
                    return
                  }
                  
                  // Remover máscara de R$ se for desconto fixo
                  if (tipo === 'fixo') {
                    inputVal = inputVal.replace(/[^\d.,]/g, '').replace(',', '.')
                  }
                  
                  let val = Number(inputVal)
                  if (isNaN(val)) val = 0
                  if (tipo === 'percentual' && val > 100) val = 100
                  if (val < 0) val = 0
                  setValor(val)
                }}
                placeholder={tipo === 'percentual' ? '0' : '0,00'}
                disabled={loading}
                className="mt-1"
              />
              {tipo === 'percentual' && (
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary font-semibold">%</span>
              )}
            </div>
          </div>

          {/* Motivo */}
          <div>
            <Label htmlFor="desconto-motivo" className="text-sm font-semibold">
              Motivo
            </Label>
            <select
              id="desconto-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full border border-border rounded-md p-2 mt-1 text-sm bg-background"
              disabled={loading}
            >
              <option value="">Selecione um motivo...</option>
              <option value="Promoção">Promoção</option>
              <option value="Cortesia">Cortesia</option>
              <option value="Ajuste">Ajuste</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          {/* Preview */}
          <div className="bg-surface-2 p-4 rounded-lg space-y-2 border border-border">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Subtotal:</span>
              <span className="font-semibold">R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-destructive font-semibold">
              <span>Desconto:</span>
              <span>-R$ {descontoValor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-border pt-2">
              <span>Total da Comanda:</span>
              <span className="text-brand">R$ {totalComDesconto.toFixed(2)}</span>
            </div>
          </div>

          {/* Info */}
          {motivo && (
            <div className="text-xs text-text-secondary bg-surface p-2 rounded">
              <strong>Motivo:</strong> {motivo}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>

          {comanda.desconto_valor > 0 && (
            <Button
              variant="destructive"
              onClick={handleRemover}
              disabled={loading}
              size="sm"
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Remover
            </Button>
          )}

          <Button onClick={handleAplicar} disabled={loading} className="gap-2">
            {loading ? 'Aplicando...' : 'Aplicar Desconto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
