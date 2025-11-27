import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Phone, Mail } from 'lucide-react';

/**
 * Formulário completo de cadastro (nome, telefone, email) - Estilo Ísis
 */
export const IsisCadastroInput = ({ onSubmit, disabled = false, valorInicial = null, tipoInicial = 'telefone' }) => {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState(tipoInicial === 'telefone' ? valorInicial || '' : '');
  const [email, setEmail] = useState(tipoInicial === 'email' ? valorInicial || '' : '');
  const [focusedField, setFocusedField] = useState(null);

  // Máscara de telefone: (00) 00000-0000
  const aplicarMascaraTelefone = (value) => {
    const numeros = value.replace(/\D/g, '');
    
    if (numeros.length <= 2) {
      return `(${numeros}`;
    } else if (numeros.length <= 7) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    } else if (numeros.length <= 11) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
    }
    
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
  };

  const handleTelefoneChange = (e) => {
    const mascarado = aplicarMascaraTelefone(e.target.value);
    setTelefone(mascarado);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      return;
    }
    
    // Precisa de pelo menos telefone ou email
    const telefoneValido = telefone.replace(/\D/g, '').length >= 10;
    const emailValido = email.trim().includes('@') && email.trim().includes('.');
    
    if (!telefoneValido && !emailValido) {
      return;
    }
    
    const dados = {
      nome: nome.trim(),
      telefone: telefoneValido ? telefone.replace(/\D/g, '') : null,
      email: emailValido ? email.trim() : null
    };
    
    onSubmit(dados);
  };

  const isValid = () => {
    if (!nome.trim()) return false;
    
    const telefoneValido = telefone.replace(/\D/g, '').length >= 10;
    const emailValido = email.trim().includes('@') && email.trim().includes('.');
    
    return telefoneValido || emailValido;
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      {/* Campo Nome */}
      <div className={`
        flex items-center gap-3 px-4 py-3 rounded-2xl
        bg-surface/70 backdrop-blur-sm
        border-2 transition-all duration-300
        ${focusedField === 'nome' ? 'border-brand/50 shadow-lg shadow-brand/10' : 'border-white/10 shadow-md'}
      `}>
        <User className={`w-5 h-5 transition-colors ${focusedField === 'nome' ? 'text-brand' : 'text-text-muted'}`} />
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onFocus={() => setFocusedField('nome')}
          onBlur={() => setFocusedField(null)}
          placeholder="Seu nome completo"
          disabled={disabled}
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none text-[17px] md:text-base font-medium"
        />
      </div>

      {/* Campo Telefone */}
      <div className={`
        flex items-center gap-3 px-4 py-3 rounded-2xl
        bg-surface/70 backdrop-blur-sm
        border-2 transition-all duration-300
        ${focusedField === 'telefone' ? 'border-brand/50 shadow-lg shadow-brand/10' : 'border-white/10 shadow-md'}
      `}>
        <Phone className={`w-5 h-5 transition-colors ${focusedField === 'telefone' ? 'text-brand' : 'text-text-muted'}`} />
        <input
          type="tel"
          value={telefone}
          onChange={handleTelefoneChange}
          onFocus={() => setFocusedField('telefone')}
          onBlur={() => setFocusedField(null)}
          placeholder="(00) 00000-0000"
          disabled={disabled}
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none text-[17px] md:text-base font-medium"
        />
      </div>

      {/* Campo Email (opcional) */}
      <div className={`
        flex items-center gap-3 px-4 py-3 rounded-2xl
        bg-surface/70 backdrop-blur-sm
        border-2 transition-all duration-300
        ${focusedField === 'email' ? 'border-brand/50 shadow-lg shadow-brand/10' : 'border-white/10 shadow-md'}
      `}>
        <Mail className={`w-5 h-5 transition-colors ${focusedField === 'email' ? 'text-brand' : 'text-text-muted'}`} />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setFocusedField('email')}
          onBlur={() => setFocusedField(null)}
          placeholder="email@exemplo.com (opcional)"
          disabled={disabled}
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none text-[17px] md:text-base font-medium"
        />
      </div>

      {/* Botão Submit */}
      <motion.button
        type="submit"
        whileHover={{ scale: isValid() ? 1.02 : 1 }}
        whileTap={{ scale: isValid() ? 0.98 : 1 }}
        disabled={!isValid() || disabled}
        className={`
          flex items-center justify-center gap-2 py-3 px-6 rounded-2xl
          font-semibold text-base transition-all duration-300
          ${
            isValid()
              ? 'bg-brand text-bg shadow-lg shadow-brand/20 hover:shadow-xl hover:shadow-brand/30'
              : 'bg-surface-light text-text-muted cursor-not-allowed opacity-50'
          }
        `}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
          />
        </svg>
        Continuar
      </motion.button>

      {/* Dica */}
      <p className="text-xs text-text-muted text-center">
        Preencha pelo menos telefone ou e-mail
      </p>
    </motion.form>
  );
};
