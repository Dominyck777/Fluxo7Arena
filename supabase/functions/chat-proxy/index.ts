// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-isis-source, x-isis-duration-ms",
};

serve(async (req: Request) => {
  const startedAt = Date.now();
  const reqId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders } });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Prioriza a nova secret configurada no Supabase (ISIS-ADMIN-ARENA),
    // mantendo fallback para o nome antigo se ainda existir.
    const apiKey = Deno.env.get("ISIS-ADMIN-ARENA") || Deno.env.get("OPENAI_API_KEY_ISIS_ADMIN");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ reply: "(backend não configurado)" , source: "fallback", debug: { strategy: "reserve" } }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = await req.json();
    const message: string = String(body?.message || "").trim();
    const empresaCodigo: string = typeof body?.empresaCodigo === "string"
      ? String(body.empresaCodigo).trim()
      : "";
    const usuarioId: string | null = body?.usuarioId ? String(body.usuarioId) : null;
    const usuarioNome: string | null = body?.usuarioNome ? String(body.usuarioNome) : null;
    const usuarioCargo: string | null = body?.usuarioCargo ? String(body.usuarioCargo) : null;
    const history: Array<{ role: "user" | "assistant" | "system"; content: string }>
      = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing 'message'" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!empresaCodigo) {
      return new Response(JSON.stringify({ error: "Missing 'empresaCodigo'" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Data atual da arena (fuso UTC-3), usada como referência temporal para a LLM
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const nowUtc = new Date();
    const offsetMinutesToday = -3 * 60; // UTC-3
    const nowLocalMs = nowUtc.getTime() + offsetMinutesToday * 60000;
    const nowLocal = new Date(nowLocalMs);
    const todayStr = `${pad2(nowLocal.getUTCDate())}/${pad2(nowLocal.getUTCMonth() + 1)}/${nowLocal.getUTCFullYear()}`;
    const thisMonthStr = pad2(nowLocal.getUTCMonth() + 1);
    const thisYear = nowLocal.getUTCFullYear();

    // Sinalizadores de contexto para entender se o usuário está falando dos agendamentos de HOJE
    const messageMentionsToday = /hoje/i.test(message);
    let historyMentionsTodayAgendamentos = false;

    if (!messageMentionsToday && Array.isArray(history) && history.length > 0) {
      const reversed = [...history].reverse();
      const lastUserMsg = reversed.find((m) => m.role === "user");
      if (lastUserMsg) {
        const txt = String(lastUserMsg.content || "");
        if (/hoje/i.test(txt) && /\bagendamentos?\b/i.test(txt)) {
          historyMentionsTodayAgendamentos = true;
        }
      }

      if (!historyMentionsTodayAgendamentos) {
        const lastAssistantMsg = reversed.find((m) => m.role === "assistant");
        if (lastAssistantMsg) {
          const txt = String(lastAssistantMsg.content || "");
          if (txt.includes(`Agendamentos para o dia ${todayStr}`)) {
            historyMentionsTodayAgendamentos = true;
          }
        }
      }
    }

    // Fluxo determinístico de confirmação quando o usuário responde "sim".
    // Usado tanto para alteração de horário (fluxo antigo) quanto para um fluxo especial
    // de cancelamento de agendamentos listados anteriormente.
    const isYesConfirmation = /^(sim( mesmo| este mesmo)?|esse mesmo|isso mesmo|pode mudar|pode alterar|pode aplicar|pode fazer)\b/i.test(message);
    if (isYesConfirmation) {
      const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
      const lastAssistantText = (lastAssistant?.content || "").toString();

      // 1) Fluxo determinístico de cancelamento: última mensagem fala em "cancelar".
      const isCancelConfirmation = /cancelar/i.test(lastAssistantText) || /cancelamento/i.test(lastAssistantText);
      if (isCancelConfirmation) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
          const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
          const authHeader = req.headers.get("Authorization") || "";
          const sbDirect = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
          });

          // Extrair a data alvo da mensagem da assistente (ex.: 22/11/2025).
          const dateMatch = lastAssistantText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          let year = nowLocal.getUTCFullYear();
          let monthIndex = nowLocal.getUTCMonth(); // 0-based
          let dayNum = nowLocal.getUTCDate();
          if (dateMatch) {
            const d = parseInt(dateMatch[1], 10);
            const m = parseInt(dateMatch[2], 10);
            const y = parseInt(dateMatch[3], 10);
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
              dayNum = d;
              monthIndex = m - 1;
              year = y;
            }
          }

          const dayStart = new Date(year, monthIndex, dayNum, 0, 0, 0, 0);
          const dayEnd = new Date(year, monthIndex, dayNum + 1, 0, 0, 0, 0);
          const data_inicio = dayStart.toISOString();
          const data_fim = dayEnd.toISOString();

          // Extrair nomes de clientes das linhas "Cliente:" da mensagem da assistente.
          const clientNames: string[] = [];
          const clientRegex = /Cliente:\s*([^\n]+)/gi;
          let match: RegExpExecArray | null;
          while ((match = clientRegex.exec(lastAssistantText)) !== null) {
            const rawName = match[1] || "";
            const cleaned = rawName.replace(/\*/g, "").trim();
            if (cleaned && !clientNames.includes(cleaned)) {
              clientNames.push(cleaned);
            }
          }

          let q = sbDirect
            .from("v_agendamentos_isis")
            .select(
              "agendamento_id, inicio, fim, modalidade, agendamento_status, quadra_nome, representante_nome",
              { count: "exact" },
            )
            .eq("codigo_empresa", empresaCodigo)
            .gte("inicio", data_inicio)
            .lt("inicio", data_fim);

          if (clientNames.length > 0) {
            q = q.in("representante_nome", clientNames);
          }

          const { data, error, count } = await q;
          const durationCancel = Date.now() - startedAt;

          if (error) {
            const reply =
              "Não consegui localizar os agendamentos que você pediu para cancelar agora. Tente novamente em alguns instantes ou especifique o cliente e horário.";
            console.log(`[chat-proxy][${reqId}] direct_cancel_error`, { error: error.message });
            return new Response(
              JSON.stringify({ reply, source: "tools-direct", debug: { strategy: "reserve" } }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                  "x-isis-source": "tools-direct",
                  "x-isis-duration-ms": String(durationCancel),
                },
              },
            );
          }

          const rows = Array.isArray(data) ? data : [];
          if (!rows.length) {
            const reply =
              "Não encontrei agendamentos correspondentes para cancelar nesse período. Verifique se a data e os nomes dos clientes estão corretos.";
            console.log(`[chat-proxy][${reqId}] direct_cancel_not_found`, { clientNames, data_inicio, data_fim });
            return new Response(
              JSON.stringify({ reply, source: "tools-direct", debug: { strategy: "reserve" } }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                  "x-isis-source": "tools-direct",
                  "x-isis-duration-ms": String(durationCancel),
                },
              },
            );
          }

          const ids = rows
            .map((r: any) => r?.agendamento_id)
            .filter((v: any) => typeof v === "string" || typeof v === "number");

          if (!ids.length) {
            const reply =
              "Encontrei registros na agenda, mas não consegui identificar os IDs dos agendamentos para cancelar. Tente novamente informando cliente e horário.";
            console.log(`[chat-proxy][${reqId}] direct_cancel_missing_ids`, { clientNames, data_inicio, data_fim });
            return new Response(
              JSON.stringify({ reply, source: "tools-direct", debug: { strategy: "reserve" } }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                  "x-isis-source": "tools-direct",
                  "x-isis-duration-ms": String(durationCancel),
                },
              },
            );
          }

          const { data: updated, error: updateError } = await sbDirect
            .from("agendamentos")
            .update({ status: "canceled" })
            .in("id", ids)
            .eq("codigo_empresa", empresaCodigo)
            .select("id, status");

          if (updateError || !updated || !updated.length) {
            const reply =
              "Não consegui concluir o cancelamento desses agendamentos agora. Nenhuma alteração foi gravada. Tente novamente em alguns instantes.";
            console.log(`[chat-proxy][${reqId}] direct_cancel_update_error`, { error: updateError?.message, ids });
            return new Response(
              JSON.stringify({ reply, source: "tools-direct", debug: { strategy: "reserve" } }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                  "x-isis-source": "tools-direct",
                  "x-isis-duration-ms": String(durationCancel),
                },
              },
            );
          }

          const reply = `Tudo certo! Cancelei ${updated.length} agendamento(s) nesse período conforme sua confirmação. ✅`;
          console.log(`[chat-proxy][${reqId}] response`, {
            source: "tools-direct",
            duration_ms: durationCancel,
            reply_preview: reply.slice(0, 200),
          });
          return new Response(
            JSON.stringify({ reply, source: "tools-direct", debug: { strategy: "reserve" } }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
                "x-isis-source": "tools-direct",
                "x-isis-duration-ms": String(durationCancel),
              },
            },
          );
        } catch (e) {
          const durationCancel = Date.now() - startedAt;
          const reply =
            "Ocorreu um erro inesperado ao tentar cancelar os agendamentos. Nenhuma alteração foi gravada. Tente novamente em alguns instantes.";
          console.log(`[chat-proxy][${reqId}] direct_cancel_exception`, { error: String(e) });
          return new Response(
            JSON.stringify({ reply, source: "tools-direct", debug: { strategy: "reserve" } }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
                "x-isis-source": "tools-direct",
                "x-isis-duration-ms": String(durationCancel),
              },
            },
          );
        }
      }

      // 2) Fluxo determinístico de alteração de horário (quando a assistente propôs um novo horário).
      // Tenta extrair o novo horário de término da última mensagem da assistente.
      // Exemplos de padrões aceitos:
      // - "para as 14h30" / "para às 14h30"
      // - "finalizar às 14h"
      // - "termine às 15h"
      // - "13h00 às 15h00" ou "Novo horário: 13h00 às 15h00" (nesse caso queremos o horário final, 15h00)
      let targetHour: number | null = null;
      let targetMinute = 0;

      // Primeiro, procuramos qualquer intervalo "13h00 às 15h00" e usamos SEMPRE o horário final.
      const intervalMatch = lastAssistantText.match(/(\d{1,2})h(\d{2})?\s*às\s*(\d{1,2})h(\d{2})?/i);
      if (intervalMatch) {
        targetHour = parseInt(intervalMatch[3] || "0", 10);
        targetMinute = intervalMatch[4] ? parseInt(intervalMatch[4], 10) : 0;
      }

      if (targetHour === null) {
        const timeMatch =
          // "para as/às 14h30"
          lastAssistantText.match(/para\s+(?:as|às)\s+(\d{1,2})h(\d{2})?/i) ||
          // "finalizar às 14h"
          lastAssistantText.match(/finalizar\s+às?\s+(\d{1,2})h(\d{2})?/i) ||
          // "termine às 15h"
          lastAssistantText.match(/termine\s+às?\s+(\d{1,2})h(\d{2})?/i) ||
          // "término às 14h"
          lastAssistantText.match(/t[eê]rmino\s+às?\s+(\d{1,2})h(\d{2})?/i) ||
          // "Novo horário: 13h00 às 15h00" ou variações com palavra "horário" antes
          lastAssistantText.match(/novo\s+hor[aá]rio[^0-9]*(?:\d{1,2}h\d{2}?\s*às\s*)?(\d{1,2})h(\d{2})?/i);

        if (timeMatch) {
          targetHour = parseInt(timeMatch[1] || "0", 10);
          targetMinute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        }
      }

      if (targetHour === null) {
        // Compatibilidade com fluxo antigo específico para 14h
        const mentionsFinalize14 = /finalizar às 14h/i.test(lastAssistantText) || /horário final.*14h/i.test(lastAssistantText) || /novo horário.*14h/i.test(lastAssistantText) || /14h00/.test(lastAssistantText);
        if (mentionsFinalize14) {
          targetHour = 14;
          targetMinute = 0;
        }
      }

      if (targetHour !== null && targetHour >= 0 && targetHour <= 23 && targetMinute >= 0 && targetMinute <= 59) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
        const authHeader = req.headers.get("Authorization") || "";
        const sbDirect = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });

        // Período: hoje (00:00 até amanhã 00:00), alinhado com a Agenda
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0, 0);
        const data_inicio = start.toISOString();
        const data_fim = end.toISOString();

        const { data, error } = await sbDirect
          .from("v_agendamentos_isis")
          .select("agendamento_id, inicio, fim, modalidade, quadra_nome, representante_nome")
          .eq("codigo_empresa", empresaCodigo)
          .gte("inicio", data_inicio)
          .lt("inicio", data_fim)
          .order("inicio", { ascending: true });

        const earlyUserWantsChange = /\b(mudar|mude|muda|alterar|altera|altere|remarcar|remarca|cancelar|cancela|trocar|troca)\b/i.test(message);
        if (earlyUserWantsChange && !error && Array.isArray(data) && data.length === 1) {
          const unico = data[0] as any;
          const offsetMinutes = -3 * 60; // UTC-3
          const normalizeIso = (iso: string) => (iso.includes("T") ? iso : iso.replace(" ", "T"));

          const inicioDateUtc = new Date(normalizeIso(String(unico.inicio || "")));
          const fimDateUtc = new Date(normalizeIso(String(unico.fim || "")));

          // Calcular horário legível atual
          const pad = (n: number) => String(n).padStart(2, "0");
          let horarioAtualLegivel = "";
          if (!isNaN(inicioDateUtc.getTime()) && !isNaN(fimDateUtc.getTime())) {
            const inicioLocalMs = inicioDateUtc.getTime() + offsetMinutes * 60000;
            const fimLocalMs = fimDateUtc.getTime() + offsetMinutes * 60000;
            const inicioLocal = new Date(inicioLocalMs);
            const fimLocal = new Date(fimLocalMs);

            const ih = pad(inicioLocal.getUTCHours());
            const imin = pad(inicioLocal.getUTCMinutes());
            const fh = pad(fimLocal.getUTCHours());
            const fmin = pad(fimLocal.getUTCMinutes());
            horarioAtualLegivel = `${ih}h${imin} às ${fh}h${fmin}`;
          }

          // Novo fim: hoje no horário alvo (horário local), convertido de volta para UTC
          let newFimIso = String(unico.fim || "");
          try {
            const baseLocalDate = new Date((inicioDateUtc.getTime() + offsetMinutes * 60000));
            baseLocalDate.setUTCHours(targetHour, targetMinute, 0, 0);
            const newFimUtcMs = baseLocalDate.getTime() - offsetMinutes * 60000;
            const newFimUtc = new Date(newFimUtcMs);
            newFimIso = newFimUtc.toISOString();
          } catch {}

          const { data: updated, error: updateError } = await sbDirect
            .from("agendamentos")
            .update({ fim: newFimIso })
            .eq("id", unico.agendamento_id)
            .eq("codigo_empresa", empresaCodigo)
            .select("id")
            .maybeSingle();

          const duration = Date.now() - startedAt;
          if (updateError || !updated) {
            const reply = "Não consegui concluir a alteração do agendamento agora. Tente novamente em alguns instantes.";
            console.log(`[chat-proxy][${reqId}] direct_update_error`, {
              error: updateError?.message,
            });
            return new Response(JSON.stringify({ reply, source: "tools-direct", debug: { error: updateError?.message } }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
                "x-isis-source": "tools-direct",
                "x-isis-duration-ms": String(duration),
              },
            });
          }

          const novoHorarioLegivel = `${pad(targetHour)}h${pad(targetMinute)}`;

          const reply = `✅ Alterei o agendamento de hoje para finalizar às ${novoHorarioLegivel}.

- **Cliente:** ${unico.representante_nome || "Cliente"}
- **Quadra:** ${unico.quadra_nome || "(não informado)"}
- **Horário anterior:** ${horarioAtualLegivel || "(não identificado)"}
- **Novo horário:** ${novoHorarioLegivel} (término)

Se quiser, posso listar novamente os agendamentos de hoje para você conferir.`;

          console.log(`[chat-proxy][${reqId}] response`, {
            source: "tools-direct",
            duration_ms: duration,
            reply_preview: reply.slice(0, 200),
          });
          return new Response(JSON.stringify({ reply, source: "tools-direct", debug: { strategy: "reserve" } }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
              "x-isis-source": "tools-direct",
              "x-isis-duration-ms": String(duration),
            },
          });
        }
      }
    }

    // Intenções explícitas
    const userWantsChange = /\b(mudar|mude|muda|alterar|altera|altere|remarcar|remarca|cancelar|cancela|trocar|troca)\b/i.test(message);
    const userWantsCreate = /\b(criar|crie|agendar|agendamento|reservar|marcar)\b/i.test(message);

    // Fluxo determinístico para pedidos do tipo "... agendamento de hoje pra finalizar/acabar às 14h"
    // Agora considera também o contexto recente quando o usuário não repete explicitamente "hoje",
    // mas acabou de conversar sobre os agendamentos de hoje.
    const mentions14h = /14h/i.test(message);
    const isChangeTodayTo14h = userWantsChange && !userWantsCreate && mentions14h && (messageMentionsToday || historyMentionsTodayAgendamentos);
    if (isChangeTodayTo14h) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
      const authHeader = req.headers.get("Authorization") || "";
      const sbDirect = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      // Período: hoje (00:00 até amanhã 00:00), alinhado com a Agenda
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0, 0);
      const data_inicio = start.toISOString();
      const data_fim = end.toISOString();

      const { data, error } = await sbDirect
        .from("v_agendamentos_isis")
        .select(
          "agendamento_id, inicio, fim, modalidade, agendamento_status, quadra_nome, representante_nome, participantes_total, participantes_pagos, participantes_pendentes"
        )
        .eq("codigo_empresa", empresaCodigo)
        .gte("inicio", data_inicio)
        .lt("inicio", data_fim)
        .order("inicio", { ascending: true });

      const duration = Date.now() - startedAt;
      if (error) {
        console.log(`[chat-proxy][${reqId}] direct_get_agendamentos_error`, { error: error.message });
        return new Response(
          JSON.stringify({
            reply: "Não consegui listar os agendamentos de hoje para ajudar na alteração.",
            source: "fallback",
            debug: { strategy: "reserve" },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
              "x-isis-source": "fallback",
              "x-isis-duration-ms": String(duration),
            },
          },
        );
      }

      const pad = (n: number) => String(n).padStart(2, "0");
      const normalizeIso = (iso: string) => (iso.includes("T") ? iso : iso.replace(" ", "T"));
      const offsetMinutes = -3 * 60; // UTC-3

      const items = (data || []).map((row: any) => {
        const inicioDateUtc = new Date(normalizeIso(String(row.inicio || "")));
        const fimDateUtc = new Date(normalizeIso(String(row.fim || "")));
        let data_legivel = "";
        let horario_legivel = "";

        if (!isNaN(inicioDateUtc.getTime()) && !isNaN(fimDateUtc.getTime())) {
          const inicioLocalMs = inicioDateUtc.getTime() + offsetMinutes * 60000;
          const fimLocalMs = fimDateUtc.getTime() + offsetMinutes * 60000;
          const inicioLocal = new Date(inicioLocalMs);
          const fimLocal = new Date(fimLocalMs);

          const dia = pad(inicioLocal.getUTCDate());
          const mes = pad(inicioLocal.getUTCMonth() + 1);
          const ano = inicioLocal.getUTCFullYear();
          data_legivel = `${dia}/${mes}/${ano}`;

          const ih = pad(inicioLocal.getUTCHours());
          const imin = pad(inicioLocal.getUTCMinutes());
          const fh = pad(fimLocal.getUTCHours());
          const fmin = pad(fimLocal.getUTCMinutes());
          horario_legivel = `${ih}h${imin} às ${fh}h${fmin}`;
        }

        return {
          agendamento_id: row.agendamento_id,
          modalidade: row.modalidade,
          agendamento_status: row.agendamento_status,
          quadra_nome: row.quadra_nome,
          representante_nome: row.representante_nome,
          participantes_total: row.participantes_total,
          participantes_pagos: row.participantes_pagos,
          participantes_pendentes: row.participantes_pendentes,
          data_legivel,
          horario_legivel,
        };
      });

      if (!items.length) {
        const reply =
          "Não encontrei agendamentos para hoje no seu espaço. Se quiser, posso verificar outra data ou cliente específico.";
        console.log(`[chat-proxy][${reqId}] response`, {
          source: "tools-direct",
          duration_ms: duration,
          reply_preview: reply.slice(0, 200),
        });
        return new Response(JSON.stringify({ reply, source: "tools-direct" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
            "x-isis-source": "tools-direct",
            "x-isis-duration-ms": String(duration),
          },
        });
      }

      if (items.length <= 5) {
        const saudacaoNome = usuarioNome ? `Olá, ${usuarioNome}! ` : "";

        // Só executa fluxos determinísticos de ALTERAÇÃO quando o usuário expressar intenção de mudança
        if (userWantsChange) {
          // Segundo estágio determinístico: só com intenção de alteração explícita
          const isFollowupAck = /\b(certo|ok|blz|beleza|tudo bem|ent[aã]o)\b/i.test(message);
          if (items.length === 1 && isFollowupAck) {
            const unico = items[0] as any;
            const cliente = unico.representante_nome || "Cliente Consumidor";
            const quadra = unico.quadra_nome || "Quadra";
            const horarioAtual = unico.horario_legivel || "(horário não informado)";
            const novoHorarioLegivel = "14h00";

            const reply = `${saudacaoNome}Só pra confirmar: vou alterar o agendamento de hoje do **Cliente:** ${cliente} na **Quadra:** ${quadra}, que atualmente está em **Horário atual:** ${horarioAtual}, para **finalizar às ${novoHorarioLegivel}**.\n\nVocê confirma que deseja aplicar essa alteração? (sim/não)`;

            console.log(`[chat-proxy][${reqId}] response`, {
              source: "tools-direct",
              duration_ms: duration,
              reply_preview: reply.slice(0, 200),
            });
            return new Response(JSON.stringify({ reply, source: "tools-direct" }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
                "x-isis-source": "tools-direct",
                "x-isis-duration-ms": String(duration),
              },
            });
          }

          // Caso geral de até 5 agendamentos com intenção de alteração
          if (items.length === 1) {
            const unico = items[0] as any;
            const cliente = unico.representante_nome || "Cliente Consumidor";
            const quadra = unico.quadra_nome || "Quadra";
            const dataLegivel = unico.data_legivel || todayStr;
            const horarioLegivel = unico.horario_legivel || "(horário não informado)";
            const participantesTotal = Number(unico.participantes_total || 0);
            const participantesPagos = Number(unico.participantes_pagos || 0);
            const participantesPendentes = Number(unico.participantes_pendentes || 0);

            let md = `${saudacaoNome}📅 Hoje (${todayStr}) encontrei 1 agendamento que bate com o que você pediu:\n\n`;
            md += `1. ${unico.modalidade || "Agendamento"} – ${quadra}\n`;
            md += `   - **Cliente:** ${cliente}\n`;
            md += `   - **Data:** ${dataLegivel}\n`;
            md += `   - **Horário:** ${horarioLegivel}\n`;
            if (participantesTotal > 0) {
              md += `   - **Participantes:** ${participantesTotal} (${participantesPagos} pagos, ${participantesPendentes} pendentes)\n`;
            }
            md += `\nMe diga o que deseja alterar (novo horário, status, cancelar, remarcar etc.) que eu preparo e peço sua confirmação final.`;

            console.log(`[chat-proxy][${reqId}] response`, {
              source: "tools-direct",
              duration_ms: duration,
              reply_preview: md.slice(0, 200),
            });
            return new Response(JSON.stringify({ reply: md, source: "tools-direct", debug: { strategy: "reserve" } }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
                "x-isis-source": "tools-direct",
                "x-isis-duration-ms": String(duration),
              },
            });
          }

          let md = `${saudacaoNome}📅 Hoje (${todayStr}) encontrei ${items.length} agendamentos que posso alterar:\n\n`;

          items.forEach((it: any, idx: number) => {
            const linhaTitulo = `${idx + 1}. ${it.modalidade || "Agendamento"} – ${it.quadra_nome || "Quadra"}`;
            const cliente = it.representante_nome || "Cliente Consumidor";
            const participantesTotal = Number(it.participantes_total || 0);
            const participantesPagos = Number(it.participantes_pagos || 0);
            const participantesPendentes = Number(it.participantes_pendentes || 0);

            md += `${linhaTitulo}\n`;
            md += `   - **Cliente:** ${cliente}\n`;
            md += `   - **Data:** ${it.data_legivel || todayStr}\n`;
            md += `   - **Horário:** ${it.horario_legivel || "(horário não informado)"}\n`;
            if (participantesTotal > 0) {
              md += `   - **Participantes:** ${participantesTotal} (${participantesPagos} pagos, ${participantesPendentes} pendentes)\n`;
            }
            md += `\n`;
          });

          md += "Me diga **o número** do agendamento que você quer alterar (por exemplo, 1) e o que você deseja fazer (alterar horário, mudar status, cancelar, remarcar etc.), ou o nome do cliente, que eu preparo a alteração e peço sua confirmação final.";

          console.log(`[chat-proxy][${reqId}] response`, {
            source: "tools-direct",
            duration_ms: duration,
            reply_preview: md.slice(0, 200),
          });
          return new Response(JSON.stringify({ reply: md, source: "tools-direct" }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
              "x-isis-source": "tools-direct",
              "x-isis-duration-ms": String(duration),
            },
          });
        }
      }
      // Se houver muitos agendamentos hoje, deixa seguir o fluxo normal via OpenAI
    }

    // Prompt master definido apenas no backend (mais seguro do que vir do cliente)
    const masterPrompt = `
Você é a Ísis, assistente do Fluxo7 Arena. Fale em português, com tom profissional e simpático.

Você está conversando com um humano autenticado no sistema.
- ID do usuário: ${usuarioId || '(desconhecido)'}
- Nome do usuário: ${usuarioNome || '(desconhecido)'}
- Cargo/perfil: ${usuarioCargo || '(desconhecido)'}

Quando o usuário disser coisas como "meu", "meus agendamentos", "para mim", assuma que ele está falando deste usuário logado (${usuarioNome || 'usuário atual'}) dentro da empresa atual.

Hoje é ${todayStr}. Sempre que o usuário falar "hoje", "amanhã", "ontem", "esse mês", "mês que vem" ou expressões como "dia 28 desse mês" ou apenas "dia 28", você deve SEMPRE usar essa data (${todayStr}) como referência de calendário (ano e mês atuais), e NUNCA usar datas internas do seu treinamento.
Quando o usuário disser apenas um número de dia (por exemplo: "dia 28", "no dia 5") sem especificar mês/ano, você deve assumir que ele está falando do dia correspondente no MÊS e ANO ATUAIS, sem pedir confirmação, apenas deixando isso claro na resposta (por exemplo: "Considerando o dia 28/${thisMonthStr}/${thisYear}...").

Princípios:
- Ajude o usuário a entender e executar ações relativas à empresa atual.
- Nunca invente dados. Quando não souber, peça contexto/filtros.
- Use ferramentas quando disponíveis (function calling) para ler/escrever dados.
- Respeite a segurança: somente dados da empresa logada.
  - **Matriz de permissões (o que você PODE ou NÃO PODE alterar):**
  - Você pode **CRIAR e ALTERAR agendamentos** (horário, status, modalidade) usando as ferramentas apropriadas (por exemplo, create_agendamento e update_agendamento) ou os fluxos determinísticos específicos que o backend já implementa.
  - Para criar um agendamento, sempre peça e confirme com o usuário os dados mínimos: **cliente** (ou indicação de Cliente Consumidor), **data**, **horário de início e fim** e, quando fizer sentido, **quadra** e **modalidade**.
  - Fluxo de criação de agendamento:
    - Quando **todos os dados estiverem claros e sem ambiguidade** —
      **cliente único resolvido** (por nome ou código), **data**, **horário de início e fim**, e **quadra/modalidade** já **determinadas automaticamente** (ex.: arena com uma única quadra e/ou modalidade única) — **chame diretamente a ferramenta create_agendamento no mesmo turno**, sem pedir uma confirmação extra.
    - Caso ainda haja alguma incerteza (ex.: múltiplos clientes compatíveis, mais de uma modalidade disponível, mais de uma quadra possível), **não crie ainda**: proponha os valores e peça uma **confirmação única** do tipo "Posso criar assim para você?".
    - Se você tiver acabado de **listar opções para o usuário escolher** (por exemplo, clientes 1, 2, 3) e ele responder com **o número, o código ou o nome exato** de uma das opções, **considere isso como confirmação final** e **chame create_agendamento no mesmo turno** (desde que data, horário e quadra/modalidade também estejam definidos ou possam ser assumidos automaticamente).
    - Se o usuário responder algo como **"sim"**, **"pode criar"**, **"ok"**, **"isso mesmo"**, então **chame create_agendamento imediatamente** no turno seguinte com os dados já definidos e informe o resultado.
    - **Não fique em ciclos de confirmação** sem chamar a tool quando os dados já estiverem definidos.
  - Sempre que o usuário mencionar um cliente pelo nome (por exemplo: "agendar pro João Silva amanhã às 20h"), tente primeiro localizar esse cliente cadastrado usando a ferramenta get_clientes, com search_term baseado no nome ou telefone informado:
    - Se get_clientes retornar exatamente 1 cliente compatível, considere que é esse cliente e, ao chamar create_agendamento, preencha cliente_codigo com o código ou id retornado e cliente_nome com o nome oficial do cadastro.
    - Se get_clientes retornar mais de um cliente compatível (nomes iguais ou muito parecidos), não crie o agendamento ainda: **liste SEMPRE com _Código_ e _Nome_** (e **Telefone** quando existir), numere as opções e **peça que o usuário escolha pelo número ou pelo código**. Explique que nenhum agendamento foi criado ainda.
    - Se get_clientes não encontrar nenhum cliente compatível, siga o fluxo de **Cliente Consumidor** descrito abaixo.
  - Quando o usuário quiser usar **Cliente Consumidor** (sem cadastro) ou quando você não encontrar nenhum cliente cadastrado compatível:
    - não preencha o campo cliente_codigo na chamada de create_agendamento;
    - use em cliente_nome **exatamente o nome informado pelo usuário** (por exemplo: "Gilmar"), sem prefixar com "Consumidor" nem acrescentar sufixos como "(sem cadastro)". Trate esse nome como a identificação amigável do responsável pelo agendamento;
    - deixe isso claro na resposta para o usuário, explicando em texto que o agendamento será criado como **consumidor sem cadastro** com esse nome, mas sem incluir a palavra "Consumidor" dentro do próprio nome.
  - Para definir **quadra e modalidade** na criação de agendamentos, use a ferramenta get_quadras para entender a configuração da arena antes de chamar create_agendamento:
    - Assim que você entender que o usuário quer **criar um agendamento em uma data/horário específicos**, use get_quadras **no próprio primeiro turno de proposta de criação**, em conjunto com get_clientes. Ou seja, não espere o usuário responder "sim" para só então chamar get_quadras; você pode buscar as quadras/modalidades de forma proativa.
    - Se get_quadras retornar **exatamente 1 quadra** com **exatamente 1 modalidade cadastrada**, você pode assumir automaticamente essa combinação e deixar isso claro já na primeira resposta de confirmação (por exemplo, mencionando a quadra e a modalidade que serão usadas), sem pedir que o usuário escolha quadra/modalidade.
    - Se get_quadras retornar **mais de uma quadra** ou **mais de uma modalidade**, **não chame create_agendamento ainda**: liste as opções relevantes (quadras e/ou modalidades) com labels em negrito e peça explicitamente para o usuário escolher a quadra e/ou modalidade desejadas. Só depois dessa escolha chame create_agendamento já com os campos quadra_id (quando aplicável) e modalidade preenchidos.
    - Nunca chame create_agendamento sem informar uma modalidade válida quando houver mais de uma modalidade disponível para a quadra; use sempre o resultado de get_quadras ou a escolha direta do usuário para definir a modalidade.
    - Use get_quadras **no máximo uma vez em cada fluxo de criação de agendamento**. Depois que você já tiver dito para o usuário qual será a quadra e a modalidade utilizadas, considere essas informações como definidas e parta para a criação efetiva (create_agendamento) após a confirmação, em vez de chamar get_quadras novamente para o mesmo pedido.
  - Dados de **clientes**, **comandas**, **faturamento/financeiro** e qualquer outro domínio são **somente leitura**: você pode consultar, resumir e explicar, mas NÃO pode criar/editar/excluir registros nesses módulos.
  - Se o usuário pedir para alterar algo que não seja agendamento (por exemplo: mudar nome de cliente, editar dados de comanda, ajustar fatura/caixa), explique claramente que você **não tem permissão para alterar esses dados** e oriente a usar as telas do sistema apropriadas (ex.: tela de Clientes, tela de Comandas, tela de Financeiro).
- Prefira respostas curtas com:
  - Resumo
  - Pontos-chave
  - Próximos passos (se houver).

Escopo de conhecimento do sistema (alto nível):
- Agenda/Quadras: agendamentos, participantes, disponibilidade, configurações (agenda_settings), quadras e dias de funcionamento.
- Clientes: cadastro e busca por nome/telefone.
- Vendas/Produtos: vendas, itens_venda, produtos, categorias.
- Comandas/Mesas: comandas, comanda_itens, mesas.
- Financeiro/Caixa: caixa_sessoes, caixa_movimentos, caixa_resumos, pagamentos.

Boas práticas de interação:
- Estilo geral (parecido com o ChatGPT):
  - Responda de forma clara, direta e educada.
  - Use Markdown simples para organizar a resposta: listas e, quando fizer sentido, um parágrafo final com comentário/sugestão. **Não use headings com "#" (por exemplo, linhas começando com ###)**, pois o frontend não renderiza títulos, apenas texto normal.
  - Use **negrito apenas em labels importantes**, e use SEMPRE labels em negrito quando estiver apresentando dados estruturados ou pedidos de confirmação. Exemplos de labels: **Cliente:**, **Data:**, **Quadra:**, **Status:**, **Horário atual:**, **Novo horário:**.
  - Sempre que estiver propondo a criação de um novo agendamento, formate a proposta em uma lista legível com uma linha por campo principal, por exemplo:
    - **Cliente:** ...
    - **Data:** ...
    - **Horário:** ...
    - **Quadra:** ...
    - **Modalidade:** ...
    Em seguida, faça a pergunta de confirmação (por exemplo: "Posso criar assim para você?").
  - Use emojis com moderação, mas de forma consistente: na maior parte das respostas inclua **pelo menos 1 emoji** (geralmente na primeira frase), e no máximo 1 ou 2 por resposta. Não encha todos os itens com emojis.
  - Evite prometer respostas intermediárias que não vão acontecer. Por exemplo, ao verificar quadras/modalidades para criação de agendamento, **não diga que vai "verificar e já volta" ou peça para o usuário "aguardar" se você vai tratar isso internamente e seguir direto para a confirmação única**. Prefira já explicar na própria resposta o que será feito e pedir a confirmação necessária.
  - Ao falar com o usuário, evite usar a palavra "empresa". Prefira se referir ao contexto como "sua arena", "seu espaço" ou pelo nome do local quando isso estiver claro na conversa. Use "empresa" apenas como conceito interno/técnico neste prompt, não nas frases mostradas ao usuário.
  - Quando falar de **status** com o usuário, **nunca use os valores internos em inglês** (por exemplo: "scheduled", "confirmed", "finished", "canceled", "in_progress") nas frases. Sempre traduza para rótulos em português, por exemplo:
    - scheduled → **Agendado**
    - confirmed → **Confirmado**
    - finished / concluded / done → **Concluído**
    - canceled / cancelled → **Cancelado**
    - in_progress → **Em andamento**
    - pending → **Pendente**
    Esses valores em inglês devem ser usados **apenas internamente** ao preencher o campo 'status' nas tools (como update_agendamento ou create_agendamento), nunca exibidos literalmente ao usuário. Ao falar de status padrão em uma frase, use sempre o rótulo em português (por exemplo: "status padrão será **Agendado**" em vez de "scheduled"). Na **criação de novos agendamentos**, não ofereça opções de status nem pergunte qual status usar; assuma o status padrão interno "scheduled" (Agendado) e só altere o status quando o usuário pedir isso de forma clara (por exemplo: cancelar, confirmar, concluir).
  - Na criação de agendamentos, em empresas com **apenas uma quadra ativa**, não peça para o usuário escolher quadra: considere que a quadra única será usada automaticamente pelo sistema (você pode apenas mencionar o nome da quadra na confirmação, se fizer sentido). Em respostas e pedidos de confirmação, nesses casos nunca diga que precisa que o usuário informe a quadra; trate a quadra como já definida.
  - Para **modalidade**, nunca invente modalidades livres: use sempre as modalidades cadastradas na quadra. Quando o backend ou as tools de criação retornarem uma lista de modalidades disponíveis para aquela quadra, ofereça essas opções ao usuário para ele escolher uma delas, em vez de aceitar qualquer texto arbitrário. **Se a quadra tiver exatamente uma modalidade cadastrada, você pode assumir essa modalidade automaticamente, sem perguntar ao usuário; só peça modalidade quando houver mais de uma opção ou quando uma chamada anterior de create_agendamento tiver falhado por modalidade inválida.** Se uma chamada de create_agendamento falhar indicando problema de modalidade e trazendo uma lista de modalidades_disponiveis na resposta da tool, use essa lista para pedir apenas a modalidade correta, sem dizer que precisa da quadra.
  - Nunca exponha **IDs internos** (UUIDs, IDs de banco) nas mensagens para o usuário.
    - Ao listar opções (clientes, quadras, modalidades), mostre **apenas nomes** e, quando fizer sentido, **numere os itens**.
    - Aceite a escolha do usuário por **número** ou por **nome exato**; você não deve solicitar códigos/UUIDs internos.
  - Para consultas de agenda (agendamentos):
  - Se o usuário fizer uma pergunta genérica sobre agendamentos (por exemplo: "quais os agendamentos?"), **NÃO peça confirmação de período**: assuma diretamente HOJE (00:00 às 23:59) e deixe isso claro na resposta.
  - Só peça datas explícitas se o usuário mencionar claramente que quer outro período (ex.: semana, mês, intervalo personalizado).
  - Use filtros como quadra, status e **cliente_nome** quando o usuário estiver perguntando especificamente sobre **agendamentos** de um cliente (por exemplo: "quais agendamentos do cliente Dominyck?").
  - Ao responder usando resultados de get_agendamentos:
    - Use SEMPRE o contexto da pergunta para decidir o tom: se o usuário só quis consultar, foque em listar/resumir; se a pergunta já indicar intenção de mudar algo (horário, status, cancelar, remarcar), deixe isso claro na resposta e já proponha próximos passos.
  - Quando o usuário perguntar se existe algum cliente com certo nome, telefone, e-mail ou código (por exemplo: "tem algum cliente com nome Dominyck?", "listar clientes com telefone X"), use **sempre** a ferramenta get_clientes com search_term baseado no que ele informou.
  - Nessas consultas, responda falando sobre **clientes encontrados** (Nome, **Código**, contato etc.), e **não sobre agendamentos**, a menos que o usuário peça explicitamente pelos agendamentos desses clientes.
// ...

  - Considere result.filters.data_inicio/data_fim como a janela de datas efetivamente aplicada.
- Não retorne segredos/credenciais.
- Se não houver ferramenta para a tarefa, explique a limitação e sugira alternativas.
`;

    const systemPrompt = masterPrompt;

    // messages é tipado como any[] para permitir campos específicos de tool calling (tool_calls, etc.)
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message }
    ];

    // Coletar infos de ferramentas usadas para fins de debug (expostas ao frontend)
    const debugTools: Array<{ name: string; args?: any; summary?: any; error?: string }> = [];

    // Log pergunta do usuário
    console.log(`[chat-proxy][${reqId}] user_message`, {
      message,
      history_count: history.length,
      at: new Date().toISOString(),
    });

    // Definição de tools (funções) disponíveis para a LLM
    const tools = [
      {
        type: "function",
        function: {
          name: "get_agendamentos",
          description: "Lista agendamentos por período e filtros opcionais (somente leitura).",
          parameters: {
            type: "object",
            properties: {
              data_inicio: { type: "string", nullable: true, description: "ISO date/time de início do período. Se vazio, assume hoje 00:00." },
              data_fim: { type: "string", nullable: true, description: "ISO date/time de fim do período. Se vazio, assume hoje 23:59." },
              status: { type: "string", nullable: true },
              cliente_nome: { type: "string", nullable: true, description: "Parte do nome do cliente (representante_nome) para filtrar agendamentos." },
              quadra_id: { type: "string", nullable: true },
              page: { type: "integer", nullable: true },
              page_size: { type: "integer", nullable: true }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_agendamento",
          description: "Cria um novo agendamento na tabela agendamentos para a empresa atual.",
          parameters: {
            type: "object",
            properties: {
              cliente_codigo: { type: "string", nullable: true, description: "Código do cliente na tabela clientes. Se ausente, será tratado como Cliente Consumidor." },
              cliente_nome: { type: "string", description: "Nome do cliente responsável ou descrição para Cliente Consumidor (pode ser nome mascarado)." },
              data: { type: "string", description: "Data do agendamento no formato YYYY-MM-DD (fuso da arena)." },
              hora_inicio: { type: "string", description: "Horário inicial no formato HH:mm (fuso da arena)." },
              hora_fim: { type: "string", description: "Horário final no formato HH:mm (fuso da arena). Use 00:00 para meia-noite do dia seguinte." },
              quadra_id: { type: "string", nullable: true, description: "ID da quadra (quando conhecido)." },
              modalidade: { type: "string", nullable: false, description: "Modalidade/esporte do agendamento. Na prática é obrigatória; pode ser omitida apenas quando a quadra tiver exatamente uma modalidade cadastrada (o backend assume automaticamente)." },
              status: { type: "string", nullable: true, description: "Status inicial do agendamento (padrão: scheduled)." }
            },
            required: ["cliente_nome", "data", "hora_inicio", "hora_fim", "modalidade"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_agendamento",
          description: "Atualiza campos permitidos de um agendamento (permitido mexer em agendamentos).",
          parameters: {
            type: "object",
            properties: {
              agendamento_id: { type: "string" },
              campos: { type: "object", description: "Campos mutáveis (ex.: inicio, fim, status, participantes)", additionalProperties: true }
            },
            required: ["agendamento_id", "campos"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_clientes",
          description: "Lista clientes cadastrados (tabela clientes) filtrando por nome, email, telefone ou código (somente leitura).",
          parameters: {
            type: "object",
            properties: {
              search_term: { type: "string", nullable: true, description: "Texto para buscar em nome, email, telefone ou código." },
              limit: { type: "integer", nullable: true, description: "Quantidade máxima de clientes a retornar (padrão 20)." }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_quadras",
          description: "Lista quadras da empresa atual (tabela quadras), incluindo modalidades configuradas (somente leitura).",
          parameters: {
            type: "object",
            properties: {
              apenas_ativas: { type: "boolean", nullable: true, description: "Se true, retorna apenas quadras com status 'Ativa'." },
              limit: { type: "integer", nullable: true, description: "Quantidade máxima de quadras a retornar (padrão 20)." }
            },
            required: []
          }
        }
      }
    ];

    const firstResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages,
        tools,
        tool_choice: "auto"
      }),
    });

    // Perguntas genéricas sobre agendamentos de HOJE (para possível fallback em caso de 429)
    // Usamos uma detecção mais ampla: qualquer mensagem que mencione "hoje" e algo com "agend".
    const normalizedMessage = String(message || "").toLowerCase();
    const isGenericAgendaTodayQuestion =
      normalizedMessage.includes("hoje") &&
      /agend/.test(normalizedMessage);

    if (!firstResp.ok) {
      const duration = Date.now() - startedAt;
      console.log(`[chat-proxy][${reqId}] openai_error status=${firstResp.status} duration_ms=${duration}`);

      // Fallback especial: se for 429 e a pergunta for sobre agendamentos de hoje,
      // responde diretamente via consulta à view v_agendamentos_isis.
      if (firstResp.status === 429 && isGenericAgendaTodayQuestion) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
        const authHeader = req.headers.get("Authorization") || "";
        const sbDirect = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });

        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0, 0);
        const data_inicio = start.toISOString();
        const data_fim = end.toISOString();

        const { data, error } = await sbDirect
          .from("v_agendamentos_isis")
          .select(
            "agendamento_id, inicio, fim, modalidade, agendamento_status, quadra_nome, representante_nome, participantes_total, participantes_pagos, participantes_pendentes"
          )
          .eq("codigo_empresa", empresaCodigo)
          .gte("inicio", data_inicio)
          .lt("inicio", data_fim)
          .order("inicio", { ascending: true });

        if (error) {
          const reply =
            "Não consegui listar os agendamentos de hoje para responder sua pergunta agora. Tente novamente em alguns instantes.";
          return new Response(JSON.stringify({ reply, source: "fallback", debug: { strategy: "reserve" } }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
              "x-isis-source": "fallback",
              "x-isis-duration-ms": String(duration),
            },
          });
        }

        const pad = (n: number) => String(n).padStart(2, "0");
        const normalizeIso = (iso: string) => (iso.includes("T") ? iso : iso.replace(" ", "T"));
        const offsetMinutes = -3 * 60; // UTC-3

        const items = (data || []).map((row: any) => {
          const inicioDateUtc = new Date(normalizeIso(String(row.inicio || "")));
          const fimDateUtc = new Date(normalizeIso(String(row.fim || "")));
          let data_legivel = "";
          let horario_legivel = "";

          if (!isNaN(inicioDateUtc.getTime()) && !isNaN(fimDateUtc.getTime())) {
            const inicioLocalMs = inicioDateUtc.getTime() + offsetMinutes * 60000;
            const fimLocalMs = fimDateUtc.getTime() + offsetMinutes * 60000;
            const inicioLocal = new Date(inicioLocalMs);
            const fimLocal = new Date(fimLocalMs);

            const dia = pad(inicioLocal.getUTCDate());
            const mes = pad(inicioLocal.getUTCMonth() + 1);
            const ano = inicioLocal.getUTCFullYear();
            data_legivel = `${dia}/${mes}/${ano}`;

            const ih = pad(inicioLocal.getUTCHours());
            const imin = pad(inicioLocal.getUTCMinutes());
            const fh = pad(fimLocal.getUTCHours());
            const fmin = pad(fimLocal.getUTCMinutes());
            horario_legivel = `${ih}h${imin} às ${fh}h${fmin}`;
          }

          return {
            agendamento_id: row.agendamento_id,
            modalidade: row.modalidade,
            agendamento_status: row.agendamento_status,
            quadra_nome: row.quadra_nome,
            representante_nome: row.representante_nome,
            participantes_total: row.participantes_total,
            participantes_pagos: row.participantes_pagos,
            participantes_pendentes: row.participantes_pendentes,
            data_legivel,
            horario_legivel,
          };
        });

        if (!items.length) {
          const reply = `Hoje (${todayStr}) não há agendamentos no seu espaço.`;
          return new Response(JSON.stringify({ reply, source: "tools-direct", debug: { strategy: "reserve" } }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
              "x-isis-source": "tools-direct",
              "x-isis-duration-ms": String(duration),
            },
          });
        }

        const mapStatus = (st: string | null | undefined) => {
          if (!st) return "";
          const s = String(st).toLowerCase();
          if (s === "scheduled") return "Agendado";
          if (s === "confirmed") return "Confirmado";
          if (s === "finished" || s === "concluded" || s === "done") return "Concluído";
          if (s === "canceled" || s === "cancelled") return "Cancelado";
          if (s === "in_progress") return "Em andamento";
          return st;
        };

        let md = `📅 Agendamentos para o dia ${todayStr}\n\n`;
        const totalItems = items.length;
        md += `Encontrei ${totalItems} agendamento${totalItems === 1 ? "" : "s"} hoje. Veja os detalhes abaixo:\n\n`;

        items.forEach((it, idx) => {
          const linhaTitulo = `${idx + 1}. ${it.modalidade || "Agendamento"} – ${it.quadra_nome || "Quadra"}`;
          const cliente = it.representante_nome || "Cliente Consumidor";
          const status = mapStatus(it.agendamento_status);
          const participantesTotal = Number(it.participantes_total || 0);
          const participantesPagos = Number(it.participantes_pagos || 0);
          const participantesPendentes = Number(it.participantes_pendentes || 0);

          md += `${linhaTitulo}\n`;
          md += `   - **Cliente:** ${cliente}\n`;
          md += `   - **Data:** ${it.data_legivel || todayStr}\n`;
          md += `   - **Horário:** ${it.horario_legivel || "(horário não informado)"}\n`;
          if (status) md += `   - **Status:** ${status}\n`;
          if (participantesTotal > 0) {
            md += `   - **Participantes:** ${participantesTotal} (${participantesPagos} pagos, ${participantesPendentes} pendentes)\n`;
          }
          md += `\n`;
        });

        return new Response(JSON.stringify({ reply: md, source: "tools-direct" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
            "x-isis-source": "tools-direct",
            "x-isis-duration-ms": String(duration),
          },
        });
      }

      let reply = "Ops! Tive um problema ao responder agora.";
      if (firstResp.status === 429) {
        reply = "Estou recebendo muitas solicitações do meu motor de IA neste momento e não consegui concluir essa ação agora. Tente novamente em alguns instantes.";
      }

      return new Response(JSON.stringify({ reply, source: "fallback" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "fallback", "x-isis-duration-ms": String(duration) },
      });
    }

    const firstData = await firstResp.json();
    const choice = firstData?.choices?.[0];
    const toolCalls = choice?.message?.tool_calls ?? [];

    // Se o modelo solicitou tools, executa handlers locais (com RLS via JWT)
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
      const authHeader = req.headers.get("Authorization") || "";
      const sb = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      // Importante: incluir a mensagem de assistant com tool_calls antes das mensagens de tool
      messages.push({
        role: "assistant",
        content: choice?.message?.content ?? "",
        tool_calls: toolCalls,
      });

      let lastGetAgendamentosResult: any = null;
      let lastGetClientesResult: any = null;
      let lastUpdateAgendamentoResult: any = null;
      let lastCreateAgendamentoResult: any = null;

      for (const tc of toolCalls) {
        const name = tc?.function?.name as string;
        const argsRaw = tc?.function?.arguments || "{}";
        // result começa como null e só recebe ok=false quando houver um erro explícito.
        // Isso evita bloquear operações válidas (como create_agendamento) por causa de um estado inicial "ok: false".
        let result: any = null;
        try {
          const args = JSON.parse(argsRaw);
          if (name === "get_agendamentos") {
            // READ: lista agendamentos por período (RLS aplicado pelo JWT)
            const page = Number(args?.page || 1);
            const page_size = Math.min(Math.max(Number(args?.page_size || 50), 1), 200);
            const from = (page - 1) * page_size;
            const to = from + page_size - 1;

            // Período vem prioritariamente dos ARGUMENTOS da tool (interpretados pela LLM).
            // Só se a LLM não passar datas é que usamos o período padrão enviado pelo frontend (body).
            // Fallback HOJE só é aplicado para consultas genéricas (sem cliente_nome).
            let data_inicio = String(args?.data_inicio || "").trim();
            let data_fim = String(args?.data_fim || "").trim();

            if (!data_inicio || !data_fim) {
              const bodyInicio = String(body?.data_inicio || "").trim();
              const bodyFim = String(body?.data_fim || "").trim();
              if (bodyInicio && bodyFim) {
                data_inicio = bodyInicio;
                data_fim = bodyFim;
              }
            }

            const hasExplicitDates = Boolean(data_inicio && data_fim);
            const hasClienteNomeFilter = Boolean(String(args?.cliente_nome || "").trim());

            // Fallback final: HOJE no servidor **apenas** se não houver
            // cliente_nome nem datas explícitas (consulta genérica de agenda).
            if (!hasExplicitDates && !hasClienteNomeFilter) {
              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
              const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
              data_inicio = start.toISOString();
              data_fim = end.toISOString();
            }

            // Alinhar com Agenda: quando tivermos período definido, filtrar por inicio entre [data_inicio, data_fim).
            // Usamos sempre a view v_agendamentos_isis, que já retorna 1 linha por agendamento.
            let query = sb
              .from("v_agendamentos_isis")
              .select(
                "agendamento_id, agendamento_codigo, codigo_empresa, inicio, fim, modalidade, agendamento_status, quadra_id, quadra_nome, representante_nome, participantes_total, participantes_pagos, participantes_pendentes",
                { count: "exact" }
              )
              .eq("codigo_empresa", empresaCodigo)
              .order("inicio", { ascending: true })
              .range(from, to);

            if (data_inicio && data_fim) {
              query = query.gte("inicio", data_inicio).lt("inicio", data_fim);
            }

            if (args?.status) query = query.eq("agendamento_status", String(args.status));
            if (args?.quadra_id) query = query.eq("quadra_id", String(args.quadra_id));
            if (args?.cliente_nome) {
              const nome = String(args.cliente_nome).trim();
              if (nome) {
                query = query.ilike("representante_nome", `%${nome}%`);
              }
            }

            const { data, error, count } = await query;
            if (error) throw error;

            // Enriquecer com campos legíveis de data/horário (a view já está por agendamento)
            // Conversão para horário local (UTC-3) para alinhar com o que o usuário vê na Agenda.
            const pad = (n: number) => String(n).padStart(2, "0");
            const offsetMinutes = -3 * 60; // UTC-3

            const items = (data || []).map((row: any) => {
              const normalizeIso = (iso: string) => iso.includes("T") ? iso : iso.replace(" ", "T");
              const inicioIsoRaw = String(row.inicio || "");
              const fimIsoRaw = String(row.fim || "");
              let data_legivel = "";
              let horario_legivel = "";

              try {
                const inicioDateUtc = new Date(normalizeIso(inicioIsoRaw));
                const fimDateUtc = new Date(normalizeIso(fimIsoRaw));
                if (!isNaN(inicioDateUtc.getTime()) && !isNaN(fimDateUtc.getTime())) {
                  const inicioLocalMs = inicioDateUtc.getTime() + offsetMinutes * 60000;
                  const fimLocalMs = fimDateUtc.getTime() + offsetMinutes * 60000;
                  const inicioLocal = new Date(inicioLocalMs);
                  const fimLocal = new Date(fimLocalMs);

                  const dia = pad(inicioLocal.getUTCDate());
                  const mes = pad(inicioLocal.getUTCMonth() + 1);
                  const ano = inicioLocal.getUTCFullYear();
                  data_legivel = `${dia}/${mes}/${ano}`;

                  const ih = pad(inicioLocal.getUTCHours());
                  const imin = pad(inicioLocal.getUTCMinutes());
                  const fh = pad(fimLocal.getUTCHours());
                  const fmin = pad(fimLocal.getUTCMinutes());
                  horario_legivel = `${ih}h${imin} às ${fh}h${fmin}`;
                }
              } catch {}

              if (!data_legivel) {
                data_legivel = "";
              }
              if (!horario_legivel) {
                horario_legivel = "(horário não informado)";
              }

              return {
                agendamento_id: row.agendamento_id,
                agendamento_codigo: row.agendamento_codigo,
                codigo_empresa: row.codigo_empresa,
                inicio: row.inicio,
                fim: row.fim,
                modalidade: row.modalidade,
                agendamento_status: row.agendamento_status,
                quadra_id: row.quadra_id,
                quadra_nome: row.quadra_nome,
                representante_nome: row.representante_nome,
                participantes_total: row.participantes_total,
                participantes_pagos: row.participantes_pagos,
                participantes_pendentes: row.participantes_pendentes,
                data_legivel,
                horario_legivel,
              };
            });

            result = {
              ok: true,
              policy: "read-only",
              domain: "agenda",
              filters: { ...args, page, page_size, data_inicio, data_fim },
              total: items.length,
              rows_total: count ?? 0,
              items,
            };
            lastGetAgendamentosResult = result;
          } else if (name === "create_agendamento") {
            // WRITE: criar novo agendamento (RLS via JWT + filtro de empresa)
            const clienteNomeRaw = String(args?.cliente_nome || "").trim();
            const dataRaw = String(args?.data || "").trim(); // YYYY-MM-DD
            const horaInicioRaw = String(args?.hora_inicio || "").trim(); // HH:mm
            const horaFimRaw = String(args?.hora_fim || "").trim(); // HH:mm

            if (!clienteNomeRaw || !dataRaw || !horaInicioRaw || !horaFimRaw) {
              result = {
                ok: false,
                policy: "write-rejected",
                domain: "agenda",
                error: "cliente_nome, data, hora_inicio e hora_fim são obrigatórios para create_agendamento.",
              };
            } else if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dataRaw)) {
              result = {
                ok: false,
                policy: "write-rejected",
                domain: "agenda",
                error: "Formato de data inválido. Use YYYY-MM-DD.",
              };
            } else if (!/^[0-9]{2}:[0-9]{2}$/.test(horaInicioRaw) || !/^[0-9]{2}:[0-9]{2}$/.test(horaFimRaw)) {
              result = {
                ok: false,
                policy: "write-rejected",
                domain: "agenda",
                error: "Formato de hora inválido. Use HH:mm.",
              };
            } else {
              // Se cliente_codigo for informado, resolve para cliente_id via tabela clientes
              const clienteCodigoRaw = String(args?.cliente_codigo || "").trim();
              let resolvedClienteId: string | null = null;
              if (clienteCodigoRaw) {
                const isNumericCodigo = /^\d+$/.test(clienteCodigoRaw);
                let cliQuery = sb
                  .from("clientes")
                  .select("id, codigo")
                  .eq("codigo_empresa", empresaCodigo);

                if (isNumericCodigo) {
                  cliQuery = cliQuery.eq("codigo", clienteCodigoRaw);
                } else {
                  // Se não for numérico (por exemplo, um UUID), interpretamos como id do cliente
                  cliQuery = cliQuery.eq("id", clienteCodigoRaw);
                }

                const { data: cliRow, error: cliErr } = await cliQuery.maybeSingle();

                if (cliErr) throw cliErr;
                if (!cliRow) {
                  result = {
                    ok: false,
                    policy: "write-rejected",
                    domain: "agenda",
                    error: "Nenhum cliente encontrado com o código informado para esta empresa.",
                  };
                } else {
                  resolvedClienteId = String(cliRow.id);
                }
              }

              // Salvaguarda: quando cliente_codigo não foi informado, tentar resolver por NOME
              if (!resolvedClienteId && clienteNomeRaw) {
                try {
                  // Buscar por nome aproximado (ilike) e depois filtrar com normalização em memória
                  const { data: candRows, error: candErr } = await sb
                    .from("clientes")
                    .select("id, nome, status, flag_cliente")
                    .eq("codigo_empresa", empresaCodigo)
                    .eq("status", "active")
                    .eq("flag_cliente", true)
                    .ilike("nome", `%${clienteNomeRaw}%`)
                    .limit(20);

                  if (!candErr && Array.isArray(candRows) && candRows.length > 0) {
                    const canon = (s: string) => s
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .toLowerCase()
                      .trim()
                      .replace(/\s+/g, " ");

                    const target = canon(clienteNomeRaw);
                    const scored = candRows.map((r: any) => {
                      const c = canon(String(r.nome || ""));
                      // score simples: igualdade canônica > inclusão de tokens > match ilike genérico
                      let score = 0;
                      if (c === target) score = 3;
                      else if (c.includes(target) || target.includes(c)) score = 2;
                      else score = 1;
                      return { id: String(r.id), nome: String(r.nome || ""), score };
                    });

                    // Pega os de maior score
                    const maxScore = Math.max(...scored.map(s => s.score));
                    const top = scored.filter(s => s.score === maxScore);

                    if (top.length === 1) {
                      resolvedClienteId = top[0].id;
                    } else if (top.length > 1) {
                      // Ambíguo: não criar, pedir desambiguação ao modelo (via erro controlado)
                      result = {
                        ok: false,
                        policy: "write-rejected",
                        domain: "agenda",
                        error: "Foram encontrados múltiplos clientes compatíveis com o nome informado. Preciso que você escolha um cliente específico antes de criar o agendamento.",
                        candidatos: top.slice(0, 5),
                      };
                    }
                  }
                } catch (e: any) {
                  // Em caso de erro na checagem de nome, segue fluxo normal (consumidor) sem bloquear
                  console.log("[chat-proxy] erro ao tentar resolver cliente por nome em create_agendamento", {
                    message: e?.message,
                  });
                }
              }

              if (result && result.ok === false && result.policy === "write-rejected" && String(result.error || "").startsWith("Nenhum cliente encontrado")) {
                // Falha na resolução do código do cliente: não tenta criar o agendamento
              } else {
              const [year, month, day] = dataRaw.split("-").map((v: string) => parseInt(v, 10));
              const [h1, m1] = horaInicioRaw.split(":").map((v: string) => parseInt(v, 10));
              const [h2, m2] = horaFimRaw.split(":").map((v: string) => parseInt(v, 10));

              const offsetMinutes = -3 * 60; // UTC-3
              const toUtcIsoFromLocal = (y: number, mo: number, d: number, h: number, mi: number) => {
                const localMs = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
                const utcMs = localMs - offsetMinutes * 60000;
                return new Date(utcMs).toISOString();
              };

              const inicioIso = toUtcIsoFromLocal(year, month, day, h1, m1);

              // Se fim for 00:00, considerar meia-noite do dia seguinte
              let endYear = year;
              let endMonth = month;
              let endDay = day;
              if (h2 === 0 && m2 === 0) {
                const tmp = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
                tmp.setUTCDate(tmp.getUTCDate() + 1);
                endYear = tmp.getUTCFullYear();
                endMonth = tmp.getUTCMonth() + 1;
                endDay = tmp.getUTCDate();
              }
              const fimIso = toUtcIsoFromLocal(endYear, endMonth, endDay, h2, m2);

              let quadraId = args?.quadra_id ? String(args.quadra_id) : null;
              const clienteId = resolvedClienteId;
              let quadraModalidades: string[] | null = null;
              // Resolver quadra quando o argumento não é um UUID (pode ser índice, código ou nome)
              if (quadraId) {
                const looksLikeUuid = /^[0-9a-fA-F-]{10,}$/;
                if (!looksLikeUuid.test(quadraId)) {
                  try {
                    // 0) Se vier um número pequeno (ex.: "1"), tratamos como índice da lista ordenada por nome
                    let resolvedByIndex = false;
                    if (/^\d+$/.test(quadraId)) {
                      const idx = parseInt(quadraId, 10);
                      if (idx >= 1) {
                        const { data: allQs, error: allErr } = await sb
                          .from("quadras")
                          .select("id, nome, modalidades")
                          .eq("codigo_empresa", empresaCodigo)
                          .order("nome", { ascending: true });
                        if (!allErr && Array.isArray(allQs) && idx <= allQs.length) {
                          const chosen = allQs[idx - 1] as any;
                          quadraId = String(chosen.id);
                          const rawMods = chosen?.modalidades;
                          if (Array.isArray(rawMods)) {
                            quadraModalidades = rawMods.map((m: any) => String(m || "").trim()).filter(Boolean);
                          } else if (typeof rawMods === "string" && rawMods.trim()) {
                            quadraModalidades = rawMods.split(",").map((m: string) => m.trim()).filter(Boolean);
                          }
                          // índice resolvido com sucesso
                          resolvedByIndex = true;
                        } else {
                          // se não conseguiu resolver por índice, segue outras heurísticas
                        }
                      }
                    }

                    // 1) Se NÃO resolvemos por índice, tentamos por id/código/nome
                    if (!resolvedByIndex) {
                      const orParts: string[] = [
                        `id.eq.${quadraId}`,
                        `nome.ilike.%${quadraId}%`,
                      ];
                      // 'codigo' pode não existir em todos os esquemas; ainda assim incluímos e tratamos erro mais abaixo se ocorrer
                      orParts.push(`codigo.eq.${quadraId}`);

                      const { data: qCands, error: qFindErr } = await sb
                        .from("quadras")
                        .select("id, nome, modalidades")
                        .eq("codigo_empresa", empresaCodigo)
                        .or(orParts.join(","))
                        .limit(3);

                      if (!qFindErr && Array.isArray(qCands)) {
                        if (qCands.length === 1) {
                          quadraId = String(qCands[0].id);
                          const rawMods = (qCands[0] as any).modalidades;
                          if (Array.isArray(rawMods)) {
                            quadraModalidades = rawMods.map((m: any) => String(m || "").trim()).filter(Boolean);
                          } else if (typeof rawMods === "string" && rawMods.trim()) {
                            quadraModalidades = rawMods.split(",").map((m: string) => m.trim()).filter(Boolean);
                          }
                        } else if (qCands.length > 1) {
                          result = {
                            ok: false,
                            policy: "write-rejected",
                            domain: "agenda",
                            error: "Foram encontradas múltiplas quadras compatíveis com a referência informada. Preciso que você escolha uma quadra específica.",
                            quadras_candidatas: qCands.map((q: any) => ({ id: String(q.id), nome: String(q.nome || "") })).slice(0, 5),
                          };
                        } else {
                          // Nada encontrado; deixamos seguir para heurística de quadra única da empresa
                          quadraId = null;
                        }
                      } else {
                        // Em caso de erro na busca, deixa seguir heurística de quadra única
                        quadraId = null;
                      }
                    }
                  } catch {
                    quadraId = null;
                  }
                }
              }
              let modalidadeRaw = args?.modalidade ? String(args.modalidade).trim() : "";
              const status = args?.status ? String(args.status) : "scheduled";

              // 0) Inferir quadra ANTES de pedir escolha, usando modalidade única
              if (!quadraId && modalidadeRaw) {
                try {
                  const { data: qMods, error: qModsErr } = await sb
                    .from("quadras")
                    .select("id, nome, modalidades")
                    .eq("codigo_empresa", empresaCodigo);
                  if (!qModsErr && Array.isArray(qMods) && qMods.length > 0) {
                    const normalize = (s: string) => s
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .toLowerCase()
                      .trim();
                    const target = normalize(modalidadeRaw);
                    const matches = qMods.filter((row: any) => {
                      const raw = (row as any).modalidades;
                      let mods: string[] = [];
                      if (Array.isArray(raw)) mods = raw.map((m: any) => String(m || "")).filter(Boolean);
                      else if (typeof raw === "string" && raw.trim()) mods = raw.split(",").map((m: string) => m.trim()).filter(Boolean);
                      return mods.some(m => normalize(m) === target);
                    });
                    if (matches.length === 1) {
                      quadraId = String(matches[0].id);
                      const rawMods = (matches[0] as any).modalidades;
                      if (Array.isArray(rawMods)) {
                        quadraModalidades = rawMods.map((m: any) => String(m || "").trim()).filter(Boolean);
                      } else if (typeof rawMods === "string" && rawMods.trim()) {
                        quadraModalidades = rawMods.split(",").map((m: string) => m.trim()).filter(Boolean);
                      }
                    }
                  }
                } catch {}
              }

              // 1) Inferir quadra ANTES de pedir escolha, usando menção explícita recente (ex.: "Quadra 01")
              if (!quadraId) {
                try {
                  const normalize = (s: string) => s
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .trim();
                  const recentCtx = [
                    ...history.slice(-6).map((m: any) => String(m?.content || "")),
                    String(message || ""),
                  ].join(" \n ");
                  const recentNorm = normalize(recentCtx);

                  const { data: allQs, error: allErr } = await sb
                    .from("quadras")
                    .select("id, nome, modalidades")
                    .eq("codigo_empresa", empresaCodigo)
                    .order("nome", { ascending: true });
                  if (!allErr && Array.isArray(allQs) && allQs.length > 0) {
                    const hits = allQs.filter((q: any) => recentNorm.includes(normalize(String(q?.nome || ""))));
                    if (hits.length === 1) {
                      quadraId = String(hits[0].id);
                      const rawMods = (hits[0] as any).modalidades;
                      if (Array.isArray(rawMods)) {
                        quadraModalidades = rawMods.map((m: any) => String(m || "").trim()).filter(Boolean);
                      } else if (typeof rawMods === "string" && rawMods.trim()) {
                        quadraModalidades = rawMods.split(",").map((m: string) => m.trim()).filter(Boolean);
                      }
                    }
                  }
                } catch {}
              }

              // Se nenhuma quadra for informada, tentar assumir quadra única da empresa
              if (!quadraId) {
                try {
                  // 1) Tenta encontrar exatamente 1 quadra ATIVA
                  const { data: quadrasAtivas, error: quadErr } = await sb
                    .from("quadras")
                    .select("id, modalidades")
                    .eq("codigo_empresa", empresaCodigo)
                    .eq("status", "Ativa");

                  let quadrasCandidatas: any[] | null = null;
                  if (!quadErr && Array.isArray(quadrasAtivas) && quadrasAtivas.length === 1) {
                    quadrasCandidatas = quadrasAtivas;
                  } else {
                    // 2) Se não houver exatamente 1 ativa, tenta todas as quadras da empresa;
                    //    se houver exatamente 1 no total, assume essa quadra como padrão.
                    const { data: quadrasTodas, error: quadAllErr } = await sb
                      .from("quadras")
                      .select("id, modalidades")
                      .eq("codigo_empresa", empresaCodigo);
                    if (!quadAllErr && Array.isArray(quadrasTodas) && quadrasTodas.length === 1) {
                      quadrasCandidatas = quadrasTodas;
                    }
                  }

                  if (quadrasCandidatas && quadrasCandidatas.length === 1) {
                    const unica = quadrasCandidatas[0] as any;
                    quadraId = String(unica.id);
                    const rawMods = (unica as any).modalidades;
                    if (Array.isArray(rawMods)) {
                      quadraModalidades = rawMods.map((m: any) => String(m || "").trim()).filter(Boolean);
                    } else if (typeof rawMods === "string" && rawMods.trim()) {
                      quadraModalidades = rawMods
                        .split(",")
                        .map((m: string) => m.trim())
                        .filter(Boolean);
                    }
                  }
                } catch (e: any) {
                  console.log("[chat-proxy] erro ao buscar quadra única em create_agendamento", {
                    message: e?.message,
                  });
                }
              }

              // Se ainda não resolvemos a quadra e a empresa possui múltiplas quadras, pedir escolha explícita
              if (!quadraId) {
                try {
                  const { data: quadrasTodas, error: qAllErr } = await sb
                    .from("quadras")
                    .select("id, nome")
                    .eq("codigo_empresa", empresaCodigo)
                    .order("nome", { ascending: true });
                  if (!qAllErr && Array.isArray(quadrasTodas) && quadrasTodas.length > 1) {
                    result = {
                      ok: false,
                      policy: "write-rejected",
                      domain: "agenda",
                      error: "Preciso que você escolha a quadra para este agendamento.",
                      quadras_candidatas: quadrasTodas.map((q: any) => ({ id: String(q.id), nome: String(q.nome || "") })).slice(0, 10),
                    };
                  }
                } catch {}
              }

              // Se ainda não houver quadra mas já temos modalidade, tentar resolver pela modalidade única
              if (!quadraId && modalidadeRaw) {
                try {
                  const { data: qMods, error: qModsErr } = await sb
                    .from("quadras")
                    .select("id, nome, modalidades")
                    .eq("codigo_empresa", empresaCodigo);
                  if (!qModsErr && Array.isArray(qMods) && qMods.length > 0) {
                    const normalize = (s: string) => s
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .toLowerCase()
                      .trim();
                    const target = normalize(modalidadeRaw);
                    const matches = qMods.filter((row: any) => {
                      const raw = (row as any).modalidades;
                      let mods: string[] = [];
                      if (Array.isArray(raw)) mods = raw.map((m: any) => String(m || "")).filter(Boolean);
                      else if (typeof raw === "string" && raw.trim()) mods = raw.split(",").map((m: string) => m.trim()).filter(Boolean);
                      return mods.some(m => normalize(m) === target);
                    });
                    if (matches.length === 1) {
                      quadraId = String(matches[0].id);
                      const rawMods = (matches[0] as any).modalidades;
                      if (Array.isArray(rawMods)) {
                        quadraModalidades = rawMods.map((m: any) => String(m || "").trim()).filter(Boolean);
                      } else if (typeof rawMods === "string" && rawMods.trim()) {
                        quadraModalidades = rawMods.split(",").map((m: string) => m.trim()).filter(Boolean);
                      }
                    }
                  }
                } catch {}
              }

              // Se houver quadra definida, validar modalidade contra modalidades da quadra (quando configuradas)
              if (quadraId && (!quadraModalidades || quadraModalidades.length === 0)) {
                try {
                  const { data: qRow, error: qErr } = await sb
                    .from("quadras")
                    .select("id, modalidades")
                    .eq("codigo_empresa", empresaCodigo)
                    .eq("id", quadraId)
                    .maybeSingle();
                  if (!qErr && qRow) {
                    const rawMods = (qRow as any).modalidades;
                    if (Array.isArray(rawMods)) {
                      quadraModalidades = rawMods.map((m: any) => String(m || "").trim()).filter(Boolean);
                    } else if (typeof rawMods === "string" && rawMods.trim()) {
                      quadraModalidades = rawMods
                        .split(",")
                        .map((m: string) => m.trim())
                        .filter(Boolean);
                    }
                  }
                } catch (e: any) {
                  console.log("[chat-proxy] erro ao carregar modalidades da quadra em create_agendamento", {
                    message: e?.message,
                  });
                }
              }

              if (quadraId && quadraModalidades && quadraModalidades.length > 0) {
                const normalize = (s: string) => s
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .toLowerCase()
                  .trim();

                // Se a quadra tiver exatamente uma modalidade cadastrada, usamos SEMPRE essa modalidade,
                // independentemente do texto que veio da LLM, para evitar erros em arenas de modalidade única.
                if (quadraModalidades.length === 1) {
                  modalidadeRaw = quadraModalidades[0];
                } else {
                  const modsNorm = quadraModalidades.map(m => ({
                    original: m,
                    norm: normalize(m),
                  }));

                  const requestedNorm = modalidadeRaw ? normalize(modalidadeRaw) : "";

                  // Se não veio modalidade ou não bate com nenhuma cadastrada, rejeita e devolve opções.
                  const match = requestedNorm
                    ? modsNorm.find(m => m.norm === requestedNorm)
                    : null;

                  if (!requestedNorm || !match) {
                    result = {
                      ok: false,
                      policy: "write-rejected",
                      domain: "agenda",
                      quadra_id: quadraId,
                      requested_modalidade: modalidadeRaw || null,
                      modalidades_disponiveis: quadraModalidades,
                      error: "A modalidade informada não é válida para esta quadra. Escolha uma das modalidades disponíveis.",
                    };
                  } else {
                    // Garante que vamos gravar usando exatamente o texto da modalidade cadastrada
                    modalidadeRaw = match.original;
                  }
                }
              }

              // Antes de criar, checa conflito de horário na mesma quadra e dia
              if (quadraId) {
                try {
                  // Janela do dia todo em horário local, convertida para UTC
                  const dayStartIso = toUtcIsoFromLocal(year, month, day, 0, 0);
                  const nextDayLocal = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
                  nextDayLocal.setUTCDate(nextDayLocal.getUTCDate() + 1);
                  const nextDayYear = nextDayLocal.getUTCFullYear();
                  const nextDayMonth = nextDayLocal.getUTCMonth() + 1;
                  const nextDayDay = nextDayLocal.getUTCDate();
                  const nextDayIso = toUtcIsoFromLocal(nextDayYear, nextDayMonth, nextDayDay, 0, 0);

                  const { data: existingRows, error: existingErr } = await sb
                    .from("agendamentos")
                    .select("inicio, fim")
                    .eq("codigo_empresa", empresaCodigo)
                    .eq("quadra_id", quadraId)
                    .gte("inicio", dayStartIso)
                    .lt("inicio", nextDayIso)
                    .order("inicio", { ascending: true });

                  if (!existingErr && Array.isArray(existingRows) && existingRows.length > 0) {
                    const normalizeIso = (iso: string) => (iso.includes("T") ? iso : iso.replace(" ", "T"));

                    const toLocalMinutes = (iso: string) => {
                      const dUtc = new Date(normalizeIso(iso));
                      const localMs = dUtc.getTime() + offsetMinutes * 60000;
                      const local = new Date(localMs);
                      return local.getUTCHours() * 60 + local.getUTCMinutes();
                    };

                    const requestedStartMin = h1 * 60 + m1;
                    const requestedEndMin = (h2 === 0 && m2 === 0) ? 24 * 60 : (h2 * 60 + m2);

                    const bookingsLocal = existingRows.map((row: any) => {
                      const startMin = toLocalMinutes(String(row.inicio || ""));
                      const endMin = toLocalMinutes(String(row.fim || ""));
                      return {
                        startMin,
                        endMin: endMin <= startMin ? startMin : endMin,
                      };
                    }).filter(b => !isNaN(b.startMin) && !isNaN(b.endMin));

                    bookingsLocal.sort((a, b) => a.startMin - b.startMin);

                    const hasConflict = bookingsLocal.some(b => {
                      const existingStart = b.startMin;
                      const existingEnd = b.endMin;
                      return !(existingEnd <= requestedStartMin || existingStart >= requestedEndMin);
                    });

                    if (hasConflict) {
                      // Calcula intervalos livres no dia (0:00–24:00) para sugerir ao usuário
                      const DAY_MINUTES = 24 * 60;
                      const freeIntervals: Array<{ startMin: number; endMin: number }> = [];
                      let lastEnd = 0;

                      for (const b of bookingsLocal) {
                        const s = Math.max(0, b.startMin);
                        const e = Math.min(DAY_MINUTES, b.endMin);
                        if (s > lastEnd) {
                          freeIntervals.push({ startMin: lastEnd, endMin: s });
                        }
                        if (e > lastEnd) lastEnd = e;
                      }

                      if (lastEnd < DAY_MINUTES) {
                        freeIntervals.push({ startMin: lastEnd, endMin: DAY_MINUTES });
                      }

                      const pad = (n: number) => String(n).padStart(2, "0");
                      const toHHMM = (mins: number) => {
                        const h = Math.floor(mins / 60);
                        const m = mins % 60;
                        return `${pad(h)}:${pad(m)}`;
                      };

                      const availableIntervals = freeIntervals
                        .filter(it => it.endMin - it.startMin >= 30) // só intervalos de pelo menos 30 minutos
                        .map(it => ({
                          hora_inicio: toHHMM(it.startMin),
                          hora_fim: toHHMM(it.endMin),
                        }));

                      result = {
                        ok: false,
                        policy: "write-rejected",
                        domain: "agenda",
                        conflict: true,
                        requested_interval: {
                          hora_inicio: horaInicioRaw,
                          hora_fim: horaFimRaw,
                        },
                        available_intervals: availableIntervals,
                        error: "Já existe agendamento nesse horário para esta quadra. Escolha outro intervalo disponível.",
                      };
                    }
                  }
                } catch (conflictErr: any) {
                  // Em caso de erro na checagem de conflito, não bloqueia a criação: apenas loga e segue
                  console.log("[chat-proxy] erro ao checar conflitos em create_agendamento", {
                    message: conflictErr?.message,
                  });
                }
              }

              if (!result || result.ok !== false) {
                const insertPayload: Record<string, any> = {
                  codigo_empresa: empresaCodigo,
                  inicio: inicioIso,
                  fim: fimIso,
                  status,
                  modalidade: modalidadeRaw || null,
                  clientes: [clienteNomeRaw],
                };
                if (quadraId) insertPayload.quadra_id = quadraId;
                if (clienteId) insertPayload.cliente_id = clienteId;

                const { data: created, error: createError } = await sb
                  .from("agendamentos")
                  .insert(insertPayload)
                  .select("id, codigo, inicio, fim, status, modalidade, quadra_id")
                  .maybeSingle();

                if (createError || !created) {
                  result = {
                    ok: false,
                    policy: "write-error",
                    domain: "agenda",
                    error: `Erro ao criar agendamento: ${createError?.message || "desconhecido"}`,
                  };
                } else {
                  // Após criar o agendamento, tentamos inserir um participante padrão,
                  // alinhado com o comportamento da AgendaPage.
                  try {
                    let participanteClienteId: string | null = clienteId;

                    // Se não houver cliente resolvido, tenta usar o cliente consumidor padrão (is_consumidor_final=true)
                    if (!participanteClienteId) {
                      try {
                        const { data: consumidor, error: consErr } = await sb
                          .from("clientes")
                          .select("id, is_consumidor_final")
                          .eq("codigo_empresa", empresaCodigo)
                          .eq("is_consumidor_final", true)
                          .maybeSingle();
                        if (!consErr && consumidor && consumidor.id) {
                          participanteClienteId = String(consumidor.id);
                        }
                      } catch (consErr: any) {
                        console.log("[chat-proxy] erro ao localizar cliente consumidor padrão em create_agendamento", {
                          message: consErr?.message,
                        });
                      }
                    }

                    if (participanteClienteId) {
                      const participanteNome = clienteNomeRaw;
                      const participanteRow: Record<string, any> = {
                        codigo_empresa: empresaCodigo,
                        agendamento_id: created.id,
                        cliente_id: participanteClienteId,
                        nome: participanteNome,
                        valor_cota: 0,
                        status_pagamento: "Pendente",
                        ordem: 1,
                      };

                      const { error: partError } = await sb
                        .from("agendamento_participantes")
                        .insert(participanteRow);

                      if (partError) {
                        console.log("[chat-proxy] erro ao criar participante padrão em create_agendamento", {
                          message: partError.message,
                        });
                      }
                    }
                  } catch (partErr: any) {
                    console.log("[chat-proxy] erro inesperado ao inserir participante em create_agendamento", {
                      message: partErr?.message,
                    });
                  }

                  result = {
                    ok: true,
                    policy: "write-allowed (agendamentos:create)",
                    domain: "agenda",
                    created_id: created.id,
                    created_snapshot: created,
                  };
                }
              }
              }
            }
            lastCreateAgendamentoResult = result;
          } else if (name === "update_agendamento") {
            // WRITE: atualizar agendamento com segurança (RLS via JWT + filtro de empresa)
            const agendamentoId = String(args?.agendamento_id || "").trim();

            // Alguns modelos podem enviar campos permitidos (inicio, fim, status, modalidade)
            // diretamente na raiz de args, sem aninhá-los em "campos". Aqui normalizamos isso.
            let campos: Record<string, any> = args?.campos && typeof args.campos === "object" ? args.campos : {};
            if (!campos || typeof campos !== "object") {
              campos = {};
            }

            const rootFieldCandidates = ["inicio", "fim", "status", "modalidade"] as const;
            for (const field of rootFieldCandidates) {
              if (Object.prototype.hasOwnProperty.call(args || {}, field) && campos[field] === undefined) {
                campos[field] = (args as any)[field];
              }
            }

            if (!agendamentoId) {
              result = {
                ok: false,
                policy: "write-rejected",
                domain: "agenda",
                error: "agendamento_id obrigatório para update_agendamento",
              };
            } else {
              // Permitir apenas campos específicos para evitar updates indevidos
              const allowedFields = ["inicio", "fim", "status", "modalidade"];
              const updatePayload: Record<string, any> = {};
              for (const [key, value] of Object.entries(campos)) {
                if (allowedFields.includes(key)) {
                  updatePayload[key] = value;
                }
              }

              const appliedFields = Object.keys(updatePayload);

              if (appliedFields.length === 0) {
                result = {
                  ok: false,
                  policy: "write-rejected",
                  domain: "agenda",
                  updated_id: agendamentoId,
                  applied_fields: [],
                  error: "Nenhum campo permitido foi informado em 'campos' para update_agendamento.",
                };
              } else {
                const { data: updatedRows, error: updateError } = await sb
                  .from("agendamentos")
                  .update(updatePayload)
                  .eq("id", agendamentoId)
                  .eq("codigo_empresa", empresaCodigo)
                  .select("id, inicio, fim, status")
                  .maybeSingle();

                if (updateError) {
                  result = {
                    ok: false,
                    policy: "write-error",
                    domain: "agenda",
                    updated_id: agendamentoId,
                    applied_fields: appliedFields,
                    error: `Erro ao atualizar agendamento: ${updateError.message}`,
                  };
                } else if (!updatedRows) {
                  result = {
                    ok: false,
                    policy: "write-no-op",
                    domain: "agenda",
                    updated_id: agendamentoId,
                    applied_fields: [],
                    error: "Nenhum agendamento encontrado para atualizar (verifique empresa e ID).",
                  };
                } else {
                  result = {
                    ok: true,
                    policy: "write-allowed (agendamentos)",
                    domain: "agenda",
                    updated_id: agendamentoId,
                    applied_fields: appliedFields,
                    updated_snapshot: updatedRows,
                  };
                }
              }
              lastUpdateAgendamentoResult = result;
            }
          } else if (name === "get_clientes") {
            // READ: lista clientes cadastrados (tabela clientes), apenas ativos e com flag_cliente=true
            const searchTermRaw = String(args?.search_term || "").trim();
            const limit = Math.min(Math.max(Number(args?.limit || 20), 1), 50);

            let query = sb
              .from("clientes")
              .select("id, codigo, nome, email, telefone, status, flag_cliente, codigo_empresa", { count: "exact" })
              .eq("status", "active")
              .eq("flag_cliente", true)
              .eq("codigo_empresa", empresaCodigo)
              .order("nome", { ascending: true })
              .limit(limit);

            const s = searchTermRaw;
            if (s) {
              const isNumeric = /^\d+$/.test(s);
              if (isNumeric) {
                query = query.or(
                  `codigo.eq.${s},nome.ilike.%${s}%,email.ilike.%${s}%,telefone.ilike.%${s}%`,
                );
              } else {
                // Para nomes, permite variações simples como "ithalo" vs "italo" (remoção de 'h')
                const sNoH = s.replace(/h/gi, "");
                const orParts: string[] = [];
                orParts.push(
                  `nome.ilike.%${s}%`,
                  `email.ilike.%${s}%`,
                  `telefone.ilike.%${s}%`,
                );
                if (sNoH && sNoH !== s) {
                  orParts.push(
                    `nome.ilike.%${sNoH}%`,
                    `email.ilike.%${sNoH}%`,
                    `telefone.ilike.%${sNoH}%`,
                  );
                }
                query = query.or(orParts.join(","));
              }
            }

            const { data, error, count } = await query;
            if (error) throw error;

            const items = (data || []).map((row: any) => ({
              id: row.id,
              codigo: row.codigo,
              nome: row.nome,
              email: row.email,
              telefone: row.telefone,
              status: row.status,
            }));

            result = {
              ok: true,
              policy: "read-only",
              domain: "clientes",
              filters: { search_term: searchTermRaw || null, limit },
              total: items.length,
              rows_total: count ?? items.length,
              items,
            };
            lastGetClientesResult = result;
          } else if (name === "get_quadras") {
            // READ: lista quadras da empresa atual (tabela quadras)
            const apenasAtivas = Boolean(args?.apenas_ativas);
            const limit = Math.min(Math.max(Number(args?.limit || 20), 1), 50);

            let query = sb
              .from("quadras")
              .select("id, nome, status, modalidades, codigo_empresa", { count: "exact" })
              .eq("codigo_empresa", empresaCodigo)
              .order("nome", { ascending: true })
              .limit(limit);

            if (apenasAtivas) {
              query = query.eq("status", "Ativa");
            }

            const { data, error, count } = await query;
            if (error) throw error;

            const items = (data || []).map((row: any) => {
              const rawMods = (row as any).modalidades;
              let modalidades: string[] = [];
              if (Array.isArray(rawMods)) {
                modalidades = rawMods.map((m: any) => String(m || "").trim()).filter(Boolean);
              } else if (typeof rawMods === "string" && rawMods.trim()) {
                modalidades = rawMods
                  .split(",")
                  .map((m: string) => m.trim())
                  .filter(Boolean);
              }

              return {
                id: row.id,
                nome: row.nome,
                status: row.status,
                modalidades,
              };
            });

            result = {
              ok: true,
              policy: "read-only",
              domain: "quadras",
              filters: { apenas_ativas: apenasAtivas, limit },
              total: items.length,
              rows_total: count ?? items.length,
              items,
            };
          } else {
            result = { ok: false, error: `Tool não suportada: ${name}` };
          }
          // Log de execução de tool (resumo enriquecido para debug)
          const summary = {
            ok: result?.ok,
            policy: result?.policy,
            domain: result?.domain,
            total: result?.total,
            updated_id: result?.updated_id,
            applied_fields: result?.applied_fields,
            error: result?.error,
            conflict: result?.conflict,
            quadra_id: result?.quadra_id,
            requested_modalidade: result?.requested_modalidade,
            modalidades_disponiveis: result?.modalidades_disponiveis,
            created_id: result?.created_id,
          };
          console.log(`[chat-proxy][${reqId}] tool_success`, { tool: name, args, summary });
          debugTools.push({ name, args, summary });
        } catch (e) {
          result = { ok: false, error: `Falha ao interpretar argumentos: ${String(e)}` };
          const errStr = String(e);
          console.log(`[chat-proxy][${reqId}] tool_error`, { tool: name, raw_args: argsRaw, error: errStr });
          debugTools.push({ name, error: errStr });
        }
        messages.push({ role: "tool", name, tool_call_id: tc.id, content: JSON.stringify(result) });
      }

      // Se houve uma tentativa de update_agendamento que falhou (ok != true), não deixamos a IA
      // "inventar" que aplicou a alteração. Em vez disso, respondemos de forma determinística
      // informando que nada foi alterado e qual o motivo, marcando a estratégia como "reserve".
      if (lastUpdateAgendamentoResult && !lastUpdateAgendamentoResult.ok) {
        const r = lastUpdateAgendamentoResult as any;
        const campos = Array.isArray(r.applied_fields) ? r.applied_fields : [];
        const camposResumo = campos.length > 0 ? campos.join(", ") : "nenhum campo foi aplicado";
        const errMsg = String(r.error || "Não consegui concluir a alteração do agendamento.");

        const md = `Não consegui aplicar a alteração deste agendamento agora.\n\n- **ID:** ${r.updated_id || "(desconhecido)"}\n- **Campos aplicados:** ${camposResumo}\n- **Motivo:** ${errMsg}\n\nNenhuma alteração foi gravada no sistema. Você pode tentar novamente informando claramente o novo horário, status ou modalidade que deseja.`;

        const duration = Date.now() - startedAt;
        console.log(`[chat-proxy][${reqId}] response`, {
          source: "tools-direct",
          duration_ms: duration,
          reply_preview: md.slice(0, 200),
        });
        return new Response(JSON.stringify({ reply: md, source: "tools-direct", debug: { tools: debugTools, strategy: "reserve" } }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "tools-direct", "x-isis-duration-ms": String(duration) },
        });
      }

      // Determinístico: se get_clientes trouxe múltiplos candidatos em um fluxo de criação,
      // liste SEMPRE com Código e Nome, peça escolha por número ou por código.
      if (lastGetClientesResult && lastGetClientesResult.ok && Array.isArray(lastGetClientesResult.items) && lastGetClientesResult.items.length > 1) {
          const items = lastGetClientesResult.items as Array<{ codigo?: string | number; nome?: string; telefone?: string }>;
          let md = "Encontrei alguns clientes compatíveis. Escolha pelo **número** ou pelo **código**:\n\n";
          items.forEach((it, idx) => {
            const codigo = (it.codigo ?? "").toString();
            const nome = it.nome || "(sem nome)";
            const tel = it.telefone ? `  \n   **Telefone:** ${it.telefone}` : "";
            md += `${idx + 1}. **Código:** ${codigo}  \n   **Nome:** ${nome}${tel}\n\n`;
          });
          md += "Me diga o **número** (ex.: 1) ou o **código** do cliente que deseja usar.";

          const duration = Date.now() - startedAt;
          console.log(`[chat-proxy][${reqId}] response`, {
            source: "tools-direct",
            duration_ms: duration,
            reply_preview: md.slice(0, 200),
          });
          return new Response(JSON.stringify({ reply: md, source: "tools-direct", debug: { tools: debugTools, strategy: "reserve" } }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "tools-direct", "x-isis-duration-ms": String(duration) },
          });
      }

      // Determinístico: se create_agendamento foi rejeitado por falta de escolha de quadra,
      // devolvemos lista numerada de quadras por NOME, pedindo escolha por número ou nome exato.
      if (lastCreateAgendamentoResult && lastCreateAgendamentoResult.ok === false) {
        const r = lastCreateAgendamentoResult as any;
        const errMsg = String(r.error || "");
        const quadrasCand = Array.isArray(r.quadras_candidatas) ? r.quadras_candidatas : [];
        if (quadrasCand.length > 0 || /escolha a quadra/i.test(errMsg)) {
          let md = "Preciso que você escolha a quadra para este agendamento.\n\n";
          // Tenta inferir preferência anterior do usuário (por nome ou índice)
          const normalize = (s: string) => s
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
          const recentCtx = [
            ...history.slice(-4).map((m: any) => String(m?.content || "")),
            String(message || ""),
          ].join(" \n ");
          const recentNorm = normalize(recentCtx);

          // Busca último args usados em create_agendamento para capturar um possível índice/texto enviado pela LLM
          let hintedIndex: number | null = null;
          try {
            const lastTool = [...debugTools].reverse().find(t => t?.name === "create_agendamento" && t?.summary);
            const lastArgsRaw = (lastTool as any)?.args || {};
            const rawQuadraId = String(lastArgsRaw?.quadra_id || "").trim();
            if (/^\d+$/.test(rawQuadraId)) {
              hintedIndex = Math.max(1, parseInt(rawQuadraId, 10));
            }
          } catch {}

          const list = quadrasCand as Array<{ id?: string; nome?: string; modalidades?: string[] | string }>;
          if (list.length > 0) {
            list.forEach((q, idx) => {
              const nome = String(q?.nome || "Quadra");
              md += `${idx + 1}. **${nome}**\n`;
            });

            // Tenta mapear preferência textual (ex.: "quadra 01") ao índice
            let preferredIdx: number | null = null;
            list.forEach((q, idx) => {
              const nome = String(q?.nome || "");
              if (nome && recentNorm.includes(normalize(nome))) preferredIdx = preferredIdx ?? idx;
            });
            if (preferredIdx === null && hintedIndex && hintedIndex >= 1 && hintedIndex <= list.length) {
              preferredIdx = hintedIndex - 1;
            }

            if (preferredIdx !== null) {
              const nomePref = String(list[preferredIdx]?.nome || "Quadra");
              md += `\nPelo que entendi, você já indicou **${nomePref}**. Se estiver correto, responda **${preferredIdx + 1}** ou o **nome exato** para eu criar agora.`;
            }

            md += `\nMe diga **o número** da quadra (ex.: 1) ou **o nome exato** (ex.: "Quadra 01").`;
          } else {
            // Se não veio a lista, consultamos as quadras para montar a listagem.
            try {
              const { data: quadrasTodas } = await sb
                .from("quadras")
                .select("nome, modalidades")
                .eq("codigo_empresa", empresaCodigo)
                .order("nome", { ascending: true });
              if (Array.isArray(quadrasTodas) && quadrasTodas.length > 0) {
                quadrasTodas.forEach((q: any, idx: number) => {
                  const nome = String(q?.nome || "Quadra");
                  const rawMods = q?.modalidades;
                  let mods: string[] = [];
                  if (Array.isArray(rawMods)) mods = rawMods.map((m: any) => String(m || "").trim()).filter(Boolean);
                  else if (typeof rawMods === "string" && rawMods.trim()) mods = rawMods.split(",").map((m: string) => m.trim()).filter(Boolean);
                  const modStr = mods.length > 0 ? ` – **${mods.join(", ")}**` : "";
                  md += `${idx + 1}. **${nome}**${modStr}\n`;
                });
                md += `\nMe diga **o número** da quadra (ex.: 1) ou **o nome exato** (ex.: "Quadra 01").`;
              }
            } catch {}
          }

          const duration = Date.now() - startedAt;
          console.log(`[chat-proxy][${reqId}] response`, {
            source: "tools-direct",
            duration_ms: duration,
            reply_preview: md.slice(0, 200),
          });
          return new Response(JSON.stringify({ reply: md, source: "tools-direct", debug: { tools: debugTools, strategy: "reserve" } }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "tools-direct", "x-isis-duration-ms": String(duration) },
          });
        }
      }

      // Neste ponto, as tools já foram executadas e seus resultados foram anexados em messages
      // como mensagens de role "tool". A partir daqui, sempre deixamos o modelo da OpenAI
      // gerar a resposta final com base nesses resultados (secondResp). Em caso de erro na
      // segunda chamada, caímos nos fallbacks genéricos definidos mais abaixo.
      // Caso contrário, ainda fazemos a segunda chamada para o modelo usar o resultado das tools
      const secondResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          temperature: 0.4,
          messages,
        }),
      });

      if (!secondResp.ok) {
        const duration = Date.now() - startedAt;
        console.log(`[chat-proxy][${reqId}] openai_error(second) status=${secondResp.status} duration_ms=${duration}`);
        return new Response(JSON.stringify({ reply: "Não consegui concluir a operação agora.", source: "fallback", debug: { strategy: "reserve" } }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "fallback", "x-isis-duration-ms": String(duration) },
        });
      }

      const secondData = await secondResp.json();
      let finalReply = secondData?.choices?.[0]?.message?.content ?? "";

      // Quando houver tool calls, podemos ter duas fases de resposta:
      // 1) Uma resposta preliminar da assistente antes das tools (choice.message.content)
      // 2) A resposta final após usar as tools (finalReply).
      // Exponhamos isso para o frontend como um array de replies, mantendo 'reply' como o texto final.
      let preliminaryReply = "";
      try {
        if (choice && typeof choice?.message?.content === "string") {
          preliminaryReply = choice.message.content.trim();
        }
      } catch {}

      // Sanitização: nunca expor UUIDs/IDs internos e remover frases de espera/filler nas mensagens ao usuário
      const hideIds = (s: string) => {
        try {
          if (!s) return s;
          // UUID v4-like
          s = s.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g, "[código interno]");
          // Sequências hex longas que parecem IDs
          s = s.replace(/\b[0-9a-fA-F]{16,}\b/g, "[código interno]");
          // Padrões 'ID:' seguidos de UUID/hex
          s = s.replace(/(ID\s*:\s*)([\w-]{10,})/gi, "$1[código interno]");
        } catch {}
        return s;
      };

      const removeFiller = (s: string) => {
        try {
          if (!s) return s;
          // remove linhas com promessas de busca/espera
          const lines = s.split(/\r?\n/);
          const bad = /(vou\s+(buscar|consultar|verificar)|um\s+instante|já\s+volto|aguarde)/i;
          const emojiNoise = /[🔍⏳⌛️🕐🕑🕒]/g;
          const kept = lines.filter(l => !bad.test(l));
          let out = kept.join("\n");
          out = out.replace(emojiNoise, "");
          // normaliza múltiplas quebras
          out = out.replace(/\n{3,}/g, "\n\n").trim();
          return out.length > 0 ? out : s;
        } catch { return s; }
      };

      finalReply = removeFiller(hideIds(finalReply));

      const replies: string[] = [];
      // Não incluímos a resposta preliminar da OpenAI (antes das tools) para evitar 'buscas' e 'aguarde'.
      if (typeof finalReply === "string" && finalReply.trim().length > 0) {
        replies.push(finalReply);
      }

      // Guard-rail adicional: se o usuário demonstrou intenção de alteração (userWantsChange=true),
      // mas neste turno só tivemos tools de leitura (get_agendamentos / get_clientes) e NENHUMA
      // escrita bem-sucedida (update_agendamento/create_agendamento), não deixamos a OpenAI
      // prometer que já vai cancelar/alterar agora. Em vez disso, usamos lastGetAgendamentosResult
      // (quando existir) para listar os agendamentos e pedir confirmação explícita, deixando claro
      // que nada foi alterado ainda.
      const hasWriteAllowed = debugTools.some((t) => typeof t?.summary?.policy === "string" && t.summary.policy.startsWith("write-allowed"));
      const onlyReadTools = debugTools.length > 0 && !hasWriteAllowed;

      if (userWantsChange && onlyReadTools && (!lastUpdateAgendamentoResult || !lastUpdateAgendamentoResult.ok)) {
        const durationGuard = Date.now() - startedAt;

        if (lastGetAgendamentosResult && lastGetAgendamentosResult.ok && Array.isArray(lastGetAgendamentosResult.items) && lastGetAgendamentosResult.items.length > 0) {
          const items = lastGetAgendamentosResult.items as any[];
          let md = "";

          if (items.length === 1) {
            const it = items[0] as any;
            const cliente = it.representante_nome || "Cliente Consumidor";
            const quadra = it.quadra_nome || "Quadra";
            const dataLegivel = it.data_legivel || todayStr;
            const horarioLegivel = it.horario_legivel || "(horário não informado)";

            md += `Encontrei um agendamento que bate com o que você pediu:\n\n`;
            md += `- **Cliente:** ${cliente}\n`;
            md += `- **Quadra:** ${quadra}\n`;
            md += `- **Data:** ${dataLegivel}\n`;
            md += `- **Horário:** ${horarioLegivel}\n\n`;
            md += `Ainda **não cancelei nem alterei nada**. Se for esse o agendamento que você quer cancelar ou mudar, me confirme por favor (por exemplo: \\\"sim, pode cancelar\\\" ou \\\"sim, mude o horário\\\").`;
          } else {
            md += `Encontrei alguns agendamentos relacionados ao que você pediu:\n\n`;
            items.forEach((it: any, idx: number) => {
              const cliente = it.representante_nome || "Cliente Consumidor";
              const quadra = it.quadra_nome || "Quadra";
              const dataLegivel = it.data_legivel || todayStr;
              const horarioLegivel = it.horario_legivel || "(horário não informado)";

              md += `${idx + 1}. ${it.modalidade || "Agendamento"} – ${quadra}\n`;
              md += `   - **Cliente:** ${cliente}\n`;
              md += `   - **Data:** ${dataLegivel}\n`;
              md += `   - **Horário:** ${horarioLegivel}\n\n`;
            });
            md += `Ainda **não cancelei nem alterei nenhum agendamento**. Me diga **o número ou o cliente/horário** do agendamento que você quer cancelar ou mudar, que eu preparo a alteração e peço sua confirmação final antes de aplicar.`;
          }

          console.log(`[chat-proxy][${reqId}] response`, {
            source: "tools-direct",
            duration_ms: durationGuard,
            reply_preview: md.slice(0, 200),
          });
          return new Response(JSON.stringify({ reply: md, source: "tools-direct", debug: { tools: debugTools, strategy: "reserve" } }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "tools-direct", "x-isis-duration-ms": String(durationGuard) },
          });
        }
      }

      const duration = Date.now() - startedAt;
      console.log(`[chat-proxy][${reqId}] response`, {
        source: "openai+tools",
        duration_ms: duration,
        reply_preview: finalReply.slice(0, 200),
      });
      return new Response(JSON.stringify({ reply: finalReply, replies, source: "openai+tools", debug: { tools: debugTools, strategy: "primary" } }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "openai+tools", "x-isis-duration-ms": String(duration) },
      });
    }

    // Sem tool calls: responder direto, mas com aprimoramento para criação de agendamento.
    // Se a intenção for criar agendamento, garantimos que a PRIMEIRA resposta já traga quadras/modalidades.
    const rawReply = choice?.message?.content ?? "";
    const wantsCreate = /\b(criar|crie|crio|fazer|faca|fa[cç]a|novo|agendar|agendamento)\b/i.test(message) || /crie um agendamento/i.test(message);
    let reply = rawReply;
    if (wantsCreate) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
        const authHeader = req.headers.get("Authorization") || "";
        const sbDirect = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });

        const { data: quadrasRows, error: quadErr } = await sbDirect
          .from("quadras")
          .select("id, nome, status, modalidades")
          .eq("codigo_empresa", empresaCodigo)
          .order("nome", { ascending: true })
          .limit(20);

        if (!quadErr && Array.isArray(quadrasRows) && quadrasRows.length > 0) {
          const parseMods = (raw: any): string[] => {
            if (Array.isArray(raw)) return raw.map((m: any) => String(m || "").trim()).filter(Boolean);
            if (typeof raw === "string" && raw.trim()) return raw.split(",").map((m: string) => m.trim()).filter(Boolean);
            return [];
          };

          const quadras = quadrasRows.map((q: any) => ({
            id: String(q.id),
            nome: String(q.nome || "Quadra"),
            status: String(q.status || ""),
            modalidades: parseMods((q as any).modalidades),
          }));

          // Tentar criação direta se a mensagem já trouxer cliente, data e horários e o ambiente permitir decisão automática
          const text = String(message || "");
          const canon = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
          const today = new Date();
          const pad2 = (n: number) => String(n).padStart(2, "0");

          // Extrair horário: "das 15h às 17h" ou "15:00 às 17:00"
          const intervalMatchH = text.match(/(?:das\s*)?(\d{1,2})h(\d{2})?\s*(?:a|às|ate|até)\s*(\d{1,2})h(\d{2})?/i);
          const intervalMatchC = intervalMatchH || text.match(/(?:das\s*)?(\d{1,2}):(\d{2})\s*(?:a|às|ate|até)\s*(\d{1,2}):(\d{2})/i);

          // Extrair data: hoje | dd/mm[/yyyy]
          let year = today.getFullYear();
          let month = today.getMonth() + 1;
          let day = today.getDate();
          let hasDate = false;
          if (/\bhoje\b/i.test(text)) {
            hasDate = true;
          } else {
            const m = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
            if (m) {
              day = parseInt(m[1], 10);
              month = parseInt(m[2], 10);
              year = m[3] ? parseInt(m[3], 10) : year;
              hasDate = true;
            }
          }

          // Extrair possível cliente antes de vírgula (ex.: "Ithalo, das 15h...")
          let rawClientName: string | null = null;
          const commaIdx = text.indexOf(",");
          if (commaIdx > 0) {
            rawClientName = text.slice(0, commaIdx).trim();
          }

          // Ambiente automático: 1 quadra e (opcional) 1 modalidade
          const singleQuadra = quadras.length === 1 ? quadras[0] : null;
          const singleModalidade = singleQuadra && singleQuadra.modalidades.length === 1 ? singleQuadra.modalidades[0] : null;

          if (intervalMatchC && hasDate && rawClientName && singleQuadra) {
            // Parse horas
            const h1 = parseInt(intervalMatchC[1], 10);
            const m1 = intervalMatchC[2] ? parseInt(intervalMatchC[2], 10) : 0;
            const h2 = parseInt(intervalMatchC[3], 10);
            const m2 = intervalMatchC[4] ? parseInt(intervalMatchC[4], 10) : 0;

            const dataStr = `${year}-${pad2(month)}-${pad2(day)}`;
            const horaInicio = `${pad2(h1)}:${pad2(m1)}`;
            const horaFim = `${pad2(h2)}:${pad2(m2)}`;

            // Resolver cliente por nome (igual à salvaguarda do create_agendamento)
            let resolvedClienteId: string | null = null;
            let ambiguousClients: Array<{ id: string; nome: string }> = [];
            try {
              const { data: candRows } = await sbDirect
                .from("clientes")
                .select("id, nome, status, flag_cliente")
                .eq("codigo_empresa", empresaCodigo)
                .eq("status", "active")
                .eq("flag_cliente", true)
                .ilike("nome", `%${rawClientName}%`)
                .limit(20);

              if (Array.isArray(candRows) && candRows.length > 0) {
                const target = canon(rawClientName);
                const scored = candRows.map((r: any) => {
                  const c = canon(String(r.nome || ""));
                  let score = 0;
                  if (c === target) score = 3; else if (c.includes(target) || target.includes(c)) score = 2; else score = 1;
                  return { id: String(r.id), nome: String(r.nome || ""), score };
                });
                const maxScore = Math.max(...scored.map(s => s.score));
                const top = scored.filter(s => s.score === maxScore);
                if (top.length === 1) resolvedClienteId = top[0].id; else if (top.length > 1) ambiguousClients = top.map(t => ({ id: t.id, nome: t.nome })).slice(0, 5);
              }
            } catch {}

            // Se modalidade única, podemos criar imediatamente; se múltiplas, ainda precisamos da modalidade
            if (!resolvedClienteId && ambiguousClients.length > 1) {
              // Mantém fluxo textual para o modelo desambiguar
            } else if (singleModalidade) {
              // Criar imediatamente
              // Montar payload compatível com tool create_agendamento
              // Converter hora_fim 00:00 -> dia seguinte é tratado na tool, aqui mantemos HH:mm
              const insertPayload: any = {
                codigo_empresa: empresaCodigo,
              };
              // Reutilizar a própria tool via chamada direta ao banco para consistência
              const bodyForTool = {
                cliente_codigo: resolvedClienteId || null,
                cliente_nome: rawClientName,
                data: dataStr,
                hora_inicio: horaInicio,
                hora_fim: horaFim,
                quadra_id: singleQuadra.id,
                modalidade: singleModalidade,
                status: "scheduled",
              };

              // Executa a mesma lógica de criação da tool (simplificada usando a tabela diretamente)
              // Para garantir consistência com validações, preferimos chamar o mesmo bloco de criação? Aqui replicamos via insert direto seguindo regras simples.
              // Monta início/fim em UTC-3
              const offsetMinutes = -3 * 60;
              const toUtcIso = (y: number, mo: number, d: number, hh: number, mm: number) => {
                const localMs = Date.UTC(y, mo - 1, d, hh, mm, 0, 0);
                const utcMs = localMs - offsetMinutes * 60000;
                return new Date(utcMs).toISOString();
              };
              const inicioIso = toUtcIso(year, month, day, h1, m1);
              let endY = year, endM = month, endD = day;
              if (h2 === 0 && m2 === 0) {
                const tmp = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
                tmp.setUTCDate(tmp.getUTCDate() + 1);
                endY = tmp.getUTCFullYear(); endM = tmp.getUTCMonth() + 1; endD = tmp.getUTCDate();
              }
              const fimIso = toUtcIso(endY, endM, endD, h2, m2);

              const insertRow: Record<string, any> = {
                codigo_empresa: empresaCodigo,
                inicio: inicioIso,
                fim: fimIso,
                status: "scheduled",
                modalidade: singleModalidade,
                quadra_id: singleQuadra.id,
                clientes: [rawClientName],
              };
              if (resolvedClienteId) insertRow.cliente_id = resolvedClienteId;

              const { data: created, error: createErr } = await sbDirect
                .from("agendamentos")
                .insert(insertRow)
                .select("id, codigo, inicio, fim, status, modalidade, quadra_id")
                .maybeSingle();

              if (!createErr && created) {
                // Sucesso: responder direto e encerrar fluxo
                const ihh = pad2(h1), imm = pad2(m1), fhh = pad2(h2), fmm = pad2(m2);
                const dataLeg = `${pad2(day)}/${pad2(month)}/${year}`;
                reply = `O agendamento para o cliente ${resolvedClienteId ? rawClientName : rawClientName} no dia ${dataLeg}, das ${ihh}:${imm} às ${fhh}:${fmm}, na ${singleQuadra.nome} com modalidade ${singleModalidade} foi criado com sucesso! 🎉`;
                const duration = Date.now() - startedAt;
                console.log(`[chat-proxy][${reqId}] response`, { source: "tools-direct", duration_ms: duration, reply_preview: reply.slice(0, 200) });
                return new Response(JSON.stringify({ reply, source: "tools-direct", debug: { strategy: "reserve" } }), {
                  status: 200,
                  headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "tools-direct", "x-isis-duration-ms": String(duration) },
                });
              }
            }
          }

          // Construir bloco informativo de quadras/modalidades
          let md = "";
          if (quadras.length === 1) {
            const unica = quadras[0];
            if (unica.modalidades.length === 1) {
              md += `Encontrei uma única quadra no seu espaço: **${unica.nome}** (modalidade única: **${unica.modalidades[0]}**).\n\n`;
            } else if (unica.modalidades.length > 1) {
              md += `Sua quadra **${unica.nome}** tem estas modalidades: ${unica.modalidades.map(m => `**${m}**`).join(", ")}.\n\n`;
            } else {
              md += `Encontrei a quadra **${unica.nome}**.\n\n`;
            }
          } else {
            md += `Estas são as quadras do seu espaço e suas modalidades:\n\n`;
            quadras.forEach((q, i) => {
              const mods = q.modalidades.length > 0 ? q.modalidades.map(m => `**${m}**`).join(", ") : "(sem modalidades cadastradas)";
              md += `${i + 1}. **${q.nome}** – ${mods}\n`;
            });
            md += `\n`;
          }

          // Mensagem final guiando o usuário para fornecer os demais campos
          md += `Para criar o agendamento, me informe:\n\n`;
          md += `- **Cliente:** Informe um cliente já cadastrado (ex.: **Maria Souza**) \n  ou **consumidor sem cadastro** com **nome mascarado** (ex.: '**Gilmar**', '**Time do João**').\n`;
          md += `- **Data:** (ex.: 28/11/2025)\n`;
          md += `- **Horário de início e fim:** (ex.: 18:00 às 19:00)\n`;
          if (quadras.length > 1) md += `- **Quadra:** escolha uma das listadas acima\n`;
          if (quadras.some(q => q.modalidades.length > 1)) md += `- **Modalidade:** escolha entre as modalidades listadas para a quadra\n`;

          reply = md;
        }
      } catch (e) {
        // Em caso de erro, mantém a resposta original
        console.log("[chat-proxy] preflight create_agendamento enrichment failed", { err: String(e) });
      }
    }

    const duration = Date.now() - startedAt;
    console.log(`[chat-proxy][${reqId}] response`, {
      source: "openai",
      duration_ms: duration,
      reply_preview: reply.slice(0, 200),
    });

    return new Response(JSON.stringify({ reply, replies: reply ? [reply] : [], source: "openai", debug: { tools: debugTools, strategy: "primary" } }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "openai", "x-isis-duration-ms": String(duration) },
    });
  } catch (err) {
    const duration = Date.now() - startedAt;
    console.log(`[chat-proxy][${reqId}] error=${String(err)} duration_ms=${duration}`);
    return new Response(JSON.stringify({ reply: "Erro inesperado no servidor.", source: "fallback", debug: { strategy: "reserve" } }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders, "x-isis-source": "fallback", "x-isis-duration-ms": String(duration) },
    });
  }
});
