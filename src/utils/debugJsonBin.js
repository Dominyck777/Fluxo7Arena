/**
 * Utilitário para debug e teste das credenciais JSONBin
 */

// Função para testar as credenciais
export const testarCredenciaisJsonBin = async () => {
  const BIN_ID = import.meta.env.VITE_JSONBIN_BIN_ID;
  const API_KEY = import.meta.env.VITE_JSONBIN_API_KEY;
  
  console.log('🔍 Testando credenciais JSONBin...');
  console.log('BIN_ID:', BIN_ID);
  console.log('API_KEY presente:', !!API_KEY);
  console.log('API_KEY primeiros chars:', API_KEY?.substring(0, 10) + '...');
  
  if (!BIN_ID || !API_KEY) {
    console.error('❌ Variáveis de ambiente não configuradas');
    return false;
  }
  
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Status da resposta:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Credenciais válidas! Dados:', data);
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Erro na resposta:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro na requisição:', error);
    return false;
  }
};

// Função para listar bins da conta (se a chave for válida)
export const listarBinsDaConta = async () => {
  const API_KEY = import.meta.env.VITE_JSONBIN_API_KEY;
  
  if (!API_KEY) {
    console.error('❌ API_KEY não configurada');
    return;
  }
  
  try {
    const response = await fetch('https://api.jsonbin.io/v3/b', {
      method: 'GET',
      headers: {
        'X-Master-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('📦 Bins disponíveis:', data);
      return data;
    } else {
      const errorText = await response.text();
      console.error('❌ Erro ao listar bins:', response.status, errorText);
    }
  } catch (error) {
    console.error('❌ Erro na requisição:', error);
  }
};

// Função para criar um novo bin de teste
export const criarBinTeste = async () => {
  const API_KEY = import.meta.env.VITE_JSONBIN_API_KEY;
  
  if (!API_KEY) {
    console.error('❌ API_KEY não configurada');
    return;
  }
  
  const dadosIniciais = {
    "feedback-isis": [],
    "devs": [
      {
        "id": "dominyck",
        "name": "Dominyck", 
        "password": "777",
        "role": "admin",
        "active": true
      }
    ]
  };
  
  try {
    const response = await fetch('https://api.jsonbin.io/v3/b', {
      method: 'POST',
      headers: {
        'X-Master-Key': API_KEY,
        'Content-Type': 'application/json',
        'X-Bin-Name': 'fluxo7arena-isis-feedback'
      },
      body: JSON.stringify(dadosIniciais)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Novo bin criado:', data);
      console.log('🔑 Use este BIN_ID:', data.metadata.id);
      return data;
    } else {
      const errorText = await response.text();
      console.error('❌ Erro ao criar bin:', response.status, errorText);
    }
  } catch (error) {
    console.error('❌ Erro na requisição:', error);
  }
};

// Execute no console do navegador:
// import { testarCredenciaisJsonBin, listarBinsDaConta, criarBinTeste } from './src/utils/debugJsonBin.js';
// await testarCredenciaisJsonBin();
// await listarBinsDaConta();
// await criarBinTeste();
