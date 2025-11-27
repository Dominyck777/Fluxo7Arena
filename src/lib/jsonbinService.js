/**
 * Serviço para integração com JSONBin
 * Gerencia feedbacks da ISIS e outros dados
 */

// Credenciais fixas que funcionam
const JSONBIN_BIN_ID = '690605e5ae596e708f3c7bc5';
const JSONBIN_API_KEY = '$2a$10$/XmOGvx8./SZzV3qMzQ5i.6FjBjS4toNbeaEFzX2D8QPUddyM6VR2';
const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3';

// Debug das variáveis de ambiente (apenas em desenvolvimento)
if (import.meta.env.DEV) {
  console.log('[JSONBin] BIN_ID:', JSONBIN_BIN_ID);
  console.log('[JSONBin] API_KEY presente:', !!JSONBIN_API_KEY);
  console.log('[JSONBin] API_KEY length:', JSONBIN_API_KEY?.length);
}

/**
 * Busca dados do bin
 */
export const getBinData = async () => {
  try {
    // Verifica se as variáveis de ambiente estão configuradas
    if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) {
      throw new Error('Variáveis de ambiente JSONBin não configuradas');
    }

    const response = await fetch(`${JSONBIN_BASE_URL}/b/${JSONBIN_BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[JSONBin] Resposta do servidor:', errorText);
      
      if (response.status === 401) {
        throw new Error('Chave de API JSONBin inválida ou bin não pertence à conta');
      } else if (response.status === 404) {
        throw new Error('Bin JSONBin não encontrado');
      } else {
        throw new Error(`Erro ao buscar dados: ${response.status} - ${errorText}`);
      }
    }

    const data = await response.json();
    return data.record;
  } catch (error) {
    console.error('[JSONBin] Erro ao buscar dados:', error);
    throw error;
  }
};

/**
 * Atualiza dados do bin
 */
export const updateBinData = async (newData) => {
  try {
    const response = await fetch(`${JSONBIN_BASE_URL}/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'X-Master-Key': JSONBIN_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newData)
    });

    if (!response.ok) {
      throw new Error(`Erro ao atualizar dados: ${response.status}`);
    }

    const data = await response.json();
    return data.record;
  } catch (error) {
    console.error('[JSONBin] Erro ao atualizar dados:', error);
    throw error;
  }
};

/**
 * Salva feedback localmente como fallback
 */
const salvarFeedbackLocal = (feedback) => {
  try {
    const feedbacksLocais = JSON.parse(localStorage.getItem('isis-feedbacks') || '[]');
    feedbacksLocais.push(feedback);
    localStorage.setItem('isis-feedbacks', JSON.stringify(feedbacksLocais));
    console.log('[JSONBin] Feedback salvo localmente como fallback:', feedback.id);
    return feedback;
  } catch (error) {
    console.error('[JSONBin] Erro ao salvar feedback localmente:', error);
    return feedback;
  }
};

/**
 * Adiciona feedback da ISIS
 */
export const adicionarFeedbackIsis = async (feedbackData) => {
  // Cria objeto de feedback conforme especificado
  const feedback = {
    id: Date.now() + Math.random().toString(36).substr(2, 9), // ID único
    timestamp: new Date().toISOString(),
    estrelas: feedbackData.rating, // Nome do campo conforme solicitado
    nome_cliente: feedbackData.cliente_nome,
    empresa: feedbackData.empresa_nome, // Nome da empresa de quadras
    projeto: 'fluxo7arena', // Sempre fluxo7arena
    comentario: feedbackData.comentario || null // Input de texto opcional
  };

  try {
    console.log('[JSONBin] Adicionando feedback ISIS:', feedbackData);
    
    // Busca dados atuais
    const currentData = await getBinData();
    
    // Garante que existe array de feedback-isis
    if (!currentData['feedback-isis']) {
      currentData['feedback-isis'] = [];
    }
    
    // Adiciona ao array
    currentData['feedback-isis'].push(feedback);
    
    // Atualiza no JSONBin
    await updateBinData(currentData);
    
    console.log('[JSONBin] Feedback adicionado com sucesso:', feedback.id);
    return feedback;
    
  } catch (error) {
    console.error('[JSONBin] Erro ao adicionar feedback, salvando localmente:', error);
    
    // Fallback: salva localmente
    return salvarFeedbackLocal(feedback);
  }
};

/**
 * Busca todos os feedbacks da ISIS
 */
export const getFeedbacksIsis = async () => {
  try {
    const data = await getBinData();
    return data['feedback-isis'] || [];
  } catch (error) {
    console.error('[JSONBin] Erro ao buscar feedbacks:', error);
    return [];
  }
};

/**
 * Busca feedbacks por empresa
 */
export const getFeedbacksPorEmpresa = async (empresaCodigo) => {
  try {
    const feedbacks = await getFeedbacksIsis();
    return feedbacks.filter(f => f.empresa_codigo === empresaCodigo);
  } catch (error) {
    console.error('[JSONBin] Erro ao buscar feedbacks por empresa:', error);
    return [];
  }
};

/**
 * Calcula estatísticas de feedback
 */
export const calcularEstatisticasFeedback = (feedbacks) => {
  if (!feedbacks || feedbacks.length === 0) {
    return {
      total: 0,
      mediaRating: 0,
      distribuicao: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      percentualPositivo: 0
    };
  }

  const total = feedbacks.length;
  const somaRatings = feedbacks.reduce((sum, f) => sum + f.rating, 0);
  const mediaRating = Math.round((somaRatings / total) * 10) / 10;
  
  const distribuicao = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  feedbacks.forEach(f => {
    distribuicao[f.rating]++;
  });
  
  const feedbacksPositivos = feedbacks.filter(f => f.rating >= 4).length;
  const percentualPositivo = Math.round((feedbacksPositivos / total) * 100);
  
  return {
    total,
    mediaRating,
    distribuicao,
    percentualPositivo
  };
};
