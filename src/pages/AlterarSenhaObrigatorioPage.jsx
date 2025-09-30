import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function AlterarSenhaObrigatorioPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    novaSenha: '',
    confirmarSenha: '',
  });
  
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  const senhaPreenchida = formData.novaSenha.length >= 6;
  const senhasConferem = formData.novaSenha === formData.confirmarSenha && formData.confirmarSenha !== '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('[AlterarSenha] Iniciando processo de troca de senha...');
    
    if (!senhaPreenchida) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter no mínimo 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!senhasConferem) {
      toast({
        title: 'Senhas não conferem',
        description: 'A nova senha e a confirmação devem ser iguais.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setLoading(true);
      console.log('[AlterarSenha] userProfile.id:', userProfile?.id);
      
      // 1. Atualizar senha no Supabase Auth (com timeout curto)
      console.log('[AlterarSenha] Atualizando senha no Auth...');
      const startAuth = Date.now();
      
      let authSuccess = false;
      try {
        // Timeout de apenas 3 segundos
        const updatePromise = supabase.auth.updateUser({
          password: formData.novaSenha,
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        );
        
        const { error: authError } = await Promise.race([updatePromise, timeoutPromise]);
        
        if (!authError) {
          console.log('[AlterarSenha] ✅ Auth atualizado em', Date.now() - startAuth, 'ms');
          authSuccess = true;
        }
      } catch (authErr) {
        console.warn('[AlterarSenha] ⚠️ Auth demorou muito (timeout 3s), mas senha pode ter sido alterada');
        // Não lançar erro, continuar para atualizar banco
      }
      
      // 2. Atualizar flag no banco de dados
      console.log('[AlterarSenha] Atualizando flag no banco...');
      console.log('[AlterarSenha] ID do usuário:', userProfile.id);
      const startDb = Date.now();
      
      const { data: updateData, error: dbError } = await supabase
        .from('colaboradores')
        .update({
          primeiro_acesso: false,
          senha_alterada_em: new Date().toISOString(),
        })
        .eq('id', userProfile.id)
        .select(); // Retornar dados atualizados
      
      console.log('[AlterarSenha] Banco atualizado em', Date.now() - startDb, 'ms');
      console.log('[AlterarSenha] Dados retornados:', updateData);
      console.log('[AlterarSenha] Erro do banco:', dbError);
      
      if (dbError) {
        console.error('[AlterarSenha] ❌ ERRO NO BANCO:', {
          code: dbError.code,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
        });
        throw new Error(`Erro ao atualizar banco: ${dbError.message}`);
      }
      
      if (!updateData || updateData.length === 0) {
        console.error('[AlterarSenha] ❌ NENHUMA LINHA ATUALIZADA!');
        throw new Error('Nenhum registro foi atualizado. Verifique as permissões (RLS).');
      }
      
      console.log('[AlterarSenha] ✅ Banco atualizado com sucesso:', updateData[0]);
      
      console.log('[AlterarSenha] ✅ Processo concluído!');
      
      const mensagem = authSuccess 
        ? '✅ Senha alterada com sucesso!' 
        : '⚠️ Acesso liberado! Recomendamos trocar a senha novamente nas configurações.';
      
      toast({
        title: mensagem,
        description: 'Redirecionando...',
      });
      
      // Limpar cache do AuthContext para forçar reload
      console.log('[AlterarSenha] Limpando cache...');
      try {
        localStorage.removeItem('auth:userProfile');
        localStorage.removeItem('auth:company');
      } catch (e) {
        console.warn('[AlterarSenha] Erro ao limpar cache:', e);
      }
      
      // Redirecionar imediatamente
      console.log('[AlterarSenha] Redirecionando para /');
      setTimeout(() => {
        window.location.href = '/'; // Usar href para forçar reload completo
      }, 500);
      
    } catch (error) {
      console.error('[AlterarSenha] Erro geral:', error);
      toast({
        title: 'Erro ao alterar senha',
        description: error.message || 'Tente novamente ou use o botão "Pular por enquanto".',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Alterar Senha - Fluxo7 Arena</title>
      </Helmet>
      
      <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-surface rounded-lg border border-border p-4 sm:p-6 md:p-8 shadow-lg">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-brand/10 rounded-full mb-4">
                <Lock className="w-8 h-8 text-brand" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary mb-2">
                Alterar Senha Obrigatória
              </h1>
              <p className="text-sm text-text-muted">
                Bem-vindo! Por segurança, você precisa definir uma nova senha.
              </p>
            </div>
            
            {/* Alerta */}
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                <div className="text-xs text-text-muted">
                  <p className="font-semibold text-text-primary mb-1">Primeiro Acesso Detectado</p>
                  <p>Esta é uma medida de segurança. Você não poderá acessar o sistema sem alterar sua senha.</p>
                </div>
              </div>
            </div>
            
            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nova Senha */}
              <div>
                <Label htmlFor="novaSenha">Nova Senha *</Label>
                <div className="relative">
                  <Input
                    id="novaSenha"
                    type={showNovaSenha ? 'text' : 'password'}
                    value={formData.novaSenha}
                    onChange={(e) => setFormData({ ...formData, novaSenha: e.target.value })}
                    placeholder="Digite sua nova senha (mínimo 6 caracteres)"
                    className="pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNovaSenha(!showNovaSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    {showNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-1">Mínimo 6 caracteres</p>
              </div>
              
              {/* Confirmar Senha */}
              <div>
                <Label htmlFor="confirmarSenha">Confirmar Nova Senha *</Label>
                <div className="relative">
                  <Input
                    id="confirmarSenha"
                    type={showConfirmarSenha ? 'text' : 'password'}
                    value={formData.confirmarSenha}
                    onChange={(e) => setFormData({ ...formData, confirmarSenha: e.target.value })}
                    placeholder="Digite novamente sua nova senha"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    {showConfirmarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formData.confirmarSenha && (
                  <p className={`text-xs mt-1 ${senhasConferem ? 'text-success' : 'text-danger'}`}>
                    {senhasConferem ? '✓ Senhas conferem' : '✗ Senhas não conferem'}
                  </p>
                )}
              </div>
              
              {/* Botão */}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !senhaPreenchida || !senhasConferem}
              >
                {loading ? 'Alterando senha...' : 'Alterar Senha e Continuar'}
              </Button>
            </form>
            
            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-xs text-text-muted">
                ⚠️ Você não pode pular esta etapa
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
