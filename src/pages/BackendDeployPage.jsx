import React, { useEffect, useState } from 'react';
import { Save, Edit } from 'lucide-react';

export default function BackendDeployPage() {
  const [maintenance, setMaintenance] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('Manutenção em andamento. Volte em breve!');
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState('');

  // Carrega configurações ao iniciar
  useEffect(() => {
    try {
      const maintActive = localStorage.getItem('maintenance:active') === 'false';
      const storedEnd = localStorage.getItem('maintenance:end') || '';
      const storedMsg = localStorage.getItem('maintenance:message') || 'Manutenção em andamento. Volte em breve!';
      
      setMaintenance(maintActive);
      setEndDate(storedEnd);
      setMessage(storedMsg);
    } catch {}
  }, []);
  

  const saveSettings = (e) => {
    e?.preventDefault();
    
    // Validações básicas
    if (maintenance && !endDate) {
      alert('Defina uma data de término para a manutenção');
      return;
    }
    
    // Salva tudo no localStorage
    localStorage.setItem('maintenance:active', maintenance);
    localStorage.setItem('maintenance:end', endDate);
    localStorage.setItem('maintenance:message', message);
    
    // Forçar atualização em outras abas
    window.dispatchEvent(new Event('storage'));
    
    setShowForm(false);
    setSaved('✅ Configurações salvas!');
    setTimeout(() => setSaved(''), 3000);
  };

  const toggleMaintenance = () => {
    const newStatus = !maintenance;
    setMaintenance(newStatus);
    localStorage.setItem('maintenance:active', String(newStatus));
    if (newStatus && !endDate) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const defaultEnd = d.toISOString().slice(0, 16);
      setEndDate(defaultEnd);
      localStorage.setItem('maintenance:end', defaultEnd);
    }
    window.dispatchEvent(new Event('storage'));
    setSaved(newStatus ? '✅ Modo manutenção ATIVADO' : '✅ Modo manutenção DESATIVADO');
    setTimeout(() => setSaved(''), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg mt-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Controle de Manutenção</h1>
        <button
          onClick={toggleMaintenance}
          className={`inline-flex items-center px-4 py-2 rounded-md font-medium ${
            maintenance 
              ? 'bg-red-100 text-red-700 hover:bg-red-200' 
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          {maintenance ? 'Manutenção ATIVA' : 'Manutenção INATIVA'}
        </button>
      </div>

      {maintenance && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-medium text-lg">Configurações</h2>
            <button 
              onClick={() => setShowForm(!showForm)}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
            >
              <Edit className="w-4 h-4" />
              {showForm ? 'Ocultar' : 'Editar'}
            </button>
          </div>

          {showForm ? (
            <form onSubmit={saveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Término
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    min={new Date().toISOString().slice(0, 16)}
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensagem de Manutenção
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Ex: Estamos em manutenção programada. Volte em breve!"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="inline w-4 h-4 mr-1" />
                  Salvar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-700">Término:</span>
                <p className="text-gray-900">
                  {endDate ? new Date(endDate).toLocaleString() : 'Não definido'}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Mensagem:</span>
                <p className="text-gray-900 whitespace-pre-line">{message}</p>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <h3 className="font-medium mb-2">Como usar:</h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Ative/desative o botão no topo</li>
          <li>Defina a data de término e uma mensagem amigável</li>
          <li>Salve as configurações</li>
          <li>Para acessar durante a manutenção, use a senha no link</li>
        </ol>
      </div>

      {saved && (
        <div className="fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-lg">
          {saved}
        </div>
      )}
    </div>
  );
}
