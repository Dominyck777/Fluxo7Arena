import { supabaseIsis } from '@/lib/supabase-isis'

// Fallback local storage in case of transient errors
const salvarFeedbackLocal = (feedback) => {
  try {
    const feedbacksLocais = JSON.parse(localStorage.getItem('isis-feedbacks') || '[]')
    feedbacksLocais.push(feedback)
    localStorage.setItem('isis-feedbacks', JSON.stringify(feedbacksLocais))
    console.log('[ISIS Feedback] Salvo localmente como fallback:', feedback.id)
    return feedback
  } catch (e) {
    console.error('[ISIS Feedback] Erro ao salvar localmente:', e)
    return feedback
  }
}

// Insert feedback into Supabase 'isis' table
export const adicionarFeedbackIsis = async (feedbackData) => {
  const feedback = {
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    estrelas: feedbackData?.rating ?? null,
    nome_cliente: feedbackData?.cliente_nome ?? null,
    empresa: feedbackData?.empresa_nome ?? null,
    projeto: 'fluxo7arena',
    comentario: feedbackData?.comentario ?? null,
  }

  try {
    const row = {
      id: feedback.id,
      // Preferir código do cadastro (numero visível) em vez do UUID
      cod_cliente: feedbackData?.cliente_codigo ?? feedbackData?.cliente_id ?? feedbackData?.cod_cliente ?? null,
      nome_cliente: feedbackData?.cliente_nome || null,
      empresa: feedbackData?.empresa_nome || null,
      projeto: 'fluxo7arena',
      nota: feedbackData?.rating ?? null,
      comentario: feedbackData?.comentario || null,
      conversa: Array.isArray(feedbackData?.conversaArray)
        ? JSON.stringify(feedbackData.conversaArray)
        : (typeof feedbackData?.conversa === 'string' ? feedbackData.conversa : null),
      timestamp: feedback.timestamp,
    }
    const { error } = await supabaseIsis.from('isis').insert(row)
    if (error) {
      console.error('[Supabase ISIS] Erro ao inserir feedback:', error)
      return salvarFeedbackLocal({ ...feedback, projeto: 'fluxo7arena' })
    }
    console.log('[Supabase ISIS] Feedback inserido com sucesso:', row.id)
    return feedback
  } catch (error) {
    console.error('[Supabase ISIS] Exceção ao inserir feedback, salvando localmente:', error)
    return salvarFeedbackLocal(feedback)
  }
}

// Fetch all feedbacks (no conversa)
export const getFeedbacksIsis = async () => {
  try {
    const { data, error } = await supabaseIsis
      .from('isis')
      .select('id, cod_cliente, nome_cliente, empresa, projeto, nota, comentario, conversa, timestamp')
      .eq('projeto', 'fluxo7arena')
      .is('conversa', null)
      .order('timestamp', { ascending: false })
    if (error) {
      console.error('[Supabase ISIS] Erro ao buscar feedbacks:', error)
      return []
    }
    return (data || []).map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      estrelas: r.nota,
      nome_cliente: r.nome_cliente,
      empresa: r.empresa,
      projeto: r.projeto,
      comentario: r.comentario,
    }))
  } catch (error) {
    console.error('[Supabase ISIS] Exceção ao buscar feedbacks:', error)
    return []
  }
}

// Fetch feedbacks by company name (empresa)
export const getFeedbacksPorEmpresa = async (empresaCodigoOuNome) => {
  try {
    const { data, error } = await supabaseIsis
      .from('isis')
      .select('id, cod_cliente, nome_cliente, empresa, projeto, nota, comentario, conversa, timestamp')
      .eq('projeto', 'fluxo7arena')
      .eq('empresa', empresaCodigoOuNome)
      .is('conversa', null)
      .order('timestamp', { ascending: false })
    if (error) {
      console.error('[Supabase ISIS] Erro ao buscar feedbacks por empresa:', error)
      return []
    }
    return (data || []).map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      estrelas: r.nota,
      nome_cliente: r.nome_cliente,
      empresa: r.empresa,
      projeto: r.projeto,
      comentario: r.comentario,
    }))
  } catch (error) {
    console.error('[Supabase ISIS] Exceção ao buscar feedbacks por empresa:', error)
    return []
  }
}
