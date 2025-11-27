/**
 * Sistema de mensagens variadas da Isis
 * Cada step tem múltiplas variações que são escolhidas aleatoriamente
 */

export const messageVariations = {
  greeting: [
    "Olá! Eu sou a Isis 👋 Vou te ajudar a agendar sua quadra! Qual você prefere?",
    "Oi! Sou a Isis! 🏐 Vamos agendar? Me diz, qual quadra você quer?",
    "E aí! Isis aqui! Bora marcar sua partida? Qual quadra te interessa?",
    "Olá! 😊 Prazer, sou a Isis! Qual quadra você quer reservar?",
    "Opa! Isis na área! Vamos agendar sua quadra? Qual delas?",
    "Seja bem-vindo! Sou a Isis e vou facilitar sua reserva! Qual quadra?"
  ],
  
  afterQuadra: [
    "Boa escolha! {quadra} é ótima! 🏟️ Para qual dia?",
    "Perfeito! {quadra} é top! Qual dia você quer?",
    "{quadra} confirmada! ✅ Me diz, que dia?",
    "Show! {quadra} é sucesso aqui! Qual o dia?",
    "Anotado! {quadra} 👍 Agora me fala o dia:",
    "Excelente! {quadra} é uma das melhores! Para quando?"
  ],
  
  afterData: [
    "Beleza! {data} anotado! 📅 Qual horário você prefere?",
    "Ótimo! {data} tá disponível! Que horas?",
    "{data} é logo ali! ⏰ Me diz o horário:",
    "Confirmado {data}! Qual horário te atende melhor?",
    "Perfeito! {data} 🗓️ Agora escolhe o horário:",
    "Show! {data} tá livre! Qual o melhor horário pra você?"
  ],
  
  afterHorario: [
    "{horario} é seu! 🎯 Qual modalidade?",
    "Reservado {horario}! ⏱️ Vai ser qual modalidade?",
    "Fechou {horario}! Qual esporte?",
    "{horario} confirmado! Me diz a modalidade:",
    "Show! {horario} 🔥 E a modalidade é...?",
    "Perfeito! {horario} garantido! Qual modalidade?"
  ],
  
  afterModalidade: [
    "{modalidade}! Massa! ⚽ Quantas pessoas vão jogar?",
    "Vai ser {modalidade}! Legal! Quantos jogadores?",
    "{modalidade} é bom demais! 🏐 Quantas pessoas?",
    "Top! {modalidade} 🎾 Me diz quantas pessoas:",
    "{modalidade} confirmado! Quantos vão jogar?",
    "Ótimo! {modalidade} é show! Quantos participantes?"
  ],
  
  askNames: [
    "Agora preciso dos nomes! Digite cada um (um por linha):",
    "Beleza! Me manda os nomes dos participantes:",
    "Show! Lista os nomes pra mim:",
    "Ótimo! Quais são os nomes?",
    "Perfeito! Me passa os nomes de todo mundo:",
    "Legal! Agora os nomes dos jogadores:"
  ],
  
  askContact: [
    "Últimos dados! Qual seu nome completo?",
    "Agora preciso do seu nome e telefone:",
    "Quase lá! Me passa seu nome e WhatsApp:",
    "Beleza! Seus dados para contato:",
    "Falta pouco! Nome completo e telefone:",
    "Última etapa! Qual seu nome e telefone?"
  ],
  
  reviewData: [
    "Ótimo! Vamos conferir tudo antes de confirmar:",
    "Perfeito! Revisa comigo os dados:",
    "Show! Confirma se tá tudo certo:",
    "Beleza! Dá uma olhada se está correto:",
    "Legal! Vamos revisar juntos:",
    "Massa! Confere os detalhes aqui:"
  ],
  
  confirmation: [
    "🎉 Tudo certo! Agendamento #{codigo} confirmado!",
    "✅ Pronto! Seu agendamento #{codigo} está garantido!",
    "🏆 Feito! Código #{codigo} confirmado!",
    "💪 Sucesso! Agendamento #{codigo} tá na agenda!",
    "🔥 Confirmado! #{codigo} é seu!",
    "🎯 Show! Agendamento #{codigo} marcado!"
  ],
  
  thankYou: [
    "Obrigada por agendar conosco! Até logo! 👋",
    "Valeu! Te vejo no jogo! 🏐",
    "Brigada! Bom jogo! ⚽",
    "Obrigada! Até a partida! 🎾",
    "Valeu pela preferência! Até breve! 😊",
    "Obrigada! Qualquer coisa, é só voltar aqui! 👍"
  ],
  
  loading: [
    "Deixa eu verificar...",
    "Só um momento...",
    "Já te respondo...",
    "Aguarda um pouquinho...",
    "Consultando aqui...",
    "Verificando pra você..."
  ],
  
  error: [
    "Ops! Algo deu errado. Vamos tentar de novo?",
    "Eita! Tive um problema aqui. Podemos recomeçar?",
    "Putz! Deu erro. Tenta novamente?",
    "Opa! Algo não funcionou. Vamos de novo?",
    "Caramba! Erro aqui. Pode tentar novamente?"
  ],
  
  noAvailability: [
    "Puts... esse horário já foi reservado. 😔 Escolhe outro?",
    "Eita! Esse já está ocupado. Que tal outro horário?",
    "Opa! Esse horário acabou de ser reservado. Tem outro?",
    "Poxa! Alguém reservou esse agora mesmo. Outro horário?",
    "Xiii! Esse já foi. Bora escolher outro?"
  ]
};

/**
 * Retorna uma mensagem aleatória do step especificado
 * @param {string} step - O passo da conversa (greeting, afterQuadra, etc)
 * @param {object} vars - Variáveis para substituir na mensagem {quadra: "Quadra 1"}
 * @returns {string} Mensagem formatada
 */
export const getIsisMessage = (step, vars = {}) => {
  const variations = messageVariations[step];
  
  if (!variations || variations.length === 0) {
    console.warn(`[Isis] Nenhuma variação encontrada para step: ${step}`);
    return 'Olá! Como posso ajudar?';
  }
  
  // Pega uma variação aleatória
  const randomIndex = Math.floor(Math.random() * variations.length);
  let message = variations[randomIndex];
  
  // Substitui variáveis {quadra}, {data}, etc
  Object.keys(vars).forEach(key => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    message = message.replace(regex, vars[key]);
  });
  
  return message;
};

/**
 * Retorna um emoji aleatório baseado no contexto
 */
export const getRandomEmoji = (context) => {
  const emojiSets = {
    sports: ['⚽', '🏐', '🎾', '🏀', '⛹️', '🤾'],
    celebration: ['🎉', '🎊', '🥳', '🏆', '🔥', '💪', '👏', '✨'],
    thinking: ['🤔', '💭', '🧐', '👀'],
    time: ['⏰', '⏱️', '🕐', '📅', '🗓️'],
    check: ['✅', '✔️', '👍', '👌', '💯']
  };
  
  const emojis = emojiSets[context] || ['😊'];
  return emojis[Math.floor(Math.random() * emojis.length)];
};
