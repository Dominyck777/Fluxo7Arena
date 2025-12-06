// Debug do fluxo da ISIS - Execute no console do navegador
// Para identificar onde está travando o fluxo

function debugIsisFlow() {
  console.log('🔍 DEBUG: Estado atual da ISIS');
  console.log('================================');
  
  // 1. Verifica se está na página correta
  const isIsisPage = window.location.href.includes('agendar');
  console.log('📍 Página ISIS:', isIsisPage);
  
  if (!isIsisPage) {
    console.log('❌ Não está na página da ISIS. Acesse: /agendar?e=1005');
    return;
  }
  
  // 2. Verifica elementos React/Context
  const reactRoot = document.querySelector('#root');
  console.log('⚛️ React Root encontrado:', !!reactRoot);
  
  // 3. Verifica se há erros no console relacionados à ISIS
  console.log('\n📊 Verificando possíveis problemas...');
  
  // 4. Simula clique em "Finalizar Atendimento" se disponível
  const buttons = Array.from(document.querySelectorAll('button')).filter(btn => 
    btn.textContent.includes('Finalizar Atendimento') || 
    btn.textContent.includes('Finalizar') ||
    btn.textContent.includes('👋')
  );
  
  console.log('🔘 Botões "Finalizar" encontrados:', buttons.length);
  buttons.forEach((btn, idx) => {
    console.log(`  ${idx + 1}. "${btn.textContent.trim()}"`);
  });
  
  // 5. Verifica estado do localStorage
  const feedbacksLocais = localStorage.getItem('isis-feedbacks');
  console.log('💾 Feedbacks locais:', feedbacksLocais ? JSON.parse(feedbacksLocais).length : 0);
  
  // 6. Testa se consegue acessar as funções da ISIS
  try {
    // Verifica se as variáveis de ambiente estão carregadas
    console.log('\n🔧 Variáveis de ambiente:');
    console.log('- VITE_JSONBIN_BIN_ID:', import.meta.env?.VITE_JSONBIN_BIN_ID || 'undefined');
    console.log('- VITE_JSONBIN_API_KEY presente:', !!(import.meta.env?.VITE_JSONBIN_API_KEY));
  } catch (error) {
    console.log('❌ Erro ao acessar variáveis de ambiente:', error.message);
  }
  
  // 7. Instruções para forçar o fluxo
  console.log('\n💡 SOLUÇÕES:');
  console.log('================================');
  
  if (buttons.length > 0) {
    console.log('✅ Encontrei botão(ões) de finalizar!');
    console.log('🖱️ Para testar, execute: document.querySelector("button[title*=\'Finalizar\'], button:contains(\'Finalizar\')").click()');
  } else {
    console.log('❌ Nenhum botão "Finalizar Atendimento" encontrado');
    console.log('📋 Possíveis causas:');
    console.log('   1. Ainda não completou um agendamento');
    console.log('   2. Não está na tela de opções pós-agendamento');
    console.log('   3. Erro no carregamento dos componentes');
    
    console.log('\n🔄 Para testar diretamente a avaliação:');
    console.log('   Execute: forcarTelaAvaliacao()');
  }
  
  // 8. Verifica se há mensagens da ISIS
  const messages = Array.from(document.querySelectorAll('[class*="message"], [class*="chat"]'))
    .map(el => el.textContent?.trim())
    .filter(text => text && text.length > 0)
    .slice(-5); // Últimas 5 mensagens
    
  console.log('\n💬 Últimas mensagens do chat:');
  messages.forEach((msg, idx) => {
    console.log(`  ${idx + 1}. ${msg.substring(0, 80)}${msg.length > 80 ? '...' : ''}`);
  });
}

// Função para forçar a tela de avaliação (para teste)
function forcarTelaAvaliacao() {
  console.log('🚀 Forçando tela de avaliação...');
  
  try {
    // Simula dados mínimos necessários
    const dadosSimulados = {
      cliente: { nome: 'Cliente Teste' },
      empresa: { nome_fantasia: 'Arena Teste' }
    };
    
    // Tenta importar e executar a função de avaliação
    import('./src/lib/jsonbinService.js').then(({ adicionarFeedbackIsis }) => {
      console.log('✅ Serviço JSONBin carregado');
      
      // Testa com dados simulados
      const feedbackTeste = {
        rating: 5,
        comentario: 'Teste forçado do sistema',
        cliente_nome: dadosSimulados.cliente.nome,
        empresa_nome: dadosSimulados.empresa.nome_fantasia
      };
      
      return adicionarFeedbackIsis(feedbackTeste);
    }).then(resultado => {
      console.log('✅ Teste de avaliação funcionou!', resultado);
    }).catch(error => {
      console.log('❌ Erro no teste:', error);
    });
    
  } catch (error) {
    console.log('❌ Erro ao forçar avaliação:', error);
  }
}

// Função para simular clique no botão finalizar
function clicarFinalizarAtendimento() {
  const buttons = Array.from(document.querySelectorAll('button')).filter(btn => 
    btn.textContent.includes('Finalizar Atendimento')
  );
  
  if (buttons.length > 0) {
    console.log('🖱️ Clicando em "Finalizar Atendimento"...');
    buttons[0].click();
    
    // Aguarda um pouco e verifica se apareceu a tela de avaliação
    setTimeout(() => {
      const estrelas = document.querySelectorAll('[class*="star"]');
      console.log('⭐ Estrelas encontradas:', estrelas.length);
      
      if (estrelas.length >= 5) {
        console.log('✅ Tela de avaliação apareceu!');
      } else {
        console.log('❌ Tela de avaliação não apareceu');
      }
    }, 2000);
  } else {
    console.log('❌ Botão "Finalizar Atendimento" não encontrado');
  }
}

// Execute no console:
console.log('🛠️ Funções de debug carregadas:');
console.log('- debugIsisFlow() - Analisa estado atual');
console.log('- forcarTelaAvaliacao() - Testa avaliação diretamente');  
console.log('- clicarFinalizarAtendimento() - Simula clique no botão');
console.log('\n▶️ Execute: debugIsisFlow()');

// Auto-executa o debug
debugIsisFlow();
