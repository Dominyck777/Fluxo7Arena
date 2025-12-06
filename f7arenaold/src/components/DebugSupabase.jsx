import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const DebugSupabase = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { authReady, user, userProfile, company } = useAuth();

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Testar conexão básica
      const { data, error: companyError } = await supabase
        .from('companies')
        .select('*');
      
      if (companyError) throw companyError;
      
      setCompanies(data);
      console.log('Companies found:', data);

      // Evitar chamada direta ao SDK aqui; usar contexto de auth
      console.log('Auth context:', { authReady, user, userProfile, company });
      
    } catch (err) {
      setError(err.message);
      console.error('Supabase error:', err);
    } finally {
      setLoading(false);
    }
  };

  const testCompanyCode = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('company_code', '999')
        .single();
      
      console.log('Company 999:', data);
      if (error) console.error('Company error:', error);
      
    } catch (err) {
      console.error('Test error:', err);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="p-4 bg-surface rounded-lg border border-border">
      <h3 className="text-lg font-bold text-text-primary mb-4">Debug Supabase</h3>
      
      {error && (
        <div className="bg-danger/20 border border-danger/50 rounded p-3 mb-4">
          <p className="text-danger font-medium">Erro: {error}</p>
        </div>
      )}
      
      <div className="space-y-4">
        <Button onClick={testConnection} disabled={loading}>
          {loading ? 'Testando...' : 'Testar Conexão'}
        </Button>
        
        <Button onClick={testCompanyCode} variant="outline">
          Testar Código 999
        </Button>
        
        {companies.length > 0 && (
          <div>
            <h4 className="font-semibold text-text-primary mb-2">Empresas encontradas:</h4>
            <pre className="bg-background p-3 rounded text-xs overflow-auto">
              {JSON.stringify(companies, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugSupabase;
