import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function FinalizadorasPage() {
  const { userProfile } = useAuth();
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Finalizadoras</h1>
      <p>Página de Finalizadoras - Em desenvolvimento</p>
      <p>Usuário: {userProfile?.email || 'Não autenticado'}</p>
    </div>
  );
}
