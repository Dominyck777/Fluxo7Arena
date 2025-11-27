/**
 * Utilitário para testar a integração com JSONBin
 * Execute no console do navegador para verificar se está funcionando
 */

import { adicionarFeedbackIsis, getFeedbacksIsis } from '@/lib/jsonbinService';

// Teste básico de conexão
export const testarConexaoJsonBin = async () => {
  try {
    console.log('🧪 Testando conexão com JSONBin...');
    
    // Tenta buscar feedbacks existentes
    const feedbacks = await getFeedbacksIsis();
    console.log('✅ Conexão OK! Feedbacks encontrados:', feedbacks.length);
    
    return true;
  } catch (error) {
    console.error('❌ Erro na conexão:', error);
    return false;
  }
};

// Teste de adição de feedback
export const testarAdicionarFeedback = async () => {
  try {
    console.log('🧪 Testando adição de feedback...');
    
    const feedbackTeste = {
      rating: 5,
      comentario: 'Teste de feedback da ISIS - pode ser removido',
      cliente_nome: 'Cliente Teste',
      empresa_nome: 'Arena Teste'
    };
    
    const resultado = await adicionarFeedbackIsis(feedbackTeste);
    console.log('✅ Feedback adicionado com sucesso:', resultado.id);
    
    return resultado;
  } catch (error) {
    console.error('❌ Erro ao adicionar feedback:', error);
    return null;
  }
};

// Executa todos os testes
export const executarTodosOsTestes = async () => {
  console.log('🚀 Iniciando testes do JSONBin...');
  
  const conexaoOk = await testarConexaoJsonBin();
  if (!conexaoOk) {
    console.log('❌ Testes interrompidos - problema na conexão');
    return;
  }
  
  const feedbackAdicionado = await testarAdicionarFeedback();
  if (feedbackAdicionado) {
    console.log('✅ Todos os testes passaram!');
  } else {
    console.log('❌ Falha no teste de adição');
  }
};

// Para usar no console:
// import { executarTodosOsTestes } from './src/utils/testJsonBin.js';
// executarTodosOsTestes();
