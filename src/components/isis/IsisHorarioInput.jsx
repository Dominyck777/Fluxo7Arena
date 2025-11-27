import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Lock, Trophy, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * Select triplo para horário (início, fim e esporte) - Estilo Ísis
 */
export const IsisHorarioInput = ({ onSubmit, onMudarData, disabled = false, horariosDisponiveis = [], esportes = [] }) => {
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [esporte, setEsporte] = useState('');

  // Gera opções de horário de início (todos os slots disponíveis)
  const opcoesInicio = horariosDisponiveis.map(slot => ({
    value: slot.inicio,
    label: slot.inicio,
    available: true
  }));

  // Gera opções de horário de fim (baseado no horário de início selecionado)
  const opcoesFim = (() => {
    if (!inicio) return [];
    
    const inicioIdx = horariosDisponiveis.findIndex(slot => slot.inicio === inicio);
    if (inicioIdx === -1) return [];
    
    // Cria opções de fim - percorre slots disponíveis a partir do início selecionado
    // IMPORTANTE: Tempo mínimo de 1 hora (2 slots de 30min), então começa do índice + 1
    const opcoes = [];
    
    for (let i = inicioIdx + 1; i < horariosDisponiveis.length; i++) {
      const currentSlot = horariosDisponiveis[i];
      const nextSlot = horariosDisponiveis[i + 1];
      
      // Sempre adiciona o fim do slot atual como opção
      opcoes.push({
        value: currentSlot.fim,
        label: currentSlot.fim,
        available: true
      });
      
      // Se não há próximo slot OU há quebra na sequência, para aqui
      if (!nextSlot || currentSlot.fim !== nextSlot.inicio) {
        break;
      }
    }
    
    return opcoes;
  })();

  // Auto-submete quando todos estão selecionados
  useEffect(() => {
    if (inicio && fim && esporte && !disabled) {
      onSubmit({ inicio, fim, esporte });
    }
  }, [inicio, fim, esporte]);

  // Reseta fim quando início muda
  useEffect(() => {
    if (inicio) {
      setFim('');
    }
  }, [inicio]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3"
    >
      {/* Label */}
      <div className="flex items-center gap-2 text-text-secondary text-sm md:text-xs">
        <Clock className="w-4 h-4" />
        <span className="font-medium">Horário desejado</span>
      </div>

      {/* Selects de horário */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Select Início */}
        <div className="flex-1">
          <label htmlFor="horario-inicio" className="text-xs text-text-muted mb-1 block">
            Início
          </label>
          <Select value={inicio} onValueChange={setInicio} disabled={disabled}>
            <SelectTrigger className="w-full bg-surface/70 backdrop-blur-sm border-white/10 text-[15px] md:text-sm">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] z-[60]">
              {opcoesInicio.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  disabled={!opt.available}
                  className={cn(!opt.available && 'opacity-60')}
                >
                  <span className="inline-flex items-center gap-2">
                    {opt.available ? (
                      <Clock className="w-4 h-4 opacity-80" />
                    ) : (
                      <Lock className="w-4 h-4 opacity-80" />
                    )}
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Separador */}
        <div className="text-text-muted font-bold text-lg pt-5">—</div>

        {/* Select Fim */}
        <div className="flex-1">
          <label htmlFor="horario-fim" className="text-xs text-text-muted mb-1 block">
            Término
          </label>
          <Select value={fim} onValueChange={setFim} disabled={!inicio || disabled}>
            <SelectTrigger className="w-full bg-surface/70 backdrop-blur-sm border-white/10 text-[15px] md:text-sm">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] z-[60]">
              {opcoesFim.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  disabled={!opt.available}
                  className={cn(!opt.available && 'opacity-60')}
                >
                  <span className="inline-flex items-center gap-2">
                    {opt.available ? (
                      <Clock className="w-4 h-4 opacity-80" />
                    ) : (
                      <Lock className="w-4 h-4 opacity-80" />
                    )}
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Select de Esporte e Botão Mudar Data */}
      <div className="flex items-end gap-2 md:gap-3">
        {/* Select de Esporte - Largura reduzida */}
        <div className="flex-1">
          <label htmlFor="esporte" className="text-xs text-text-muted mb-1 block">
            Esporte
          </label>
          <Select value={esporte} onValueChange={setEsporte} disabled={disabled}>
            <SelectTrigger className="w-full bg-surface/70 backdrop-blur-sm border-white/10 text-[15px] md:text-sm">
              <SelectValue placeholder="Selecione o esporte" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] z-[60]">
              {esportes.map((esp) => (
                <SelectItem key={esp} value={esp}>
                  {esp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Botão Mudar Data */}
        {onMudarData && (
          <motion.button
            type="button"
            onClick={onMudarData}
            disabled={disabled}
            whileHover={{ scale: disabled ? 1 : 1.05 }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
            className={`
              px-4 py-2.5 rounded-xl font-medium text-sm
              transition-all duration-300 shrink-0
              flex items-center gap-2
              ${
                disabled
                  ? 'bg-surface/30 text-text-muted cursor-not-allowed'
                  : 'bg-surface/70 backdrop-blur-sm border border-white/10 text-text-primary hover:bg-surface/90 hover:border-white/20'
              }
            `}
          >
            <Calendar className="w-4 h-4" />
            <span className="hidden md:inline">Mudar Data</span>
            <span className="md:hidden">Mudar Data</span>
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};
