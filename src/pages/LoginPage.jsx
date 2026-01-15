import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, Eye, EyeOff, Mail, Lock, LogIn } from 'lucide-react';

// Traduções de erros comuns do Supabase
const translateError = (errorMessage) => {
  const translations = {
    'Invalid login credentials': 'Email ou senha incorretos',
    'Email not confirmed': 'Email não confirmado',
    'User not found': 'Usuário não encontrado',
    'Invalid email': 'Email inválido',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
    'Unable to validate email address: invalid format': 'Formato de email inválido',
    'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos',
    'Network request failed': 'Erro de conexão. Verifique sua internet',
    'Failed to fetch': 'Erro de conexão. Verifique sua internet',
  };

  // Procura por correspondência exata
  if (translations[errorMessage]) {
    return translations[errorMessage];
  }

  // Procura por correspondência parcial
  for (const [key, value] of Object.entries(translations)) {
    if (errorMessage.includes(key)) {
      return value;
    }
  }

  // Retorna mensagem genérica se não encontrar tradução
  return 'Erro ao fazer login. Verifique suas credenciais e tente novamente.';
};

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const { signIn, user, authReady } = useAuth();
  const { toast } = useToast();

  // Se já estiver autenticado, redireciona para a página original ou principal
  useEffect(() => {
    if (authReady && user) {
      try {
        const returnUrl = sessionStorage.getItem('auth:returnUrl');
        sessionStorage.removeItem('auth:returnUrl');
        const targetUrl = returnUrl || '/';
        console.log('[LoginPage] Redirecionando para:', targetUrl);
        window.location.replace(targetUrl);
      } catch {}
    }
  }, [authReady, !!user]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Limpa o erro quando o usuário começar a digitar
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(''); // Limpa erro anterior

    try {
      const result = await signIn(formData.email, formData.password);

      if (result.error) throw result.error;

      toast({
        title: 'Login realizado!',
        description: 'Bem-vindo de volta!',
        variant: 'default',
      });

      // Redireciona para a rota original ou página principal
      try {
        const returnUrl = sessionStorage.getItem('auth:returnUrl');
        sessionStorage.removeItem('auth:returnUrl');
        const targetUrl = returnUrl || '/';
        console.log('[LoginPage] Redirecionando após login para:', targetUrl);
        window.location.replace(targetUrl);
      } catch {}

    } catch (error) {
      const originalMessage = error.message || "Ocorreu um erro. Tente novamente.";
      const translatedMessage = translateError(originalMessage);
      
      setError(translatedMessage); // Define erro traduzido visível
      
      toast({
        title: "Erro",
        description: translatedMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const pageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
    }
  };

  const isDevTarget = (() => {
    try { return typeof window !== 'undefined' && String(window.__ACTIVE_TARGET || '').toLowerCase() === 'dev'; } catch { return false; }
  })();

  return (
    <>
      <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 relative">
        {isDevTarget && (
          <div className="pointer-events-none select-none absolute top-4 right-4 z-20">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-red-600 text-white shadow animate-pulse">
              Dev
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-court-pattern opacity-[0.02] mix-blend-overlay"></div>
        
        <motion.div
          variants={pageVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 w-full max-w-md pb-20 sm:pb-0"
        >
          {/* Card with Logo + Form */}
          <div className="fx-card">
            {/* Header inside card */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-brand rounded-xl flex items-center justify-center mr-4">
                  <Trophy className="w-8 h-8 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-5xl font-extrabold">
                    <span style={{ color: '#FF6600' }}>Fluxo</span>
                    <span style={{ color: '#FFAA33' }}>7</span>
                  </h1>
                  <p className="text-2xl font-semibold" style={{ color: '#B0B0B0' }}>Arena</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-text-primary flex items-center gap-2 text-sm sm:text-base">
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="placeholder:text-[#B0B0B0] h-12 sm:h-10 text-base sm:text-sm"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-text-primary flex items-center gap-2 text-sm sm:text-base">
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Sua senha"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="pr-10 placeholder:text-[#B0B0B0] h-12 sm:h-10 text-base sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5 sm:w-4 sm:h-4" /> : <Eye className="w-5 h-5 sm:w-4 sm:h-4" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base">⚠️</span>
                    <span className="flex-1">{error}</span>
                  </div>
                </motion.div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 sm:h-10 text-base sm:text-sm"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                    Entrando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Entrar
                  </div>
                )}
              </Button>
            </form>
          </div>

          {/* Subtle copyright */}
          <p className="mt-4 text-center text-xs text-text-muted opacity-70">
            © 2026 Fluxo7 Arena — Todos os direitos reservados.
          </p>

        </motion.div>
      </div>
    </>
  );
};

export default LoginPage;
