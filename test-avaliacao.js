// Teste rápido do sistema de avaliação da ISIS
// Execute no console do navegador após chegar na tela de avaliação

// 1. Primeiro, teste as credenciais JSONBin
async function testarJsonBin() {
  const BIN_ID = '690605e5ae596e708f3c7bc5';
  const API_KEY = '$2a$10$/XmOGvx8./SZzV3qMzQ5i.6FjBjS4toNbeaEFzX2D8QPUddyM6VR2';
  
  console.log('🔍 Testando JSONBin...');
  
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Status JSONBin:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ JSONBin funcionando! Feedbacks existentes:', data.record['feedback-isis']?.length || 0);
      return true;
    } else {
      const error = await response.text();
      console.log('❌ JSONBin com erro:', error);
      return false;
    }
  } catch (error) {
    console.log('💥 Erro na requisição JSONBin:', error);
    return false;
  }
}

// 2. Teste o sistema de avaliação completo
async function testarSistemaAvaliacao() {
  console.log('🧪 Testando sistema de avaliação...');
  
  // Verifica se está na página da ISIS
  if (!window.location.href.includes('agendar')) {
    console.log('❌ Não está na página de agendamento da ISIS');
    return;
  }
  
  // Testa JSONBin primeiro
  const jsonBinOk = await testarJsonBin();
  
  // Simula dados de avaliação
  const avaliacaoTeste = {
    rating: 5,
    comentario: 'Teste do sistema de avaliação - pode ser removido',
    cliente_nome: 'Cliente Teste',
    empresa_nome: 'Arena Teste'
  };
  
  console.log('📝 Testando envio de feedback...');
  
  try {
    // Importa e testa o serviço diretamente
    const { adicionarFeedbackIsis } = await import('./src/lib/jsonbinService.js');
    
    const resultado = await adicionarFeedbackIsis(avaliacaoTeste);
    
    if (resultado) {
      console.log('✅ Sistema de avaliação funcionando!');
      console.log('📊 Feedback salvo:', resultado);
      
      if (jsonBinOk) {
        console.log('🌐 Salvo no JSONBin online');
      } else {
        console.log('💾 Salvo localmente (fallback)');
        
        // Mostra feedbacks locais
        const feedbacksLocais = JSON.parse(localStorage.getItem('isis-feedbacks') || '[]');
        console.log('📱 Feedbacks locais:', feedbacksLocais.length);
      }
      
      return true;
    }
  } catch (error) {
    console.log('❌ Erro no sistema de avaliação:', error);
    return false;
  }
}

// 3. Verifica estado atual da ISIS
function verificarEstadoIsis() {
  console.log('🔍 Verificando estado da ISIS...');
  
  // Verifica se há elementos da ISIS na página
  const isisElements = {
    chat: document.querySelector('[class*="isis"]') || document.querySelector('[class*="chat"]'),
    avatar: document.querySelector('img[alt*="Assistente"]') || document.querySelector('img[src*="isis"]'),
    input: document.querySelector('input[placeholder*="avalia"]') || document.querySelector('textarea'),
    estrelas: document.querySelectorAll('[class*="star"]') || document.querySelectorAll('svg[class*="star"]')
  };
  
  console.log('🎭 Elementos ISIS encontrados:');
  console.log('- Chat:', !!isisElements.chat);
  console.log('- Avatar:', !!isisElements.avatar);
  console.log('- Input:', !!isisElements.input);
  console.log('- Estrelas:', isisElements.estrelas.length);
  
  // Verifica console logs da ISIS
  const logs = performance.getEntriesByType('navigation');
  console.log('📊 Página carregada em:', logs[0]?.loadEventEnd - logs[0]?.loadEventStart, 'ms');
  
  return isisElements;
}

// 4. Função principal de teste
async function executarTestesCompletos() {
  console.log('🚀 Iniciando testes completos da ISIS...');
  console.log('=====================================');
  
  // 1. Verifica estado
  verificarEstadoIsis();
  
  // 2. Testa sistema
  await testarSistemaAvaliacao();
  
  console.log('=====================================');
  console.log('✅ Testes concluídos!');
  console.log('💡 Dica: Os erros de WebSocket são do Vite (desenvolvimento) e não afetam a ISIS');
}

// Execute no console:
// executarTestesCompletos()

// Ou execute partes individuais:
// testarJsonBin()
// verificarEstadoIsis()
// testarSistemaAvaliacao()
