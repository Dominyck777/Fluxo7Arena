import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, Eye, EyeOff, Mail, Lock, LogIn } from 'lucide-react';

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const { signIn, user, authReady } = useAuth();
  const { toast } = useToast();

  // Se já estiver autenticado, redireciona para a página principal
  useEffect(() => {
    if (authReady && user) {
      try {
        window.location.replace('/');
      } catch {}
    }
  }, [authReady, !!user]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn(formData.email, formData.password);

      if (result.error) throw result.error;

      toast({
        title: 'Login realizado!',
        description: 'Bem-vindo de volta!',
        variant: 'default',
      });

      // Redireciona imediatamente após sucesso
      try {
        window.location.replace('/');
      } catch {}

    } catch (error) {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro. Tente novamente.",
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

  return (
    <>
      <Helmet>
        <title>Login - Fluxo7 Arena</title>
        <meta name="description" content="Acesse sua conta do Fluxo7 Arena" />
      </Helmet>

      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-court-pattern opacity-[0.02] mix-blend-overlay"></div>
        
        <motion.div
          variants={pageVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 w-full max-w-md"
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

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-text-primary flex items-center gap-2">
                  <Mail className="w-4 h-4" />
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
                  className="placeholder:text-[#B0B0B0]"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-text-primary flex items-center gap-2">
                  <Lock className="w-4 h-4" />
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
                    className="pr-10 placeholder:text-[#B0B0B0]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
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
            © 2025 Fluxo7 Arena — Todos os direitos reservados.
          </p>

        </motion.div>
      </div>
    </>
  );
};

export default LoginPage;
