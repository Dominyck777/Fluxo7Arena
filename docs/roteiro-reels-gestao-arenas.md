# Roteiro Reels — Software de Gestão de Quadras/Arenas

Duração alvo: 65–70s (9:16). Estilo: cortes rápidos, texto curto, zooms leves. Ajustaremos conforme for gravando.

## Identidade Visual (CapCut)

- **Paleta base (do logo/login)**
  - Laranja principal: `#FF7A00` (títulos e destaques)
  - Amarelo troféu: `#FFC21A` (ícones, badges, contornos sutis)
  - Fundo escuro: `#0F0F10` ou `#121212` (canvas/background)
  - Cinza do "Arena": `#B7B7B7` (subtítulos/legendas)
  - Branco: `#FFFFFF` (texto principal sobre fundo escuro)

- **Tipografia (CapCut)**
  - Títulos: fonte bold/semibold limpa (ex.: "Montserrat/Inter/Default Bold" do CapCut)
  - Subtítulos: medium/regular
  - Contraste: títulos em Laranja `#FF7A00` ou Branco com sombra leve; subtítulos em Cinza `#B7B7B7`

- **Estilo recorrente**
  - Fundo: sólido escuro `#0F0F10`
  - Título por cena: 3–6 palavras, animação In = Fade/Pop (0.3–0.5s)
  - Detalhes/ícones: usar Amarelo `#FFC21A` (ex.: ícone Ban, check ✅, setas)
  - Stroke/sombra do texto: 6–12% de opacidade, para legibilidade

Observação: ajustaremos os hex exatos em cima do monitor. Se o laranja parecer claro demais, testar `#FF6A00` ou `#FF8200`.

### Padrão do logotipo (como na tela de login)

- Composição: [ícone troféu dentro de quadrado] + [Fluxo7] em cima, [Arena] embaixo.
- Cores do texto:
  - "Fluxo" em Laranja `#FF7A00`
  - "7" em Amarelo `#FFC21A`
  - "Arena" em Cinza `#B7B7B7`
- Ícone do troféu:
  - Fundo do quadrado com cantos 20–24px: `#FFC21A`
  - Traço do troféu: preto `#000000`
- Fundo geral: `#0F0F10`

Tipografia sugerida: Bold compacta para "Fluxo7"; Medium para "Arena".

## Estrutura de Cenas (reordenado)

- **0) Abertura com marca (0–2.5s)**
  - Objetivo: exibir a pergunta junto do nome/logo no mesmo quadro.
  - Texto on-screen (oficial):
    - Linha 1–2 (título): "Profissionalize suas\nquadras hoje com"
      - Cor: Laranja `#FF7A00`, Bold, sombra #000 12% (blur 8)
      - Tamanho: 56–64 (em duas linhas, centralizado)
    - Linha 3–4 (marca): "Fluxo" `#FF7A00` + "7" `#FFC21A` na mesma linha; abaixo "Arena" `#B7B7B7`
  - Layout recomendado (empilhado):
    - Pergunta centralizada no topo (margem 10% do topo)
    - Abaixo, bloco da marca seguindo o padrão do logotipo (troféu à esquerda do texto)
  - Captação: canvas `#0F0F10`; adicionar Shape do ícone + textos conforme "Padrão do logotipo" acima.
  - Animação sugerida:
    - Ícone: Pop 0.2s
    - "Fluxo7": Typewriter 0.6s OU Fade 0.35s
    - Pergunta: Fade 0.35s (após 0.1s)
  - Duração total: 2.0–2.5s, em seguida transição “Buraco negro” para a Cena 1.
  - Narração (voz feminina): "Profissionalize suas quadras hoje com o Fluxo7 Arena."

  
  
**00a) Tela inicial com marca (opcional, antes da 0)**
- Objetivo: replicar o estilo da tela de login.
- Layout:
  - Esquerda: quadrado arredondado (24px radius) `#FFC21A` com o ícone do troféu (preto).
  - Direita: "Fluxo" em `#FF7A00` + "7" em `#FFC21A` na mesma linha.
  - Abaixo (alinhado ao texto): "Arena" em `#B7B7B7`.
- Passo a passo no CapCut:
  1. Canvas 9:16, fundo `#0F0F10`.
  2. Importe o PNG/SVG do troféu. Crie um Shape (retângulo arredondado), cor `#FFC21A`, raio 24, sombra 20% blur 12. Posicione o troféu centralizado dentro.
  3. Adicione texto "Fluxo7": aplique 2 cores (se não houver rich text, duplique a camada: "Fluxo" laranja e somente "7" amarelo). Bold 72–84.
  4. Adicione texto "Arena" em cinza `#B7B7B7`, tamanho ~36–42, alinhado à esquerda do "Fluxo7".
  5. Distribuição: ícone e textos centralizados verticalmente na tela, com respiração à direita.
- Animação:
  - Ícone: Pop 0.2s
  - "Fluxo7": Typewriter 0.6s OU Fade 0.35s
  - "Arena": Fade 0.3s com 0.1s de atraso
- Duração total: 1.5–2.0s (em seguida, transição "Buraco negro" para a Cena 1)

- **1) Agenda clara (dia/semana) (2–8s)**
  - Texto na tela (on-screen): "Dia ou Semana, em 1 toque" (opcional)
  - Captação: INÍCIO nesta cena com a visão Dia fazendo rolagem leve (3–4s). Em seguida tocar em "Semana" e fazer breve rolagem (4–6s). [Atualizado]
  - Efeito: Cross Dissolve curto (ou corte seco). Sem zoom.
  - Cor do título: Laranja. Badge de dica em Amarelo: "Semana".
  - Narração: "Visual de Dia ou Semana, em um toque." 

- **2) Agenda diária intuitiva (8–15s)**
  - Texto na tela (on-screen): "Agenda diária intuitiva" (opcional)
  - Captação: Na visão Dia, rolagem sutil até um agendamento em andamento; clique para abrir o modal; mostrar 1.5–2s.
  - Efeito: Transição Slide Up (opcional). Sem zoom.
  - Cor do título: Branco com sombra leve.
  - Narração: "Navegação simples para encontrar e editar reservas rapidamente." 

- **3) Automação de agendamentos (Isis) (16–24s)**
  - Texto na tela (on-screen): "Assistente que agiliza reservas"
  - Captação: Abrir Isis, clicar no botão de calendário do input, escolher data, ver horários disponíveis (respeitando dias de funcionamento).
  - Efeito: Callout (seta/caixa) apontando pro botão de calendário.
  - Cor do título: Branco; ícone/seta do callout em Amarelo.
  - Narração: "Com a assistente, seus agendamentos ficam mais rápidos e sem erros." 

- **4) Evite erros: quadra fechada (24–30s)**
  - Texto na tela (on-screen): "Quadra fechada? Mostramos na hora."
  - Captação: Na visão diária, overlay de "Fechada" com motivo exibido por blocos de 1h.
  - Efeito: Zoom in suave + destaque no aviso.
  - Cor do título: Branco; ícone Ban e etiqueta "Fechada" em Amarelo.
  - Narração: "Se a quadra estiver fechada, você vê na hora, com o motivo." 

- **5) Pagamentos por participante (30–42s)**
  - Texto na tela (on-screen): "Pagamentos por participante, em segundos"
  - Captação: Abrir "Gerenciar Pagamentos" → clicar "Dividir igualmente" → todos ficam Pago → fechar modal, ver 8/8 pagos.
  - Efeito: Texto pop "8/8 pagos ✅".
  - Cor do título: Laranja; contador final em Amarelo.
  - Narração: "Pagamentos por participante em segundos. Um clique, todo mundo resolvido." 

- **6) Balcão e Loja (42–48s)**
  - Texto na tela (on-screen): "Balcão e loja sob controle"
  - Captação: Abrir tela de Loja/Balcão, registrar item rápido e confirmar.
  - Efeito: Slide Left.
  - Cor do título: Branco; preço/itens destacados em Amarelo.
  - Narração: "Balcão e loja sob controle, com registro rápido de vendas." 

- **7) Menos no-show, mais controle (48–54s)**
  - Texto na tela (on-screen): "Menos no-show. Mais controle."
  - Captação: Mostrar contador de pagos no card do agendamento e o nome do representante correto no grid.
  - Efeito: Fade + seta apontando pro status/contador.
  - Cor do título: Branco; destaque "Mais controle" em Laranja.
  - Narração: "Menos no-show, mais controle do seu dia." 

- **8) Alertas e visão do dia (54–60s)**
  - Texto na tela (on-screen): "Alertas e visão do dia"
  - Captação: Abrir popover de alertas no sino (3 itens). Em seguida, visão geral do dia (horários livres/ocupados).
  - Efeito: Wipe curto + zoom leve.
  - Cor do título: Branco; ícones/realces em Amarelo.
  - Narração: "Alertas inteligentes e uma visão clara do que importa agora." 

- **9) Do balcão ao financeiro (60–66s)**
  - Texto na tela (on-screen): "Do balcão ao financeiro"
  - Captação: Mostrar status de pagamentos consolidados (ex.: contagem Pago/Pendente no modal/agendamento ou relatório rápido).
  - Efeito: Fade.
  - Cor do título: Laranja.
  - Narração: "Do balcão ao financeiro: tudo integrado." 

- (remanejado para a cena 6)

- **10) CTA final (66–70s)**
  - Texto: "Quer ver funcionando? Peça uma demo."
  - Captação: Tela com logo e CTA/Whats.
  - Efeito: Fade In + Hold ~2s.
  - Cor do título: Laranja; botão/CTA em Amarelo.
  - Narração: "Quer ver funcionando na sua arena? Peça uma demo agora." 

---

## Guia de Captação (checklist)

- Agenda diária: scroll suave; abrir modal de agendamento.
- Toggle Dia/Semana: alternar e mostrar posicionamento semanal.
- Isis: abrir, usar botão de calendário do input, selecionar data, visualizar horários.
- Quadra fechada: overlay "Fechada" por blocos de 1h com motivo visível.
- PaymentModal: "Dividir igualmente" → 100% pagos → fechar → ver 8/8 pagos.
- Alertas: abrir popover do sino (3 alertas).
- Indicadores de pagamento: mostrar contagem Pago/Pendente e representante no grid.
- Loja/Mesas (se existir) ou Relatórios (se alternativo).

## Diretrizes Visuais/Texto

- Fonte bold clara, cor branca; sombra leve ou stroke sutil para legibilidade.
- Textos curtos (3–6 palavras) por cena, centralizados.
- Repetir padrão de animação: In = Fade/Pop (0.3–0.5s).
- Zoom suave 6–10% em telas de sistema.
- Transições discretas (Cross Dissolve 0.2s ou Slide Up). Evitar efeitos muito chamativos.
- Cores por padrão: Títulos Laranja `#FF7A00`; ícones/badges Amarelo `#FFC21A`; subtítulos Cinza `#B7B7B7`; fundo escuro `#0F0F10`.

## Observações e Ajustes

- Duração por cena pode variar ±1–2s conforme cortes.
- "Loja/Mesas" é opcional e substituível por "Relatórios e insights" se o módulo não estiver disponível.
- Podemos adicionar narração ou manter apenas texto + música. Se usar narração, ativar legendas automáticas.
  - Narração: usar voz feminina natural, ritmo moderado, pausas curtas entre cenas para respiro visual.

## Próximos Passos

1. A partir do título (Cena 0), aplique a transição “Buraco negro” e entre na nova Cena 1 (Dia/Semana).
2. Grave/importar a Cena 1 com ordem Dia (rolagem leve) → Semana (rolagem breve), e depois a Cena 2 (Agenda diária) conforme descrito. Sem texto é aceitável; texto é opcional. [Atualizado]
3. Continue com Cena 3 (Isis), 4 (Fechada), 5 (Pagamentos), 6 (Balcão/Loja), 7 (No-show), 8 (Alertas), 9 (Financeiro), 10 (CTA).
4. No editor, aplicar o mesmo preset de cores/animações para consistência.

---

## Tutorial por Cena (execução no CapCut)

- **Cena 1 — Dia/Semana**
  - Importar clipe; Canvas 9:16.
  - Crop para tirar barra de status/gestos; Scale até preencher 9:16.
  - Cortar para manter: Dia com rolagem leve (3–4s) → toque em Semana + rolagem breve (4–6s). Duração final: 7–9s. [Atualizado]
  - Texto (opcional): "Dia ou Semana, em 1 toque" em #FF7A00; animação Fade 0.3–0.4s.
  - Narração: "Visual de Dia ou Semana, em um toque."

- **Cena 2 — Agenda diária intuitiva**
  - Importar clipe com rolagem sutil; clique e exibir modal por 1.5–2s.
  - Crop/Scale como acima; sem zoom.
  - Texto (opcional): "Agenda diária intuitiva" em branco; sombra leve.
  - Narração: "Navegação simples para encontrar e editar reservas rapidamente."
