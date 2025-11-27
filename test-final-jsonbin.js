// Teste final das credenciais JSONBin que funcionam
const BIN_ID = '690605e5ae596e708f3c7bc5';
const API_KEY = '$2a$10$/XmOGvx8./SZzV3qMzQ5i.6FjBjS4toNbeaEFzX2D8QPUddyM6VR2';
const BASE_URL = 'https://api.jsonbin.io/v3';

async function testarCredenciaisFinais() {
  console.log('🔍 Testando credenciais que funcionam...');
  console.log('BIN_ID:', BIN_ID);
  console.log('API_KEY:', API_KEY.substring(0, 15) + '...');
  
  try {
    // Teste de leitura
    console.log('\n📖 Testando leitura...');
    const getResponse = await fetch(`${BASE_URL}/b/${BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Status leitura:', getResponse.status);
    
    if (getResponse.ok) {
      const data = await getResponse.json();
      console.log('✅ Leitura funcionou!');
      console.log('Estrutura atual:', Object.keys(data.record || data));
      console.log('Feedbacks existentes:', (data.record || data)['feedback-isis']?.length || 0);
      
      // Teste de escrita
      console.log('\n📝 Testando escrita...');
      
      const currentData = data.record || data;
      
      // Garante estrutura
      if (!currentData['feedback-isis']) {
        currentData['feedback-isis'] = [];
      }
      
      if (!currentData['devs']) {
        currentData['devs'] = [
          {
            "id": "dominyck",
            "name": "Dominyck",
            "password": "777",
            "role": "admin",
            "active": true
          }
        ];
      }
      
      // Adiciona feedback de teste
      const feedbackTeste = {
        id: 'teste-final-' + Date.now(),
        timestamp: new Date().toISOString(),
        estrelas: 5,
        nome_cliente: 'Ithalo Dominyck Alves de Assis',
        empresa: 'Arena Palace',
        projeto: 'fluxo7arena',
        comentario: 'Teste final das credenciais - funcionando!'
      };
      
      currentData['feedback-isis'].push(feedbackTeste);
      
      const putResponse = await fetch(`${BASE_URL}/b/${BIN_ID}`, {
        method: 'PUT',
        headers: {
          'X-Master-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(currentData)
      });
      
      console.log('Status escrita:', putResponse.status);
      
      if (putResponse.ok) {
        console.log('✅ Escrita funcionou!');
        console.log('✅ CREDENCIAIS TOTALMENTE FUNCIONAIS!');
        console.log('\n🎯 Próximo passo: Reinicie o servidor (npm run dev) para carregar as variáveis de ambiente');
        return true;
      } else {
        const errorText = await putResponse.text();
        console.log('❌ Erro na escrita:', errorText);
      }
      
    } else {
      const errorText = await getResponse.text();
      console.log('❌ Erro na leitura:', errorText);
    }
    
  } catch (error) {
    console.error('💥 Erro na requisição:', error);
  }
  
  return false;
}

// Função para verificar variáveis de ambiente atuais
function verificarVariaveisAmbiente() {
  console.log('\n🔧 Verificando variáveis de ambiente da aplicação:');
  
  try {
    const binId = import.meta.env?.VITE_JSONBIN_BIN_ID;
    const apiKey = import.meta.env?.VITE_JSONBIN_API_KEY;
    
    console.log('VITE_JSONBIN_BIN_ID:', binId);
    console.log('VITE_JSONBIN_API_KEY presente:', !!apiKey);
    console.log('VITE_JSONBIN_API_KEY length:', apiKey?.length);
    
    if (binId === BIN_ID && apiKey === API_KEY) {
      console.log('✅ Variáveis de ambiente estão corretas!');
    } else {
      console.log('❌ Variáveis de ambiente diferentes das credenciais que funcionam');
      console.log('🔄 SOLUÇÃO: Reinicie o servidor de desenvolvimento');
    }
    
  } catch (error) {
    console.log('❌ Erro ao acessar variáveis de ambiente:', error);
    console.log('🔄 SOLUÇÃO: Reinicie o servidor de desenvolvimento');
  }
}

// Auto-executa os testes
console.log('🚀 Executando testes finais...');
testarCredenciaisFinais().then(sucesso => {
  if (sucesso) {
    verificarVariaveisAmbiente();
  }
});

// Exporta para uso manual
window.testarCredenciaisFinais = testarCredenciaisFinais;
window.verificarVariaveisAmbiente = verificarVariaveisAmbiente;
