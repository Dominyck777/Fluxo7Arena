import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

function parseHashParams(hash) {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  return { access_token, refresh_token };
}

const ResetPasswordPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const tokens = useMemo(() => parseHashParams(window.location.hash), []);

  useEffect(() => {
    const ensureSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
        return;
      }
      // Try to set session using tokens from the URL fragment
      if (tokens.access_token && tokens.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });
        if (error) {
          toast({ title: 'Link inválido ou expirado', description: 'Abra o link do email novamente.', variant: 'destructive' });
        }
        setReady(!!data?.session);
      } else {
        // No session and no tokens
        toast({ title: 'Link inválido', description: 'Abra o link de redefinição enviado por email.', variant: 'destructive' });
      }
    };
    ensureSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'A senha deve ter pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Senhas não conferem', description: 'As senhas digitadas são diferentes.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ title: 'Erro ao redefinir senha', description: error.message || 'Tente novamente.', variant: 'destructive' });
      return;
    }

    toast({ title: 'Senha redefinida', description: 'Você já pode acessar o sistema.', variant: 'default' });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface rounded-xl border border-border p-6 shadow">
        <h1 className="text-2xl font-semibold mb-2 text-text-primary">Redefinir senha</h1>
        <p className="text-sm text-text-secondary mb-6">Defina uma nova senha para sua conta.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-text-secondary">Nova senha</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" disabled={!ready || loading} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-text-secondary">Confirmar nova senha</label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" disabled={!ready || loading} />
          </div>
          <Button type="submit" className="w-full" disabled={!ready || loading}>
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
