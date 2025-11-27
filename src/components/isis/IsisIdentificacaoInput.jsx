import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, Send, Calendar } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Input de identificação com máscara (telefone, email ou data) - Estilo Ísis
 */
export const IsisIdentificacaoInput = ({ onSubmit, tipo, onTrocarTipo, disabled = false, mostrarBotaoTrocar = true }) => {
  const [valor, setValor] = useState('');
  const [focused, setFocused] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Limpa o input quando o tipo muda
  useEffect(() => {
    setValor('');
  }, [tipo]);

  // Handler para seleção de data no calendário
  const handleCalendarSelect = (date) => {
    if (date) {
      const dataFormatada = format(date, 'dd/MM/yyyy', { locale: ptBR });
      setValor(dataFormatada);
      setCalendarOpen(false);
    }
  };

  // Máscara de telefone: (00) 00000-0000 (apenas para 11 dígitos)
  const aplicarMascaraTelefone = (value) => {
    const numeros = value.replace(/\D/g, '');
    
    if (numeros.length <= 2) {
      return `(${numeros}`;
    } else if (numeros.length <= 7) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    } else if (numeros.length === 10) {
      // 10 dígitos: formato incompleto (34) 9895-3094 (sem hífen final)
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
    } else if (numeros.length === 11) {
      // 11 dígitos: formato completo (34) 99895-3094
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
    }
    
    // Limita a 11 dígitos
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
  };

  // Máscara de data: DD/MM/AAAA
  const aplicarMascaraData = (value) => {
    const numeros = value.replace(/\D/g, '');
    
    if (numeros.length <= 2) {
      return numeros;
    } else if (numeros.length <= 4) {
      return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
    } else if (numeros.length <= 8) {
      return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4)}`;
    }
    
    // Limita a 8 dígitos (DDMMAAAA)
    return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4, 8)}`;
  };

  const handleChange = (e) => {
    const value = e.target.value;
    
    if (tipo === 'telefone') {
      // Permite apenas números e caracteres da máscara
      const mascarado = aplicarMascaraTelefone(value);
      setValor(mascarado);
    } else if (tipo === 'data_custom') {
      // Data customizada - aplica máscara DD/MM/AAAA
      const mascarado = aplicarMascaraData(value);
      setValor(mascarado);
    } else {
      // Email sem máscara
      setValor(value);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!valor.trim() || disabled) return;
    
    if (tipo === 'telefone') {
      // Remove máscara antes de enviar
      const numeroLimpo = valor.replace(/\D/g, '');
      if (numeroLimpo.length === 11) {
        onSubmit(numeroLimpo);
        setValor('');
      }
    } else if (tipo === 'data_custom') {
      // Data customizada - envia como está
      if (valor.trim()) {
        onSubmit(valor.trim());
        setValor('');
      }
    } else {
      // Valida email básico
      if (valor.includes('@') && valor.includes('.')) {
        onSubmit(valor.trim());
        setValor('');
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Valida se a data é válida e não está no passado
  const validarData = (dataTexto) => {
    if (dataTexto.length !== 10) return { valida: false, erro: 'Data incompleta' };
    
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dataTexto.match(regex);
    
    if (!match) return { valida: false, erro: 'Formato inválido' };

    const [, dia, mes, ano] = match;
    const dataEscolhida = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    
    // Valida se a data é válida
    if (isNaN(dataEscolhida.getTime()) || 
        dataEscolhida.getDate() !== parseInt(dia) ||
        dataEscolhida.getMonth() !== parseInt(mes) - 1 ||
        dataEscolhida.getFullYear() !== parseInt(ano)) {
      return { valida: false, erro: 'Data inválida' };
    }

    // Valida se a data não é no passado
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    dataEscolhida.setHours(0, 0, 0, 0);
    
    if (dataEscolhida < hoje) {
      return { valida: false, erro: 'Data no passado' };
    }

    return { valida: true, erro: null };
  };

  const isValid = () => {
    if (tipo === 'telefone') {
      const numeroLimpo = valor.replace(/\D/g, '');
      // Apenas celular brasileiro: 11 dígitos (DDD + 9 + 8 dígitos)
      return numeroLimpo.length === 11;
    } else if (tipo === 'data_custom') {
      // Data customizada - validação completa
      return validarData(valor).valida;
    } else {
      return valor.includes('@') && valor.includes('.');
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 max-w-md mx-auto"
    >
      {/* Input Principal */}
      <div className="relative">
        <div className={`
          flex items-center gap-2 px-3 py-2.5 rounded-xl
          bg-surface/70 backdrop-blur-sm
          border-2 transition-all duration-300
          ${focused ? 'border-brand/50 shadow-lg shadow-brand/10' : 'border-white/10 shadow-md'}
        `}>
          {/* Ícone */}
          {tipo !== 'data_custom' && (
            <div className={`
              shrink-0 transition-colors duration-300
              ${focused ? 'text-brand' : 'text-text-muted'}
            `}>
              {tipo === 'telefone' ? (
                <Phone className="w-4 h-4" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
            </div>
          )}

          {/* Container do Input com Calendário */}
          <div className="flex-1 relative flex items-center">
            {/* Input */}
            <input
              type={tipo === 'data_custom' ? 'text' : tipo === 'telefone' ? 'tel' : 'email'}
              value={valor}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={
                tipo === 'telefone' ? '(00) 00000-0000' : 
                tipo === 'data_custom' ? 'DD/MM/AAAA' : 
                'email@exemplo.com'
              }
              disabled={disabled}
              className={`
                w-full bg-transparent text-text-primary placeholder:text-text-muted
                outline-none text-[17px] md:text-base font-medium
                ${tipo === 'data_custom' ? 'pr-12' : ''}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            />

            {/* Botão de Calendário - apenas para data customizada */}
            {tipo === 'data_custom' && (
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    disabled={disabled}
                    className={`
                      absolute right-1 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300
                      bg-brand/10 text-brand hover:bg-brand hover:text-white
                      border border-brand/20 hover:border-brand/40
                      shadow-md hover:shadow-lg hover:shadow-brand/30
                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <Calendar className="w-5 h-5" />
                  </motion.button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent 
                    mode="single" 
                    selected={valor ? (() => {
                      try {
                        const [dia, mes, ano] = valor.split('/');
                        return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
                      } catch {
                        return undefined;
                      }
                    })() : undefined}
                    onSelect={handleCalendarSelect}
                    disabled={(date) => {
                      // Desabilita datas no passado
                      const hoje = new Date();
                      hoje.setHours(0, 0, 0, 0);
                      return date < hoje;
                    }}
                    initialFocus 
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Botão Submit - Estilo WhatsApp */}
          <motion.button
            type="submit"
            whileHover={{ scale: isValid() ? 1.1 : 1 }}
            whileTap={{ scale: isValid() ? 0.9 : 1 }}
            disabled={!isValid() || disabled}
            className={`
              shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300
              ${
                isValid()
                  ? 'bg-brand text-bg shadow-md hover:shadow-lg hover:shadow-brand/30'
                  : 'bg-surface-light text-text-muted cursor-not-allowed opacity-50'
              }
            `}
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Indicador de progresso para telefone */}
      {tipo === 'telefone' && valor && (
        <div className="text-xs text-center">
          {(() => {
            const numeroLimpo = valor.replace(/\D/g, '');
            const isComplete = numeroLimpo.length === 11;
            const isIncomplete = numeroLimpo.length > 0 && !isComplete;
            
            if (isComplete) {
              return (
                <span className="text-green-400 flex items-center justify-center gap-1">
                  ✓ Telefone válido
                </span>
              );
            } else if (isIncomplete) {
              return (
                <span className="text-yellow-400 flex items-center justify-center gap-1">
                  ⚠️ Digite todos os dígitos ({numeroLimpo.length}/11)
                </span>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Indicador de progresso para data */}
      {tipo === 'data_custom' && valor && (
        <div className="text-xs text-center">
          {(() => {
            const validacao = validarData(valor);
            
            if (validacao.valida) {
              return (
                <span className="text-green-400 flex items-center justify-center gap-1">
                  ✓ Data válida
                </span>
              );
            } else if (valor.length > 0) {
              return (
                <span className="text-red-400 flex items-center justify-center gap-1">
                  ❌ {validacao.erro}
                </span>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Botão para trocar tipo - não mostra para data customizada */}
      {mostrarBotaoTrocar && tipo !== 'data_custom' && (
        <button
          type="button"
          onClick={onTrocarTipo}
          className="text-sm text-brand/80 hover:text-brand hover:underline self-center py-1 px-3 rounded-lg hover:bg-brand/5 transition-all"
        >
          {tipo === 'telefone' ? (
            <span className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Prefiro usar e-mail
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Prefiro usar telefone
            </span>
          )}
        </button>
      )}
    </motion.form>
  );
};
