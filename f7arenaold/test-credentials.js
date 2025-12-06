// Teste rápido das credenciais JSONBin
const BIN_ID = '690605e5ae596e708f3c7bc5';
const API_KEY = '$2a$10$/XmOGvx8./SZzV3qMzQ5i.6FjBjS4toNbeaEFzX2D8QPUddyM6VR2';

async function testarCredenciais() {
  console.log('🔍 Testando credenciais JSONBin...');
  console.log('BIN_ID:', BIN_ID);
  console.log('API_KEY:', API_KEY.substring(0, 15) + '...');
  
  const variantesChave = [
    { nome: 'Chave original', chave: API_KEY },
    { nome: 'Sem prefixo $2a$10$', chave: API_KEY.replace('$2a$10$', '') },
    { nome: 'Apenas hash', chave: API_KEY.split('$').pop() }
  ];
  
  for (const variante of variantesChave) {
    console.log(`\n🧪 Testando: ${variante.nome}`);
    console.log(`🔑 Chave: ${variante.chave.substring(0, 15)}...`);
    
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        method: 'GET',
        headers: {
          'X-Master-Key': variante.chave,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ SUCESSO! Esta chave funciona:', variante.nome);
        console.log('📊 Estrutura do bin:', Object.keys(data.record || data));
        console.log('📦 Dados completos:', data);
        
        // Testa também uma operação de escrita
        console.log('\n📝 Testando operação de escrita...');
        await testarEscrita(variante.chave);
        
        return variante.chave;
      } else {
        const errorText = await response.text();
        console.log('❌ Falhou:', errorText);
      }
    } catch (error) {
      console.error('💥 Erro na requisição:', error.message);
    }
  }
  
  console.log('\n❌ Nenhuma variante da chave funcionou');
  return null;
}

async function testarEscrita(chaveCorreta) {
  try {
    // Primeiro busca os dados atuais
    const getResponse = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': chaveCorreta,
        'Content-Type': 'application/json'
      }
    });
    
    if (!getResponse.ok) {
      console.log('❌ Não conseguiu buscar dados para teste de escrita');
      return;
    }
    
    const currentData = await getResponse.json();
    const record = currentData.record || currentData;
    
    // Adiciona um feedback de teste
    if (!record['feedback-isis']) {
      record['feedback-isis'] = [];
    }
    
    const feedbackTeste = {
      id: 'teste-' + Date.now(),
      timestamp: new Date().toISOString(),
      estrelas: 5,
      nome_cliente: 'Cliente Teste',
      empresa: 'Arena Teste',
      projeto: 'fluxo7arena',
      comentario: 'Teste de integração - pode ser removido'
    };
    
    record['feedback-isis'].push(feedbackTeste);
    
    // Tenta atualizar
    const putResponse = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: 'PUT',
      headers: {
        'X-Master-Key': chaveCorreta,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(record)
    });
    
    if (putResponse.ok) {
      console.log('✅ Escrita funcionou! Feedback de teste adicionado.');
    } else {
      const errorText = await putResponse.text();
      console.log('❌ Escrita falhou:', errorText);
    }
    
  } catch (error) {
    console.error('💥 Erro no teste de escrita:', error);
  }
}

// Execute no console do navegador:
// testarCredenciais().then(chave => console.log('Chave que funciona:', chave));
