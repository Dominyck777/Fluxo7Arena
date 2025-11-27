"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
// deno-lint-ignore-file no-explicit-any
var server_ts_1 = require("https://deno.land/std@0.181.0/http/server.ts");
var supabase_js_2_1 = require("https://esm.sh/@supabase/supabase-js@2");
var corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "x-isis-source, x-isis-duration-ms",
};
var handler = function (req) { return __awaiter(void 0, void 0, void 0, function () {
    var startedAt, reqId, apiKey, body, message, empresaCodigo, usuarioId, usuarioNome, usuarioCargo, history_1, pad2, nowUtc, offsetMinutesToday, nowLocalMs, nowLocal, todayStr_1, thisMonthStr, thisYear, messageMentionsToday, historyMentionsTodayAgendamentos, reversed, lastUserMsg, txt, lastAssistantMsg, txt, isYesConfirmation, lastAssistant, lastAssistantText, isCancelConfirmation, supabaseUrl, supabaseAnonKey, authHeader, sbDirect, dateMatch, year, monthIndex, dayNum, d, m, y, dayStart, dayEnd, data_inicio, data_fim, clientNames, clientRegex, match, rawName, cleaned, q, _a, data, error, count, durationCancel, reply_1, rows, reply_2, ids, reply_3, _b, updated, updateError, reply_4, reply_5, e_1, durationCancel, reply_6, isLastAssistantChangeProposal, targetHour, targetMinute, intervalMatch, timeMatch, mentionsFinalize14, supabaseUrl, supabaseAnonKey, authHeader, sbDirect, today, start, end, data_inicio, data_fim, _c, data, error, unico, offsetMinutes, normalizeIso, inicioDateUtc, fimDateUtc, pad, horarioAtualLegivel, inicioLocalMs, fimLocalMs, inicioLocal, fimLocal, ih, imin, fh, fmin, newFimIso, baseLocalDate, newFimUtcMs, newFimUtc, _d, updated, updateError, duration, reply_7, novoHorarioLegivel, reply_8, userWantsChange, mentions14h, isChangeTodayTo14h, supabaseUrl, supabaseAnonKey, authHeader, sbDirect, today, start, end, data_inicio, data_fim, _f, data, error, duration, pad_1, normalizeIso_1, offsetMinutes_1, items, reply_9, saudacaoNome, isFollowupAck, unico, cliente, quadra, horarioAtual, novoHorarioLegivel, reply_10, unico, cliente, quadra, dataLegivel, horarioLegivel, participantesTotal, participantesPagos, participantesPendentes, md_1, md_2, masterPrompt, systemPrompt, messages, debugTools, tools, firstResp, normalizedMessage, isGenericAgendaTodayQuestion, duration, supabaseUrl, supabaseAnonKey, authHeader, sbDirect, today, start, end, data_inicio, data_fim, _g, data, error, reply_11, pad_2, normalizeIso_2, offsetMinutes_2, items, reply_12, mapStatus_1, md_3, totalItems, reply_13, firstData, choice, toolCalls, supabaseUrl, supabaseAnonKey, authHeader, sb, lastGetAgendamentosResult, lastUpdateAgendamentoResult, _loop_1, _i, toolCalls_1, tc, r, campos, camposResumo, errMsg, mdErro, durationErro, secondResp, durationSecond, secondData, finalReply, preliminaryReply, replies, hasWriteAllowed, onlyReadTools, durationGuard, items, md_4, it, cliente, quadra, dataLegivel, horarioLegivel, durationOpenaiTools, reply, durationOpenai, durationError;
    var _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
    return __generator(this, function (_z) {
        switch (_z.label) {
            case 0:
                startedAt = Date.now();
                reqId = (_j = (_h = crypto.randomUUID) === null || _h === void 0 ? void 0 : _h.call(crypto)) !== null && _j !== void 0 ? _j : Math.random().toString(36).slice(2);
                if (req.method === "OPTIONS") {
                    return [2 /*return*/, new Response("ok", { headers: __assign({}, corsHeaders) })];
                }
                _z.label = 1;
            case 1:
                _z.trys.push([1, , 27, 28]);
                if (req.method !== "POST") {
                    return [2 /*return*/, new Response(JSON.stringify({ error: "Method not allowed" }), {
                            status: 405,
                            headers: __assign({ "Content-Type": "application/json" }, corsHeaders),
                        })];
                }
                apiKey = Deno.env.get("ISIS-ADMIN-ARENA") || Deno.env.get("OPENAI_API_KEY_ISIS_ADMIN");
                if (!apiKey) {
                    return [2 /*return*/, new Response(JSON.stringify({ reply: "(backend não configurado)", source: "fallback", debug: { strategy: "reserve" } }), { status: 200, headers: __assign({ "Content-Type": "application/json" }, corsHeaders) })];
                }
                return [4 /*yield*/, req.json()];
            case 2:
                body = _z.sent();
                message = String((body === null || body === void 0 ? void 0 : body.message) || "").trim();
                empresaCodigo = typeof (body === null || body === void 0 ? void 0 : body.empresaCodigo) === "string"
                    ? String(body.empresaCodigo).trim()
                    : "";
                usuarioId = (body === null || body === void 0 ? void 0 : body.usuarioId) ? String(body.usuarioId) : null;
                usuarioNome = (body === null || body === void 0 ? void 0 : body.usuarioNome) ? String(body.usuarioNome) : null;
                usuarioCargo = (body === null || body === void 0 ? void 0 : body.usuarioCargo) ? String(body.usuarioCargo) : null;
                history_1 = Array.isArray(body === null || body === void 0 ? void 0 : body.history) ? body.history : [];
                if (!message) {
                    return [2 /*return*/, new Response(JSON.stringify({ error: "Missing 'message'" }), {
                            status: 400,
                            headers: __assign({ "Content-Type": "application/json" }, corsHeaders),
                        })];
                }
                if (!empresaCodigo) {
                    return [2 /*return*/, new Response(JSON.stringify({ error: "Missing 'empresaCodigo'" }), {
                            status: 400,
                            headers: __assign({ "Content-Type": "application/json" }, corsHeaders),
                        })];
                }
                pad2 = function (n) { return String(n).padStart(2, "0"); };
                nowUtc = new Date();
                offsetMinutesToday = -3 * 60;
                nowLocalMs = nowUtc.getTime() + offsetMinutesToday * 60000;
                nowLocal = new Date(nowLocalMs);
                todayStr_1 = "".concat(pad2(nowLocal.getUTCDate()), "/").concat(pad2(nowLocal.getUTCMonth() + 1), "/").concat(nowLocal.getUTCFullYear());
                thisMonthStr = pad2(nowLocal.getUTCMonth() + 1);
                thisYear = nowLocal.getUTCFullYear();
                messageMentionsToday = /hoje/i.test(message);
                historyMentionsTodayAgendamentos = false;
                if (!messageMentionsToday && Array.isArray(history_1) && history_1.length > 0) {
                    reversed = __spreadArray([], history_1, true).reverse();
                    lastUserMsg = reversed.find(function (m) { return m.role === "user"; });
                    if (lastUserMsg) {
                        txt = String(lastUserMsg.content || "");
                        if (/hoje/i.test(txt) && /\bagendamentos?\b/i.test(txt)) {
                            historyMentionsTodayAgendamentos = true;
                        }
                    }
                    if (!historyMentionsTodayAgendamentos) {
                        lastAssistantMsg = reversed.find(function (m) { return m.role === "assistant"; });
                        if (lastAssistantMsg) {
                            txt = String(lastAssistantMsg.content || "");
                            if (txt.includes("Agendamentos para o dia ".concat(todayStr_1))) {
                                historyMentionsTodayAgendamentos = true;
                            }
                        }
                    }
                }
                isYesConfirmation = /^(sim( mesmo| este mesmo)?|esse mesmo|isso mesmo|pode mudar|pode alterar|pode aplicar|pode fazer)\b/i.test(message);
                if (!isYesConfirmation) return [3 /*break*/, 26];
                lastAssistant = __spreadArray([], history_1, true).reverse().find(function (m) { return m.role === "assistant"; });
                lastAssistantText = ((lastAssistant === null || lastAssistant === void 0 ? void 0 : lastAssistant.content) || "").toString();
                isCancelConfirmation = /cancelar/i.test(lastAssistantText) || /cancelamento/i.test(lastAssistantText);
                if (!isCancelConfirmation) return [3 /*break*/, 7];
                _z.label = 3;
            case 3:
                _z.trys.push([3, 6, , 7]);
                supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
                supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
                authHeader = req.headers.get("Authorization") || "";
                sbDirect = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseAnonKey, {
                    global: { headers: { Authorization: authHeader } },
                });
                dateMatch = lastAssistantText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                year = nowLocal.getUTCFullYear();
                monthIndex = nowLocal.getUTCMonth();
                dayNum = nowLocal.getUTCDate();
                if (dateMatch) {
                    d = parseInt(dateMatch[1], 10);
                    m = parseInt(dateMatch[2], 10);
                    y = parseInt(dateMatch[3], 10);
                    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                        dayNum = d;
                        monthIndex = m - 1;
                        year = y;
                    }
                }
                dayStart = new Date(year, monthIndex, dayNum, 0, 0, 0, 0);
                dayEnd = new Date(year, monthIndex, dayNum + 1, 0, 0, 0, 0);
                data_inicio = dayStart.toISOString();
                data_fim = dayEnd.toISOString();
                clientNames = [];
                clientRegex = /Cliente:\s*([^\n]+)/gi;
                match = void 0;
                while ((match = clientRegex.exec(lastAssistantText)) !== null) {
                    rawName = match[1] || "";
                    cleaned = rawName.replace(/\*/g, "").trim();
                    if (cleaned && !clientNames.includes(cleaned)) {
                        clientNames.push(cleaned);
                    }
                }
                q = sbDirect
                    .from("v_agendamentos_isis")
                    .select("agendamento_id, inicio, fim, modalidade, agendamento_status, quadra_nome, representante_nome", { count: "exact" })
                    .eq("codigo_empresa", empresaCodigo)
                    .gte("inicio", data_inicio)
                    .lt("inicio", data_fim);
                if (clientNames.length > 0) {
                    q = q.in("representante_nome", clientNames);
                }
                return [4 /*yield*/, q];
            case 4:
                _a = _z.sent(), data = _a.data, error = _a.error, count = _a.count;
                durationCancel = Date.now() - startedAt;
                if (error) {
                    reply_1 = "Não consegui localizar os agendamentos que você pediu para cancelar agora. Tente novamente em alguns instantes ou especifique o cliente e horário.";
                    console.log("[chat-proxy][".concat(reqId, "] direct_cancel_error"), { error: error.message });
                    return [2 /*return*/, new Response(JSON.stringify({ reply: reply_1, source: "tools-direct", debug: { strategy: "reserve" } }), {
                            status: 200,
                            headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(durationCancel) }),
                        })];
                }
                rows = Array.isArray(data) ? data : [];
                if (!rows.length) {
                    reply_2 = "Não encontrei agendamentos correspondentes para cancelar nesse período. Verifique se a data e os nomes dos clientes estão corretos.";
                    console.log("[chat-proxy][".concat(reqId, "] direct_cancel_not_found"), { clientNames: clientNames, data_inicio: data_inicio, data_fim: data_fim });
                    return [2 /*return*/, new Response(JSON.stringify({ reply: reply_2, source: "tools-direct", debug: { strategy: "reserve" } }), {
                            status: 200,
                            headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(durationCancel) }),
                        })];
                }
                ids = rows
                    .map(function (r) { return r === null || r === void 0 ? void 0 : r.agendamento_id; })
                    .filter(function (v) { return typeof v === "string" || typeof v === "number"; });
                if (!ids.length) {
                    reply_3 = "Encontrei registros na agenda, mas não consegui identificar os IDs dos agendamentos para cancelar. Tente novamente informando cliente e horário.";
                    console.log("[chat-proxy][".concat(reqId, "] direct_cancel_missing_ids"), { clientNames: clientNames, data_inicio: data_inicio, data_fim: data_fim });
                    return [2 /*return*/, new Response(JSON.stringify({ reply: reply_3, source: "tools-direct", debug: { strategy: "reserve" } }), {
                            status: 200,
                            headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(durationCancel) }),
                        })];
                }
                return [4 /*yield*/, sbDirect
                        .from("agendamentos")
                        .update({ status: "canceled" })
                        .in("id", ids)
                        .eq("codigo_empresa", empresaCodigo)
                        .select("id, status")];
            case 5:
                _b = _z.sent(), updated = _b.data, updateError = _b.error;
                if (updateError || !updated || !updated.length) {
                    reply_4 = "Não consegui concluir o cancelamento desses agendamentos agora. Nenhuma alteração foi gravada. Tente novamente em alguns instantes.";
                    console.log("[chat-proxy][".concat(reqId, "] direct_cancel_update_error"), { error: updateError === null || updateError === void 0 ? void 0 : updateError.message, ids: ids });
                    return [2 /*return*/, new Response(JSON.stringify({ reply: reply_4, source: "tools-direct", debug: { strategy: "reserve" } }), {
                            status: 200,
                            headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(durationCancel) }),
                        })];
                }
                reply_5 = "Tudo certo! Cancelei ".concat(updated.length, " agendamento(s) nesse per\u00EDodo conforme sua confirma\u00E7\u00E3o. \u2705");
                console.log("[chat-proxy][".concat(reqId, "] response"), {
                    source: "tools-direct",
                    duration_ms: durationCancel,
                    reply_preview: reply_5.slice(0, 200),
                });
                return [2 /*return*/, new Response(JSON.stringify({ reply: reply_5, source: "tools-direct", debug: { strategy: "reserve" } }), {
                        status: 200,
                        headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(durationCancel) }),
                    })];
            case 6:
                e_1 = _z.sent();
                durationCancel = Date.now() - startedAt;
                reply_6 = "Ocorreu um erro inesperado ao tentar cancelar os agendamentos. Nenhuma alteração foi gravada. Tente novamente em alguns instantes.";
                console.log("[chat-proxy][".concat(reqId, "] direct_cancel_exception"), { error: String(e_1) });
                return [2 /*return*/, new Response(JSON.stringify({ reply: reply_6, source: "tools-direct", debug: { strategy: "reserve" } }), {
                        status: 200,
                        headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(durationCancel) }),
                    })];
            case 7:
                isLastAssistantChangeProposal = /voc[eê]\s+confirma\s+que\s+deseja\s+aplicar\s+essa\s+altera[cç][aã]o\?/i.test(lastAssistantText);
                if (!!isLastAssistantChangeProposal) return [3 /*break*/, 8];
                return [3 /*break*/, 11];
            case 8:
                targetHour = null;
                targetMinute = 0;
                intervalMatch = lastAssistantText.match(/(\d{1,2})h(\d{2})?\s*às\s*(\d{1,2})h(\d{2})?/i);
                if (intervalMatch) {
                    targetHour = parseInt(intervalMatch[3] || "0", 10);
                    targetMinute = intervalMatch[4] ? parseInt(intervalMatch[4], 10) : 0;
                }
                if (targetHour === null) {
                    timeMatch = 
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
                    mentionsFinalize14 = /finalizar às 14h/i.test(lastAssistantText) || /horário final.*14h/i.test(lastAssistantText) || /novo horário.*14h/i.test(lastAssistantText) || /14h00/.test(lastAssistantText);
                    if (mentionsFinalize14) {
                        targetHour = 14;
                        targetMinute = 0;
                    }
                }
                if (!(targetHour !== null && targetHour >= 0 && targetHour <= 23 && targetMinute >= 0 && targetMinute <= 59)) return [3 /*break*/, 11];
                supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
                supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
                authHeader = req.headers.get("Authorization") || "";
                sbDirect = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseAnonKey, {
                    global: { headers: { Authorization: authHeader } },
                });
                today = new Date();
                start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
                end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0, 0);
                data_inicio = start.toISOString();
                data_fim = end.toISOString();
                return [4 /*yield*/, sbDirect
                        .from("v_agendamentos_isis")
                        .select("agendamento_id, inicio, fim, modalidade, quadra_nome, representante_nome")
                        .eq("codigo_empresa", empresaCodigo)
                        .gte("inicio", data_inicio)
                        .lt("inicio", data_fim)
                        .order("inicio", { ascending: true })];
            case 9:
                _c = _z.sent(), data = _c.data, error = _c.error;
                if (!(!error && Array.isArray(data) && data.length === 1)) return [3 /*break*/, 11];
                unico = data[0];
                offsetMinutes = -3 * 60;
                normalizeIso = function (iso) { return (iso.includes("T") ? iso : iso.replace(" ", "T")); };
                inicioDateUtc = new Date(normalizeIso(String(unico.inicio || "")));
                fimDateUtc = new Date(normalizeIso(String(unico.fim || "")));
                pad = function (n) { return String(n).padStart(2, "0"); };
                horarioAtualLegivel = "";
                if (!isNaN(inicioDateUtc.getTime()) && !isNaN(fimDateUtc.getTime())) {
                    inicioLocalMs = inicioDateUtc.getTime() + offsetMinutes * 60000;
                    fimLocalMs = fimDateUtc.getTime() + offsetMinutes * 60000;
                    inicioLocal = new Date(inicioLocalMs);
                    fimLocal = new Date(fimLocalMs);
                    ih = pad(inicioLocal.getUTCHours());
                    imin = pad(inicioLocal.getUTCMinutes());
                    fh = pad(fimLocal.getUTCHours());
                    fmin = pad(fimLocal.getUTCMinutes());
                    horarioAtualLegivel = "".concat(ih, "h").concat(imin, " \u00E0s ").concat(fh, "h").concat(fmin);
                }
                newFimIso = String(unico.fim || "");
                try {
                    baseLocalDate = new Date((inicioDateUtc.getTime() + offsetMinutes * 60000));
                    baseLocalDate.setUTCHours(targetHour, targetMinute, 0, 0);
                    newFimUtcMs = baseLocalDate.getTime() - offsetMinutes * 60000;
                    newFimUtc = new Date(newFimUtcMs);
                    newFimIso = newFimUtc.toISOString();
                }
                catch (_0) { }
                return [4 /*yield*/, sbDirect
                        .from("agendamentos")
                        .update({ fim: newFimIso })
                        .eq("id", unico.agendamento_id)
                        .eq("codigo_empresa", empresaCodigo)
                        .select("id")
                        .maybeSingle()];
            case 10:
                _d = _z.sent(), updated = _d.data, updateError = _d.error;
                duration = Date.now() - startedAt;
                if (updateError || !updated) {
                    reply_7 = "Não consegui concluir a alteração do agendamento agora. Tente novamente em alguns instantes.";
                    console.log("[chat-proxy][".concat(reqId, "] direct_update_error"), {
                        error: updateError === null || updateError === void 0 ? void 0 : updateError.message,
                    });
                    return [2 /*return*/, new Response(JSON.stringify({ reply: reply_7, source: "tools-direct", debug: { error: updateError === null || updateError === void 0 ? void 0 : updateError.message } }), {
                            status: 200,
                            headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(duration) }),
                        })];
                }
                novoHorarioLegivel = "".concat(pad(targetHour), "h").concat(pad(targetMinute));
                reply_8 = "\u2705 Alterei o agendamento de hoje para finalizar \u00E0s ".concat(novoHorarioLegivel, ".\n\n- **Cliente:** ").concat(unico.representante_nome || "Cliente", "\n- **Quadra:** ").concat(unico.quadra_nome || "(não informado)", "\n- **Hor\u00E1rio anterior:** ").concat(horarioAtualLegivel || "(não identificado)", "\n- **Novo hor\u00E1rio:** ").concat(novoHorarioLegivel, " (t\u00E9rmino)\n\nSe quiser, posso listar novamente os agendamentos de hoje para voc\u00EA conferir.");
                console.log("[chat-proxy][".concat(reqId, "] response"), {
                    source: "tools-direct",
                    duration_ms: duration,
                    reply_preview: reply_8.slice(0, 200),
                });
                return [2 /*return*/, new Response(JSON.stringify({ reply: reply_8, source: "tools-direct", debug: { strategy: "reserve" } }), {
                        status: 200,
                        headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(duration) }),
                    })];
            case 11:
                userWantsChange = /\b(mudar|mude|muda|alterar|altera|altere|remarcar|remarca|cancelar|cancela|trocar|troca)\b/i.test(message);
                mentions14h = /14h/i.test(message);
                isChangeTodayTo14h = userWantsChange && mentions14h && (messageMentionsToday || historyMentionsTodayAgendamentos);
                if (!isChangeTodayTo14h) return [3 /*break*/, 13];
                supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
                supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
                authHeader = req.headers.get("Authorization") || "";
                sbDirect = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseAnonKey, {
                    global: { headers: { Authorization: authHeader } },
                });
                today = new Date();
                start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
                end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0, 0);
                data_inicio = start.toISOString();
                data_fim = end.toISOString();
                return [4 /*yield*/, sbDirect
                        .from("v_agendamentos_isis")
                        .select("agendamento_id, inicio, fim, modalidade, agendamento_status, quadra_nome, representante_nome, participantes_total, participantes_pagos, participantes_pendentes")
                        .eq("codigo_empresa", empresaCodigo)
                        .gte("inicio", data_inicio)
                        .lt("inicio", data_fim)
                        .order("inicio", { ascending: true })];
            case 12:
                _f = _z.sent(), data = _f.data, error = _f.error;
                duration = Date.now() - startedAt;
                if (error) {
                    console.log("[chat-proxy][".concat(reqId, "] direct_get_agendamentos_error"), { error: error.message });
                    return [2 /*return*/, new Response(JSON.stringify({
                            reply: "Não consegui listar os agendamentos de hoje para ajudar na alteração.",
                            source: "fallback",
                            debug: { strategy: "reserve" },
                        }), {
                            status: 200,
                            headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "fallback", "x-isis-duration-ms": String(duration) }),
                        })];
                }
                pad_1 = function (n) { return String(n).padStart(2, "0"); };
                normalizeIso_1 = function (iso) { return (iso.includes("T") ? iso : iso.replace(" ", "T")); };
                offsetMinutes_1 = -3 * 60;
                items = (data || []).map(function (row) {
                    var inicioDateUtc = new Date(normalizeIso_1(String(row.inicio || "")));
                    var fimDateUtc = new Date(normalizeIso_1(String(row.fim || "")));
                    var data_legivel = "";
                    var horario_legivel = "";
                    if (!isNaN(inicioDateUtc.getTime()) && !isNaN(fimDateUtc.getTime())) {
                        var inicioLocalMs = inicioDateUtc.getTime() + offsetMinutes_1 * 60000;
                        var fimLocalMs = fimDateUtc.getTime() + offsetMinutes_1 * 60000;
                        var inicioLocal = new Date(inicioLocalMs);
                        var fimLocal = new Date(fimLocalMs);
                        var dia = pad_1(inicioLocal.getUTCDate());
                        var mes = pad_1(inicioLocal.getUTCMonth() + 1);
                        var ano = inicioLocal.getUTCFullYear();
                        data_legivel = "".concat(dia, "/").concat(mes, "/").concat(ano);
                        var ih = pad_1(inicioLocal.getUTCHours());
                        var imin = pad_1(inicioLocal.getUTCMinutes());
                        var fh = pad_1(fimLocal.getUTCHours());
                        var fmin = pad_1(fimLocal.getUTCMinutes());
                        horario_legivel = "".concat(ih, "h").concat(imin, " \u00E0s ").concat(fh, "h").concat(fmin);
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
                        data_legivel: data_legivel,
                        horario_legivel: horario_legivel,
                    };
                });
                if (!items.length) {
                    reply_9 = "Não encontrei agendamentos para hoje no seu espaço. Se quiser, posso verificar outra data ou cliente específico.";
                    console.log("[chat-proxy][".concat(reqId, "] response"), {
                        source: "tools-direct",
                        duration_ms: duration,
                        reply_preview: reply_9.slice(0, 200),
                    });
                    return [2 /*return*/, new Response(JSON.stringify({ reply: reply_9, source: "tools-direct" }), {
                            status: 200,
                            headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(duration) }),
                        })];
                }
                if (items.length <= 5) {
                    saudacaoNome = usuarioNome ? "Ol\u00E1, ".concat(usuarioNome, "! ") : "";
                    isFollowupAck = /\b(certo|ok|blz|beleza|tudo bem|ent[aã]o)\b/i.test(message);
                    if (items.length === 1 && isFollowupAck) {
                        unico = items[0];
                        cliente = unico.representante_nome || "Cliente Consumidor";
                        quadra = unico.quadra_nome || "Quadra";
                        horarioAtual = unico.horario_legivel || "(horário não informado)";
                        novoHorarioLegivel = "14h00";
                        reply_10 = "".concat(saudacaoNome, "S\u00F3 pra confirmar: vou alterar o agendamento de hoje do **Cliente:** ").concat(cliente, " na **Quadra:** ").concat(quadra, ", que atualmente est\u00E1 em **Hor\u00E1rio atual:** ").concat(horarioAtual, ", para **finalizar \u00E0s ").concat(novoHorarioLegivel, "**.\n\nVoc\u00EA confirma que deseja aplicar essa altera\u00E7\u00E3o? (sim/n\u00E3o)");
                        console.log("[chat-proxy][".concat(reqId, "] response"), {
                            source: "tools-direct",
                            duration_ms: duration,
                            reply_preview: reply_10.slice(0, 200),
                        });
                        return [2 /*return*/, new Response(JSON.stringify({ reply: reply_10, source: "tools-direct" }), {
                                status: 200,
                                headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(duration) }),
                            })];
                    }
                    // Caso geral de até 5 agendamentos: se houver apenas 1, já
                    // sugerimos diretamente a alteração para 14h; se houver mais,
                    // pedimos para o usuário escolher.
                    if (items.length === 1) {
                        unico = items[0];
                        cliente = unico.representante_nome || "Cliente Consumidor";
                        quadra = unico.quadra_nome || "Quadra";
                        dataLegivel = unico.data_legivel || todayStr_1;
                        horarioLegivel = unico.horario_legivel || "(horário não informado)";
                        participantesTotal = Number(unico.participantes_total || 0);
                        participantesPagos = Number(unico.participantes_pagos || 0);
                        participantesPendentes = Number(unico.participantes_pendentes || 0);
                        md_1 = "".concat(saudacaoNome, "\uD83D\uDCC5 Hoje (").concat(todayStr_1, ") encontrei 1 agendamento que bate com o que voc\u00EA pediu:\n\n");
                        md_1 += "1. ".concat(unico.modalidade || "Agendamento", " \u2013 ").concat(quadra, "\n");
                        md_1 += "   - **Cliente:** ".concat(cliente, "\n");
                        md_1 += "   - **Data:** ".concat(dataLegivel, "\n");
                        md_1 += "   - **Hor\u00E1rio:** ".concat(horarioLegivel, "\n");
                        if (participantesTotal > 0) {
                            md_1 += "   - **Participantes:** ".concat(participantesTotal, " (").concat(participantesPagos, " pagos, ").concat(participantesPendentes, " pendentes)\n");
                        }
                        md_1 += "\nPelo que entendi, voc\u00EA quer que **este agendamento** passe a finalizar \u00E0s 14h00. Voc\u00EA confirma que deseja aplicar essa altera\u00E7\u00E3o? (sim/n\u00E3o)";
                        console.log("[chat-proxy][".concat(reqId, "] response"), {
                            source: "tools-direct",
                            duration_ms: duration,
                            reply_preview: md_1.slice(0, 200),
                        });
                        return [2 /*return*/, new Response(JSON.stringify({ reply: md_1, source: "tools-direct", debug: { strategy: "reserve" } }), {
                                status: 200,
                                headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(duration) }),
                            })];
                    }
                    md_2 = "".concat(saudacaoNome, "\uD83D\uDCC5 Hoje (").concat(todayStr_1, ") encontrei ").concat(items.length, " agendamentos que posso alterar:\n\n");
                    items.forEach(function (it, idx) {
                        var linhaTitulo = "".concat(idx + 1, ". ").concat(it.modalidade || "Agendamento", " \u2013 ").concat(it.quadra_nome || "Quadra");
                        var cliente = it.representante_nome || "Cliente Consumidor";
                        var participantesTotal = Number(it.participantes_total || 0);
                        var participantesPagos = Number(it.participantes_pagos || 0);
                        var participantesPendentes = Number(it.participantes_pendentes || 0);
                        md_2 += "".concat(linhaTitulo, "\n");
                        md_2 += "   - **Cliente:** ".concat(cliente, "\n");
                        md_2 += "   - **Data:** ".concat(it.data_legivel || todayStr_1, "\n");
                        md_2 += "   - **Hor\u00E1rio:** ".concat(it.horario_legivel || "(horário não informado)", "\n");
                        if (participantesTotal > 0) {
                            md_2 += "   - **Participantes:** ".concat(participantesTotal, " (").concat(participantesPagos, " pagos, ").concat(participantesPendentes, " pendentes)\n");
                        }
                        md_2 += "\n";
                    });
                    md_2 +=
                        "Me diga **o número** do agendamento que você quer alterar (por exemplo, 1) e o que você deseja fazer (alterar horário, mudar status, cancelar, remarcar etc.), ou o nome do cliente, que eu preparo a alteração e peço sua confirmação final.";
                    console.log("[chat-proxy][".concat(reqId, "] response"), {
                        source: "tools-direct",
                        duration_ms: duration,
                        reply_preview: md_2.slice(0, 200),
                    });
                    return [2 /*return*/, new Response(JSON.stringify({ reply: md_2, source: "tools-direct" }), {
                            status: 200,
                            headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(duration) }),
                        })];
                }
                _z.label = 13;
            case 13:
                masterPrompt = "Você é a Ísis, assistente do Fluxo7 Arena. Fale em português, com tom profissional e simpático." + "\n\n" +
                    "Você está conversando com um humano autenticado no sistema." + "\n" +
                    "- ID do usuário: " + (usuarioId || "(desconhecido)") + "\n" +
                    "- Nome do usuário: " + (usuarioNome || "(desconhecido)") + "\n" +
                    "- Cargo/perfil: " + (usuarioCargo || "(desconhecido)") + "\n\n" +
                    "Quando o usuário disser coisas como \"meu\", \"meus agendamentos\", \"para mim\", assuma que ele está falando deste usuário logado (" + (usuarioNome || "usuário atual") + ") dentro da empresa atual." + "\n\n" +
                    "Hoje é " + todayStr_1 + ". Sempre que o usuário falar \"hoje\", \"amanhã\", \"ontem\", \"esse mês\", \"mês que vem\" ou expressões como \"dia 28 desse mês\" ou apenas \"dia 28\", você deve SEMPRE usar essa data (" + todayStr_1 + ") como referência de calendário (ano e mês atuais), e NUNCA usar datas internas do seu treinamento." + "\n" +
                    "Quando o usuário disser apenas um número de dia (por exemplo: \"dia 28\", \"no dia 5\") sem especificar mês/ano, você deve assumir que ele está falando do dia correspondente no MÊS e ANO ATUAIS, sem pedir confirmação, apenas deixando isso claro na resposta (por exemplo: \"Considerando o dia 28/" + thisMonthStr + "/" + thisYear + "...\")." + "\n\n" +
                    "Princípios:" + "\n" +
                    "- Ajude o usuário a entender e executar ações relativas à empresa atual." + "\n" +
                    "- Nunca invente dados. Quando não souber, peça contexto/filtros." + "\n" +
                    "- Use ferramentas quando disponíveis (function calling) para ler/escrever dados." + "\n" +
                    "- Respeite a segurança: somente dados da empresa logada." + "\n" +
                    "  - **Matriz de permissões (o que você PODE ou NÃO PODE alterar):**" + "\n" +
                    "  - Você pode **CRIAR e ALTERAR agendamentos** (horário, status, modalidade) usando as ferramentas apropriadas (por exemplo, create_agendamento e update_agendamento) ou os fluxos determinísticos específicos que o backend já implementa." + "\n" +
                    "  - Para criar um agendamento, sempre peça e confirme com o usuário os dados mínimos: **cliente** (ou indicação de Cliente Consumidor), **data**, **horário de início e fim** e, quando fizer sentido, **quadra** e **modalidade**." + "\n" +
                    "  - Fluxo de confirmação na criação de agendamento:" + "\n" +
                    "  - Na **primeira resposta**, interprete o pedido do usuário, proponha cliente/data/horário/quadra/modalidade e deixe claro que **ainda não criou nada**, pedindo uma confirmação única do tipo \"Posso criar assim para você?\"." + "\n" +
                    "  - Se o usuário responder algo como **\"sim\"**, **\"pode criar\"**, **\"ok\"**, **\"isso mesmo\"** ou variações equivalentes, no **próximo turno você deve obrigatoriamente chamar a ferramenta create_agendamento** com os dados já definidos (cliente, data, hora_inicio, hora_fim, quadra e modalidade) e, em seguida, responder dizendo claramente se o agendamento **foi criado** ou se houve algum erro da tool." + "\n" +
                    "  - **Não fique em ciclos de confirmação** apenas textuais para criação (por exemplo, responder várias vezes \"confirmo a criação?\" ou \"vou criar agora\" sem de fato chamar create_agendamento). Depois que o usuário confirmar, o próximo passo é sempre tentar criar o agendamento via tool." + "\n" +
                    "  - Sempre que o usuário mencionar um cliente pelo nome (por exemplo: \"agendar pro João Silva amanhã às 20h\"), tente primeiro localizar esse cliente cadastrado usando a ferramenta get_clientes, com search_term baseado no nome ou telefone informado:" + "\n" +
                    "  - Se get_clientes retornar exatamente 1 cliente compatível, considere que é esse cliente e, ao chamar create_agendamento, preencha cliente_codigo com o código ou id retornado e cliente_nome com o nome oficial do cadastro." + "\n" +
                    "  - Se get_clientes retornar mais de um cliente compatível (nomes iguais ou muito parecidos), não crie o agendamento ainda: liste as opções com labels em negrito (por exemplo: **Código:**, **Nome:**, **Telefone:**) e peça para o usuário escolher explicitamente qual cliente usar, explicando que nenhum agendamento foi criado ainda." + "\n" +
                    "  - Se get_clientes não encontrar nenhum cliente compatível, siga o fluxo de **Cliente Consumidor** descrito abaixo." + "\n" +
                    "  - Quando o usuário quiser usar **Cliente Consumidor** (sem cadastro) ou quando você não encontrar nenhum cliente cadastrado compatível:" + "\n" +
                    "  - não preencha o campo cliente_codigo na chamada de create_agendamento;" + "\n" +
                    "  - use em cliente_nome **exatamente o nome informado pelo usuário** (por exemplo: \"Gilmar\"), sem prefixar com \"Consumidor\" nem acrescentar sufixos como \"(sem cadastro)\". Trate esse nome como a identificação amigável do responsável pelo agendamento;" + "\n" +
                    "  - deixe isso claro na resposta para o usuário, explicando em texto que o agendamento será criado como **consumidor sem cadastro** com esse nome, mas sem incluir a palavra \"Consumidor\" dentro do próprio nome." + "\n" +
                    "  - Para definir **quadra e modalidade** na criação de agendamentos, use a ferramenta get_quadras para entender a configuração da arena antes de chamar create_agendamento:" + "\n" +
                    "  - Assim que você entender que o usuário quer **criar um agendamento em uma data/horário específicos**, use get_quadras **no próprio primeiro turno de proposta de criação**, em conjunto com get_clientes. Ou seja, não espere o usuário responder \"sim\" para só então chamar get_quadras; você pode buscar as quadras/modalidades de forma proativa." + "\n" +
                    "  - Se get_quadras retornar **exatamente 1 quadra** com **exatamente 1 modalidade cadastrada**, você pode assumir automaticamente essa combinação e deixar isso claro já na primeira resposta de confirmação (por exemplo, mencionando a quadra e a modalidade que serão usadas), sem pedir que o usuário escolha quadra/modalidade." + "\n" +
                    "  - Se get_quadras retornar **mais de uma quadra** ou **mais de uma modalidade**, **não chame create_agendamento ainda**: liste as opções relevantes (quadras e/ou modalidades) com labels em negrito e peça explicitamente para o usuário escolher a quadra e/ou modalidade desejadas. Só depois dessa escolha chame create_agendamento já com os campos quadra_id (quando aplicável) e modalidade preenchidos." + "\n" +
                    "  - Nunca chame create_agendamento sem informar uma modalidade válida quando houver mais de uma modalidade disponível para a quadra; use sempre o resultado de get_quadras ou a escolha direta do usuário para definir a modalidade." + "\n" +
                    "  - Use get_quadras **no máximo uma vez em cada fluxo de criação de agendamento**. Depois que você já tiver dito para o usuário qual será a quadra e a modalidade utilizadas, considere essas informações como definidas e parta para a criação efetiva (create_agendamento) após a confirmação, em vez de chamar get_quadras novamente para o mesmo pedido." + "\n" +
                    "  - Dados de **clientes**, **comandas**, **faturamento/financeiro** e qualquer outro domínio são **somente leitura**: você pode consultar, resumir e explicar, mas NÃO pode criar/editar/excluir registros nesses módulos." + "\n" +
                    "  - Se o usuário pedir para alterar algo que não seja agendamento (por exemplo: mudar nome de cliente, editar dados de comanda, ajustar fatura/caixa), explique claramente que você **não tem permissão para alterar esses dados** e oriente a usar as telas do sistema apropriadas (ex.: tela de Clientes, tela de Comandas, tela de Financeiro)." + "\n" +
                    "- Prefira respostas curtas com:" + "\n" +
                    "  - Resumo" + "\n" +
                    "  - Pontos-chave" + "\n" +
                    "  - Próximos passos (se houver)." + "\n\n" +
                    "Escopo de conhecimento do sistema (alto nível):" + "\n" +
                    "- Agenda/Quadras: agendamentos, participantes, disponibilidade, configurações (agenda_settings), quadras e dias de funcionamento." + "\n" +
                    "- Clientes: cadastro e busca por nome/telefone." + "\n" +
                    "- Vendas/Produtos: vendas, itens_venda, produtos, categorias." + "\n" +
                    "- Comandas/Mesas: comandas, comanda_itens, mesas." + "\n" +
                    "- Financeiro/Caixa: caixa_sessoes, caixa_movimentos, caixa_resumos, pagamentos." + "\n\n" +
                    "Boas práticas de interação:" + "\n" +
                    "- Estilo geral (parecido com o ChatGPT):" + "\n" +
                    "  - Responda de forma clara, direta e educada." + "\n" +
                    "  - Use Markdown simples para organizar a resposta: listas e, quando fizer sentido, um parágrafo final com comentário/sugestão. **Não use headings com \"#\" (por exemplo, linhas começando com ###)**, pois o frontend não renderiza títulos, apenas texto normal." + "\n" +
                    "  - Use **negrito apenas em labels importantes**, e use SEMPRE labels em negrito quando estiver apresentando dados estruturados ou pedidos de confirmação. Exemplos de labels: **Cliente:**, **Data:**, **Quadra:**, **Status:**, **Horário atual:**, **Novo horário:**." + "\n" +
                    "  - Sempre que estiver propondo a criação de um novo agendamento, formate a proposta em uma lista legível com uma linha por campo principal, por exemplo:" + "\n" +
                    "    - **Cliente:** ..." + "\n" +
                    "    - **Data:** ..." + "\n" +
                    "    - **Horário:** ..." + "\n" +
                    "    - **Quadra:** ..." + "\n" +
                    "    - **Modalidade:** ..." + "\n" +
                    "    Em seguida, faça a pergunta de confirmação (por exemplo: \"Posso criar assim para você?\")." + "\n" +
                    "  - Use emojis com moderação, mas de forma consistente: na maior parte das respostas inclua **pelo menos 1 emoji** (geralmente na primeira frase), e no máximo 1 ou 2 por resposta. Não encha todos os itens com emojis." + "\n" +
                    "  - Evite prometer respostas intermediárias que não vão acontecer. Por exemplo, ao verificar quadras/modalidades para criação de agendamento, **não diga que vai \"verificar e já volta\" ou peça para o usuário \"aguardar\" se você vai tratar isso internamente e seguir direto para a confirmação única**. Prefira já explicar na própria resposta o que será feito e pedir a confirmação necessária." + "\n" +
                    "  - Ao falar com o usuário, evite usar a palavra \"empresa\". Prefira se referir ao contexto como \"sua arena\", \"seu espaço\" ou pelo nome do local quando isso estiver claro na conversa. Use \"empresa\" apenas como conceito interno/técnico neste prompt, não nas frases mostradas ao usuário." + "\n" +
                    "  - Quando falar de **status** com o usuário, **nunca use os valores internos em inglês** (por exemplo: \"scheduled\", \"confirmed\", \"finished\", \"canceled\", \"in_progress\") nas frases. Sempre traduza para rótulos em português, por exemplo:" + "\n" +
                    "    - scheduled → **Agendado**" + "\n" +
                    "    - confirmed → **Confirmado**" + "\n" +
                    "    - finished / concluded / done → **Concluído**" + "\n" +
                    "    - canceled / cancelled → **Cancelado**" + "\n" +
                    "    - in_progress → **Em andamento**" + "\n" +
                    "    - pending → **Pendente**" + "\n" +
                    "    Esses valores em inglês devem ser usados **apenas internamente** ao preencher o campo 'status' nas tools (como update_agendamento ou create_agendamento), nunca exibidos literalmente ao usuário. Ao falar de status padrão em uma frase, use sempre o rótulo em português (por exemplo: \"status padrão será **Agendado**\" em vez de \"scheduled\"). Na **criação de novos agendamentos**, não ofereça opções de status nem pergunte qual status usar; assuma o status padrão interno \"scheduled\" (Agendado) e só altere o status quando o usuário pedir isso de forma clara (por exemplo: cancelar, confirmar, concluir)." + "\n" +
                    "  - Na criação de agendamentos, em empresas com **apenas uma quadra ativa**, não peça para o usuário escolher quadra: considere que a quadra única será usada automaticamente pelo sistema (você pode apenas mencionar o nome da quadra na confirmação, se fizer sentido). Em respostas e pedidos de confirmação, nesses casos nunca diga que precisa que o usuário informe a quadra; trate a quadra como já definida." + "\n" +
                    "  - Para **modalidade**, nunca invente modalidades livres: use sempre as modalidades cadastradas na quadra. Quando o backend ou as tools de criação retornarem uma lista de modalidades disponíveis para aquela quadra, ofereça essas opções ao usuário para ele escolher uma delas, em vez de aceitar qualquer texto arbitrário. **Se a quadra tiver exatamente uma modalidade cadastrada, você pode assumir essa modalidade automaticamente, sem perguntar ao usuário; só peça modalidade quando houver mais de uma opção ou quando uma chamada anterior de create_agendamento tiver falhado por modalidade inválida.** Se uma chamada de create_agendamento falhar indicando problema de modalidade e trazendo uma lista de modalidades_disponiveis na resposta da tool, use essa lista para pedir apenas a modalidade correta, sem dizer que precisa da quadra." + "\n" +
                    "  - Para consultas de agenda (agendamentos):" + "\n" +
                    "  - Se o usuário fizer uma pergunta genérica sobre agendamentos (por exemplo: \"quais os agendamentos?\"), **NÃO peça confirmação de período**: assuma diretamente HOJE (00:00 às 23:59) e deixe isso claro na resposta." + "\n" +
                    "  - Só peça datas explícitas se o usuário mencionar claramente que quer outro período (ex.: semana, mês, intervalo personalizado)." + "\n" +
                    "  - Use filtros como quadra, status e **cliente_nome** quando o usuário estiver perguntando especificamente sobre **agendamentos** de um cliente (por exemplo: \"quais agendamentos do cliente Dominyck?\")." + "\n" +
                    "  - Ao responder usando resultados de get_agendamentos:" + "\n" +
                    "  - Use SEMPRE o contexto da pergunta para decidir o tom: se o usuário só quis consultar, foque em listar/resumir; se a pergunta já indicar intenção de mudar algo (horário, status, cancelar, remarcar), deixe isso claro na resposta e já proponha próximos passos." + "\n" +
                    "  - Depois de listar os agendamentos, **sempre ofereça ações claras** no final, como: sugerir que o usuário peça para **alterar horário**, **mudar status** ou **cancelar** algum item, explicando como ele pode se referir ao agendamento (pelo número da lista, cliente, quadra ou horário atual)." + "\n" +
                    "  - Quando o resultado tiver **apenas 1 agendamento** no período e o usuário demonstrar intenção de ação (por exemplo: \"mudar o agendamento de hoje\"), você pode assumir que ele está falando desse único agendamento, deixando isso explícito na frase (por exemplo: \"pelo que entendi, é este agendamento que você quer alterar\") e em seguida pedir confirmação antes de aplicar qualquer mudança." + "\n" +
                    "  - **Muito importante:** se neste turno você só usou ferramentas de **leitura** (por exemplo, apenas get_agendamentos, sem nenhuma chamada bem-sucedida de update_agendamento/create_agendamento), **NÃO prometa que já vai cancelar/alterar agora** (evite frases como \"vou cancelar esses agendamentos pra você agora\", \"vou alterar pra você\" neste mesmo turno). Em vez disso, limite-se a **listar/resumir** o que encontrou e **pedir confirmação explícita** do usuário sobre qual agendamento deve ser alterado/cancelado e como. Somente depois que o backend executar update_agendamento com sucesso em um turno seguinte é que você pode dizer que a alteração **foi aplicada**." + "\n" +
                    "  - Quando o usuário confirmar claramente que deseja **cancelar** um ou mais agendamentos que você acabou de listar (por exemplo, respondendo \"sim\" depois de você listar 1 ou mais agendamentos candidatos), use a ferramenta **update_agendamento** para cada agendamento envolvido, preenchendo SEMPRE o campo 'status' em 'campos' com o valor interno 'canceled' (por exemplo, campos.status = 'canceled') junto com o 'agendamento_id' correto. **Nunca chame update_agendamento sem preencher o objeto 'campos' com pelo menos um campo permitido (por exemplo, status).**" + "\n" +
                    "  - Evite repetir exatamente a mesma frase final em todas as respostas de agenda: mantenha o mesmo sentido (oferecer ajuda para alterar/cancelar/remarcar), mas varie ligeiramente a forma de falar de uma resposta para outra." + "\n" +
                    "- Para consultas de clientes (cadastro de clientes):" + "\n" +
                    "  - Quando o usuário perguntar se existe algum cliente com certo nome, telefone, e-mail ou código (por exemplo: \"tem algum cliente com nome Dominyck?\", \"listar clientes com telefone X\"), use **sempre** a ferramenta get_clientes com search_term baseado no que ele informou." + "\n" +
                    "  - Nessas consultas, responda falando sobre **clientes encontrados** (nome, código, contato etc.), e **não sobre agendamentos**, a menos que o usuário peça explicitamente pelos agendamentos desses clientes." + "\n" +
                    "- Quando tiver dados da view de agenda (incluindo cliente_nome_completo e quadra_nome), sempre mostre **nome de cliente e quadra**, nunca apenas IDs." + "\n" +
                    "- Formate datas como dd/MM/yyyy HH:mm (ex.: 14/11/2025 20:00)." + "\n" +
                    "- Ao usar a ferramenta get_agendamentos, SEMPRE respeite o resultado retornado:" + "\n" +
                    "  - Se result.ok = true e result.total > 0, NUNCA diga que \"não há agendamentos\". Em vez disso, use result.items para listar ou resumir os agendamentos." + "\n" +
                    "  - Se result.ok = true e result.total = 0, então você pode informar que não há agendamentos para aquele período." + "\n" +
                    "  - Considere result.filters.data_inicio/data_fim como a janela de datas efetivamente aplicada." + "\n" +
                    "- Não retorne segredos/credenciais." + "\n" +
                    "- Se não houver ferramenta para a tarefa, explique a limitação e sugira alternativas.";
                systemPrompt = masterPrompt;
                messages = __spreadArray(__spreadArray([
                    { role: "system", content: systemPrompt }
                ], history_1, true), [
                    { role: "user", content: message }
                ], false);
                debugTools = [];
                // Log pergunta do usuário
                console.log("[chat-proxy][".concat(reqId, "] user_message"), {
                    message: message,
                    history_count: history_1.length,
                    at: new Date().toISOString(),
                });
                tools = [
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
                return [4 /*yield*/, fetch("https://api.openai.com/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: "Bearer ".concat(apiKey),
                        },
                        body: JSON.stringify({
                            model: "gpt-4o-mini",
                            temperature: 0.4,
                            messages: messages,
                            tools: tools,
                            tool_choice: "auto"
                        }),
                    })];
            case 14:
                firstResp = _z.sent();
                normalizedMessage = String(message || "").toLowerCase();
                isGenericAgendaTodayQuestion = normalizedMessage.includes("hoje") &&
                    /agend/.test(normalizedMessage);
                if (!!firstResp.ok) return [3 /*break*/, 17];
                duration = Date.now() - startedAt;
                console.log("[chat-proxy][".concat(reqId, "] openai_error status=").concat(firstResp.status, " duration_ms=").concat(duration));
                if (!(firstResp.status === 429 && isGenericAgendaTodayQuestion)) return [3 /*break*/, 16];
                supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
                supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
                authHeader = req.headers.get("Authorization") || "";
                sbDirect = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseAnonKey, {
                    global: { headers: { Authorization: authHeader } },
                });
                today = new Date();
                start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
                end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0, 0);
                data_inicio = start.toISOString();
                data_fim = end.toISOString();
                return [4 /*yield*/, sbDirect
                        .from("v_agendamentos_isis")
                        .select("agendamento_id, inicio, fim, modalidade, agendamento_status, quadra_nome, representante_nome, participantes_total, participantes_pagos, participantes_pendentes")
                        .eq("codigo_empresa", empresaCodigo)
                        .gte("inicio", data_inicio)
                        .lt("inicio", data_fim)
                        .order("inicio", { ascending: true })];
            case 15:
                _g = _z.sent(), data = _g.data, error = _g.error;
                if (error) {
                    reply_11 = "Não consegui listar os agendamentos de hoje para responder sua pergunta agora. Tente novamente em alguns instantes.";
                    return [2 /*return*/, new Response(JSON.stringify({ reply: reply_11, source: "fallback", debug: { strategy: "reserve" } }), {
                            status: 200,
                            headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "fallback", "x-isis-duration-ms": String(duration) }),
                        })];
                }
                pad_2 = function (n) { return String(n).padStart(2, "0"); };
                normalizeIso_2 = function (iso) { return (iso.includes("T") ? iso : iso.replace(" ", "T")); };
                offsetMinutes_2 = -3 * 60;
                items = (data || []).map(function (row) {
                    var inicioDateUtc = new Date(normalizeIso_2(String(row.inicio || "")));
                    var fimDateUtc = new Date(normalizeIso_2(String(row.fim || "")));
                    var data_legivel = "";
                    var horario_legivel = "";
                    if (!isNaN(inicioDateUtc.getTime()) && !isNaN(fimDateUtc.getTime())) {
                        var inicioLocalMs = inicioDateUtc.getTime() + offsetMinutes_2 * 60000;
                        var fimLocalMs = fimDateUtc.getTime() + offsetMinutes_2 * 60000;
                        var inicioLocal = new Date(inicioLocalMs);
                        var fimLocal = new Date(fimLocalMs);
                        var dia = pad_2(inicioLocal.getUTCDate());
                        var mes = pad_2(inicioLocal.getUTCMonth() + 1);
                        var ano = inicioLocal.getUTCFullYear();
                        data_legivel = "".concat(dia, "/").concat(mes, "/").concat(ano);
                        var ih = pad_2(inicioLocal.getUTCHours());
                        var imin = pad_2(inicioLocal.getUTCMinutes());
                        var fh = pad_2(fimLocal.getUTCHours());
                        var fmin = pad_2(fimLocal.getUTCMinutes());
                        horario_legivel = "".concat(ih, "h").concat(imin, " \u00E0s ").concat(fh, "h").concat(fmin);
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
                        data_legivel: data_legivel,
                        horario_legivel: horario_legivel,
                    };
                });
                if (!items.length) {
                    reply_12 = "Hoje (".concat(todayStr_1, ") n\u00E3o h\u00E1 agendamentos no seu espa\u00E7o.");
                    return [2 /*return*/, new Response(JSON.stringify({ reply: reply_12, source: "tools-direct", debug: { strategy: "reserve" } }), {
                            status: 200,
                            headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(duration) }),
                        })];
                }
                mapStatus_1 = function (st) {
                    if (!st)
                        return "";
                    var s = String(st).toLowerCase();
                    if (s === "scheduled")
                        return "Agendado";
                    if (s === "confirmed")
                        return "Confirmado";
                    if (s === "finished" || s === "concluded" || s === "done")
                        return "Concluído";
                    if (s === "canceled" || s === "cancelled")
                        return "Cancelado";
                    if (s === "in_progress")
                        return "Em andamento";
                    return st;
                };
                md_3 = "\uD83D\uDCC5 Agendamentos para o dia ".concat(todayStr_1, "\n\n");
                totalItems = items.length;
                md_3 += "Encontrei ".concat(totalItems, " agendamento").concat(totalItems === 1 ? "" : "s", " hoje. Veja os detalhes abaixo:\n\n");
                items.forEach(function (it, idx) {
                    var linhaTitulo = "".concat(idx + 1, ". ").concat(it.modalidade || "Agendamento", " \u2013 ").concat(it.quadra_nome || "Quadra");
                    var cliente = it.representante_nome || "Cliente Consumidor";
                    var status = mapStatus_1(it.agendamento_status);
                    var participantesTotal = Number(it.participantes_total || 0);
                    var participantesPagos = Number(it.participantes_pagos || 0);
                    var participantesPendentes = Number(it.participantes_pendentes || 0);
                    md_3 += "".concat(linhaTitulo, "\n");
                    md_3 += "   - **Cliente:** ".concat(cliente, "\n");
                    md_3 += "   - **Data:** ".concat(it.data_legivel || todayStr_1, "\n");
                    md_3 += "   - **Hor\u00E1rio:** ".concat(it.horario_legivel || "(horário não informado)", "\n");
                    if (status)
                        md_3 += "   - **Status:** ".concat(status, "\n");
                    if (participantesTotal > 0) {
                        md_3 += "   - **Participantes:** ".concat(participantesTotal, " (").concat(participantesPagos, " pagos, ").concat(participantesPendentes, " pendentes)\n");
                    }
                    md_3 += "\n";
                });
                return [2 /*return*/, new Response(JSON.stringify({ reply: md_3, source: "tools-direct" }), {
                        status: 200,
                        headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(duration) }),
                    })];
            case 16:
                reply_13 = "Ops! Tive um problema ao responder agora.";
                if (firstResp.status === 429) {
                    reply_13 = "Estou recebendo muitas solicitações do meu motor de IA neste momento e não consegui concluir essa ação agora. Tente novamente em alguns instantes.";
                }
                return [2 /*return*/, new Response(JSON.stringify({ reply: reply_13, source: "fallback" }), {
                        status: 200,
                        headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "fallback", "x-isis-duration-ms": String(duration) }),
                    })];
            case 17: return [4 /*yield*/, firstResp.json()];
            case 18:
                firstData = _z.sent();
                choice = (_k = firstData === null || firstData === void 0 ? void 0 : firstData.choices) === null || _k === void 0 ? void 0 : _k[0];
                toolCalls = (_m = (_l = choice === null || choice === void 0 ? void 0 : choice.message) === null || _l === void 0 ? void 0 : _l.tool_calls) !== null && _m !== void 0 ? _m : [];
                if (!(Array.isArray(toolCalls) && toolCalls.length > 0)) return [3 /*break*/, 25];
                supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
                supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
                authHeader = req.headers.get("Authorization") || "";
                sb = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseAnonKey, {
                    global: { headers: { Authorization: authHeader } }
                });
                // Importante: incluir a mensagem de assistant com tool_calls antes das mensagens de tool
                messages.push({
                    role: "assistant",
                    content: (_p = (_o = choice === null || choice === void 0 ? void 0 : choice.message) === null || _o === void 0 ? void 0 : _o.content) !== null && _p !== void 0 ? _p : "",
                    tool_calls: toolCalls,
                });
                lastGetAgendamentosResult = null;
                lastUpdateAgendamentoResult = null;
                _loop_1 = function (tc) {
                    var name_1, argsRaw, result, args, page, page_size, from, to, data_inicio, data_fim, bodyInicio, bodyFim, hasExplicitDates, hasClienteNomeFilter, now, start, end, query, nome, _1, data, error, count, pad_3, offsetMinutes_3, items, clienteNomeRaw, dataRaw, horaInicioRaw, horaFimRaw, clienteCodigoRaw, resolvedClienteId, isNumericCodigo, cliQuery, _2, cliRow, cliErr, _3, year, month, day, _4, h1, m1, _5, h2, m2, offsetMinutes_4, toUtcIsoFromLocal, inicioIso, endYear, endMonth, endDay, tmp, fimIso, quadraId, clienteId, looksLikeUuid, modalidadeRaw, status_1, quadraModalidades, _6, quadrasAtivas, quadErr, quadrasCandidatas, _7, quadrasTodas, quadAllErr, unica, rawMods, e_2, _8, qRow, qErr, rawMods, e_3, normalize_1, modsNorm, requestedNorm_1, match, dayStartIso, nextDayLocal, nextDayYear, nextDayMonth, nextDayDay, nextDayIso, _9, existingRows, existingErr, normalizeIso_3, toLocalMinutes_1, requestedStartMin_1, requestedEndMin_1, bookingsLocal, hasConflict, DAY_MINUTES, freeIntervals, lastEnd, _10, bookingsLocal_1, b, s, e, pad_4, toHHMM_1, availableIntervals, conflictErr_1, insertPayload, _11, created, createError, participanteClienteId, _12, consumidor, consErr, consErr_1, participanteNome, participanteRow, partError, partErr_1, agendamentoId, campos, rootFieldCandidates, _13, rootFieldCandidates_1, field, allowedFields, updatePayload, _14, _15, _16, key, value, appliedFields, _17, updatedRows, updateError, searchTermRaw, limit, query, s, isNumeric, sNoH, orParts, _18, data, error, count, items, apenasAtivas, limit, query, _19, data, error, count, items, summary, e_4, errStr;
                    return __generator(this, function (_20) {
                        switch (_20.label) {
                            case 0:
                                name_1 = (_q = tc === null || tc === void 0 ? void 0 : tc.function) === null || _q === void 0 ? void 0 : _q.name;
                                argsRaw = ((_r = tc === null || tc === void 0 ? void 0 : tc.function) === null || _r === void 0 ? void 0 : _r.arguments) || "{}";
                                result = null;
                                _20.label = 1;
                            case 1:
                                _20.trys.push([1, 47, , 48]);
                                args = JSON.parse(argsRaw);
                                if (!(name_1 === "get_agendamentos")) return [3 /*break*/, 3];
                                page = Number((args === null || args === void 0 ? void 0 : args.page) || 1);
                                page_size = Math.min(Math.max(Number((args === null || args === void 0 ? void 0 : args.page_size) || 50), 1), 200);
                                from = (page - 1) * page_size;
                                to = from + page_size - 1;
                                data_inicio = String((args === null || args === void 0 ? void 0 : args.data_inicio) || "").trim();
                                data_fim = String((args === null || args === void 0 ? void 0 : args.data_fim) || "").trim();
                                if (!data_inicio || !data_fim) {
                                    bodyInicio = String((body === null || body === void 0 ? void 0 : body.data_inicio) || "").trim();
                                    bodyFim = String((body === null || body === void 0 ? void 0 : body.data_fim) || "").trim();
                                    if (bodyInicio && bodyFim) {
                                        data_inicio = bodyInicio;
                                        data_fim = bodyFim;
                                    }
                                }
                                hasExplicitDates = Boolean(data_inicio && data_fim);
                                hasClienteNomeFilter = Boolean(String((args === null || args === void 0 ? void 0 : args.cliente_nome) || "").trim());
                                // Fallback final: HOJE no servidor **apenas** se não houver
                                // cliente_nome nem datas explícitas (consulta genérica de agenda).
                                if (!hasExplicitDates && !hasClienteNomeFilter) {
                                    now = new Date();
                                    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                                    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
                                    data_inicio = start.toISOString();
                                    data_fim = end.toISOString();
                                }
                                query = sb
                                    .from("v_agendamentos_isis")
                                    .select("agendamento_id, agendamento_codigo, codigo_empresa, inicio, fim, modalidade, agendamento_status, quadra_id, quadra_nome, representante_nome, participantes_total, participantes_pagos, participantes_pendentes", { count: "exact" })
                                    .eq("codigo_empresa", empresaCodigo)
                                    .order("inicio", { ascending: true })
                                    .range(from, to);
                                if (data_inicio && data_fim) {
                                    query = query.gte("inicio", data_inicio).lt("inicio", data_fim);
                                }
                                if (args === null || args === void 0 ? void 0 : args.status)
                                    query = query.eq("agendamento_status", String(args.status));
                                if (args === null || args === void 0 ? void 0 : args.quadra_id)
                                    query = query.eq("quadra_id", String(args.quadra_id));
                                if (args === null || args === void 0 ? void 0 : args.cliente_nome) {
                                    nome = String(args.cliente_nome).trim();
                                    if (nome) {
                                        query = query.ilike("representante_nome", "%".concat(nome, "%"));
                                    }
                                }
                                return [4 /*yield*/, query];
                            case 2:
                                _1 = _20.sent(), data = _1.data, error = _1.error, count = _1.count;
                                if (error)
                                    throw error;
                                pad_3 = function (n) { return String(n).padStart(2, "0"); };
                                offsetMinutes_3 = -3 * 60;
                                items = (data || []).map(function (row) {
                                    var normalizeIso = function (iso) { return iso.includes("T") ? iso : iso.replace(" ", "T"); };
                                    var inicioIsoRaw = String(row.inicio || "");
                                    var fimIsoRaw = String(row.fim || "");
                                    var data_legivel = "";
                                    var horario_legivel = "";
                                    try {
                                        var inicioDateUtc = new Date(normalizeIso(inicioIsoRaw));
                                        var fimDateUtc = new Date(normalizeIso(fimIsoRaw));
                                        if (!isNaN(inicioDateUtc.getTime()) && !isNaN(fimDateUtc.getTime())) {
                                            var inicioLocalMs = inicioDateUtc.getTime() + offsetMinutes_3 * 60000;
                                            var fimLocalMs = fimDateUtc.getTime() + offsetMinutes_3 * 60000;
                                            var inicioLocal = new Date(inicioLocalMs);
                                            var fimLocal = new Date(fimLocalMs);
                                            var dia = pad_3(inicioLocal.getUTCDate());
                                            var mes = pad_3(inicioLocal.getUTCMonth() + 1);
                                            var ano = inicioLocal.getUTCFullYear();
                                            data_legivel = "".concat(dia, "/").concat(mes, "/").concat(ano);
                                            var ih = pad_3(inicioLocal.getUTCHours());
                                            var imin = pad_3(inicioLocal.getUTCMinutes());
                                            var fh = pad_3(fimLocal.getUTCHours());
                                            var fmin = pad_3(fimLocal.getUTCMinutes());
                                            horario_legivel = "".concat(ih, "h").concat(imin, " \u00E0s ").concat(fh, "h").concat(fmin);
                                        }
                                    }
                                    catch (_a) { }
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
                                        data_legivel: data_legivel,
                                        horario_legivel: horario_legivel,
                                    };
                                });
                                result = {
                                    ok: true,
                                    policy: "read-only",
                                    domain: "agenda",
                                    filters: __assign(__assign({}, args), { page: page, page_size: page_size, data_inicio: data_inicio, data_fim: data_fim }),
                                    total: items.length,
                                    rows_total: count !== null && count !== void 0 ? count : 0,
                                    items: items,
                                };
                                lastGetAgendamentosResult = result;
                                return [3 /*break*/, 46];
                            case 3:
                                if (!(name_1 === "create_agendamento")) return [3 /*break*/, 35];
                                clienteNomeRaw = String((args === null || args === void 0 ? void 0 : args.cliente_nome) || "").trim();
                                dataRaw = String((args === null || args === void 0 ? void 0 : args.data) || "").trim();
                                horaInicioRaw = String((args === null || args === void 0 ? void 0 : args.hora_inicio) || "").trim();
                                horaFimRaw = String((args === null || args === void 0 ? void 0 : args.hora_fim) || "").trim();
                                if (!(!clienteNomeRaw || !dataRaw || !horaInicioRaw || !horaFimRaw)) return [3 /*break*/, 4];
                                result = {
                                    ok: false,
                                    policy: "write-rejected",
                                    domain: "agenda",
                                    error: "cliente_nome, data, hora_inicio e hora_fim são obrigatórios para create_agendamento.",
                                };
                                return [3 /*break*/, 34];
                            case 4:
                                if (!!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dataRaw)) return [3 /*break*/, 5];
                                result = {
                                    ok: false,
                                    policy: "write-rejected",
                                    domain: "agenda",
                                    error: "Formato de data inválido. Use YYYY-MM-DD.",
                                };
                                return [3 /*break*/, 34];
                            case 5:
                                if (!(!/^[0-9]{2}:[0-9]{2}$/.test(horaInicioRaw) || !/^[0-9]{2}:[0-9]{2}$/.test(horaFimRaw))) return [3 /*break*/, 6];
                                result = {
                                    ok: false,
                                    policy: "write-rejected",
                                    domain: "agenda",
                                    error: "Formato de hora inválido. Use HH:mm.",
                                };
                                return [3 /*break*/, 34];
                            case 6:
                                clienteCodigoRaw = String((args === null || args === void 0 ? void 0 : args.cliente_codigo) || "").trim();
                                resolvedClienteId = null;
                                if (!clienteCodigoRaw) return [3 /*break*/, 8];
                                isNumericCodigo = /^\d+$/.test(clienteCodigoRaw);
                                cliQuery = sb
                                    .from("clientes")
                                    .select("id, codigo")
                                    .eq("codigo_empresa", empresaCodigo);
                                if (isNumericCodigo) {
                                    cliQuery = cliQuery.eq("codigo", clienteCodigoRaw);
                                }
                                else {
                                    // Se não for numérico (por exemplo, um UUID), interpretamos como id do cliente
                                    cliQuery = cliQuery.eq("id", clienteCodigoRaw);
                                }
                                return [4 /*yield*/, cliQuery.maybeSingle()];
                            case 7:
                                _2 = _20.sent(), cliRow = _2.data, cliErr = _2.error;
                                if (cliErr)
                                    throw cliErr;
                                if (!cliRow) {
                                    result = {
                                        ok: false,
                                        policy: "write-rejected",
                                        domain: "agenda",
                                        error: "Nenhum cliente encontrado com o código informado para esta empresa.",
                                    };
                                }
                                else {
                                    resolvedClienteId = String(cliRow.id);
                                }
                                _20.label = 8;
                            case 8:
                                if (!!(result && result.ok === false && result.policy === "write-rejected" && String(result.error || "").startsWith("Nenhum cliente encontrado"))) return [3 /*break*/, 34];
                                _3 = dataRaw.split("-").map(function (v) { return parseInt(v, 10); }), year = _3[0], month = _3[1], day = _3[2];
                                _4 = horaInicioRaw.split(":").map(function (v) { return parseInt(v, 10); }), h1 = _4[0], m1 = _4[1];
                                _5 = horaFimRaw.split(":").map(function (v) { return parseInt(v, 10); }), h2 = _5[0], m2 = _5[1];
                                offsetMinutes_4 = -3 * 60;
                                toUtcIsoFromLocal = function (y, mo, d, h, mi) {
                                    var localMs = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
                                    var utcMs = localMs - offsetMinutes_4 * 60000;
                                    return new Date(utcMs).toISOString();
                                };
                                inicioIso = toUtcIsoFromLocal(year, month, day, h1, m1);
                                endYear = year;
                                endMonth = month;
                                endDay = day;
                                if (h2 === 0 && m2 === 0) {
                                    tmp = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
                                    tmp.setUTCDate(tmp.getUTCDate() + 1);
                                    endYear = tmp.getUTCFullYear();
                                    endMonth = tmp.getUTCMonth() + 1;
                                    endDay = tmp.getUTCDate();
                                }
                                fimIso = toUtcIsoFromLocal(endYear, endMonth, endDay, h2, m2);
                                quadraId = (args === null || args === void 0 ? void 0 : args.quadra_id) ? String(args.quadra_id) : null;
                                clienteId = resolvedClienteId;
                                // Alguns modelos podem enviar o NOME da quadra em quadra_id (ex.: "Quadra lary") em vez do ID real.
                                // Como os IDs reais costumam ser UUIDs, se o valor não parecer um UUID, ignoramos e deixamos
                                // a lógica de quadra única da empresa assumir a quadra correta.
                                if (quadraId) {
                                    looksLikeUuid = /^[0-9a-fA-F-]{10,}$/;
                                    if (!looksLikeUuid.test(quadraId)) {
                                        quadraId = null;
                                    }
                                }
                                modalidadeRaw = (args === null || args === void 0 ? void 0 : args.modalidade) ? String(args.modalidade).trim() : "";
                                status_1 = (args === null || args === void 0 ? void 0 : args.status) ? String(args.status) : "scheduled";
                                quadraModalidades = null;
                                if (!!quadraId) return [3 /*break*/, 15];
                                _20.label = 9;
                            case 9:
                                _20.trys.push([9, 14, , 15]);
                                return [4 /*yield*/, sb
                                        .from("quadras")
                                        .select("id, modalidades")
                                        .eq("codigo_empresa", empresaCodigo)
                                        .eq("status", "Ativa")];
                            case 10:
                                _6 = _20.sent(), quadrasAtivas = _6.data, quadErr = _6.error;
                                quadrasCandidatas = null;
                                if (!(!quadErr && Array.isArray(quadrasAtivas) && quadrasAtivas.length === 1)) return [3 /*break*/, 11];
                                quadrasCandidatas = quadrasAtivas;
                                return [3 /*break*/, 13];
                            case 11: return [4 /*yield*/, sb
                                    .from("quadras")
                                    .select("id, modalidades")
                                    .eq("codigo_empresa", empresaCodigo)];
                            case 12:
                                _7 = _20.sent(), quadrasTodas = _7.data, quadAllErr = _7.error;
                                if (!quadAllErr && Array.isArray(quadrasTodas) && quadrasTodas.length === 1) {
                                    quadrasCandidatas = quadrasTodas;
                                }
                                _20.label = 13;
                            case 13:
                                if (quadrasCandidatas && quadrasCandidatas.length === 1) {
                                    unica = quadrasCandidatas[0];
                                    quadraId = String(unica.id);
                                    rawMods = unica.modalidades;
                                    if (Array.isArray(rawMods)) {
                                        quadraModalidades = rawMods.map(function (m) { return String(m || "").trim(); }).filter(Boolean);
                                    }
                                    else if (typeof rawMods === "string" && rawMods.trim()) {
                                        quadraModalidades = rawMods
                                            .split(",")
                                            .map(function (m) { return m.trim(); })
                                            .filter(Boolean);
                                    }
                                }
                                return [3 /*break*/, 15];
                            case 14:
                                e_2 = _20.sent();
                                console.log("[chat-proxy] erro ao buscar quadra única em create_agendamento", {
                                    message: e_2 === null || e_2 === void 0 ? void 0 : e_2.message,
                                });
                                return [3 /*break*/, 15];
                            case 15:
                                if (!(quadraId && (!quadraModalidades || quadraModalidades.length === 0))) return [3 /*break*/, 19];
                                _20.label = 16;
                            case 16:
                                _20.trys.push([16, 18, , 19]);
                                return [4 /*yield*/, sb
                                        .from("quadras")
                                        .select("id, modalidades")
                                        .eq("codigo_empresa", empresaCodigo)
                                        .eq("id", quadraId)
                                        .maybeSingle()];
                            case 17:
                                _8 = _20.sent(), qRow = _8.data, qErr = _8.error;
                                if (!qErr && qRow) {
                                    rawMods = qRow.modalidades;
                                    if (Array.isArray(rawMods)) {
                                        quadraModalidades = rawMods.map(function (m) { return String(m || "").trim(); }).filter(Boolean);
                                    }
                                    else if (typeof rawMods === "string" && rawMods.trim()) {
                                        quadraModalidades = rawMods
                                            .split(",")
                                            .map(function (m) { return m.trim(); })
                                            .filter(Boolean);
                                    }
                                }
                                return [3 /*break*/, 19];
                            case 18:
                                e_3 = _20.sent();
                                console.log("[chat-proxy] erro ao carregar modalidades da quadra em create_agendamento", {
                                    message: e_3 === null || e_3 === void 0 ? void 0 : e_3.message,
                                });
                                return [3 /*break*/, 19];
                            case 19:
                                if (quadraId && quadraModalidades && quadraModalidades.length > 0) {
                                    normalize_1 = function (s) { return s
                                        .normalize("NFD")
                                        .replace(/[\u0300-\u036f]/g, "")
                                        .toLowerCase()
                                        .trim(); };
                                    // Se a quadra tiver exatamente uma modalidade cadastrada, usamos SEMPRE essa modalidade,
                                    // independentemente do texto que veio da LLM, para evitar erros em arenas de modalidade única.
                                    if (quadraModalidades.length === 1) {
                                        modalidadeRaw = quadraModalidades[0];
                                    }
                                    else {
                                        modsNorm = quadraModalidades.map(function (m) { return ({
                                            original: m,
                                            norm: normalize_1(m),
                                        }); });
                                        requestedNorm_1 = modalidadeRaw ? normalize_1(modalidadeRaw) : "";
                                        match = requestedNorm_1
                                            ? modsNorm.find(function (m) { return m.norm === requestedNorm_1; })
                                            : null;
                                        if (!requestedNorm_1 || !match) {
                                            result = {
                                                ok: false,
                                                policy: "write-rejected",
                                                domain: "agenda",
                                                quadra_id: quadraId,
                                                requested_modalidade: modalidadeRaw || null,
                                                modalidades_disponiveis: quadraModalidades,
                                                error: "A modalidade informada não é válida para esta quadra. Escolha uma das modalidades disponíveis.",
                                            };
                                        }
                                        else {
                                            // Garante que vamos gravar usando exatamente o texto da modalidade cadastrada
                                            modalidadeRaw = match.original;
                                        }
                                    }
                                }
                                if (!quadraId) return [3 /*break*/, 23];
                                _20.label = 20;
                            case 20:
                                _20.trys.push([20, 22, , 23]);
                                dayStartIso = toUtcIsoFromLocal(year, month, day, 0, 0);
                                nextDayLocal = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
                                nextDayLocal.setUTCDate(nextDayLocal.getUTCDate() + 1);
                                nextDayYear = nextDayLocal.getUTCFullYear();
                                nextDayMonth = nextDayLocal.getUTCMonth() + 1;
                                nextDayDay = nextDayLocal.getUTCDate();
                                nextDayIso = toUtcIsoFromLocal(nextDayYear, nextDayMonth, nextDayDay, 0, 0);
                                return [4 /*yield*/, sb
                                        .from("agendamentos")
                                        .select("inicio, fim")
                                        .eq("codigo_empresa", empresaCodigo)
                                        .eq("quadra_id", quadraId)
                                        .gte("inicio", dayStartIso)
                                        .lt("inicio", nextDayIso)
                                        .order("inicio", { ascending: true })];
                            case 21:
                                _9 = _20.sent(), existingRows = _9.data, existingErr = _9.error;
                                if (!existingErr && Array.isArray(existingRows) && existingRows.length > 0) {
                                    normalizeIso_3 = function (iso) { return (iso.includes("T") ? iso : iso.replace(" ", "T")); };
                                    toLocalMinutes_1 = function (iso) {
                                        var dUtc = new Date(normalizeIso_3(iso));
                                        var localMs = dUtc.getTime() + offsetMinutes_4 * 60000;
                                        var local = new Date(localMs);
                                        return local.getUTCHours() * 60 + local.getUTCMinutes();
                                    };
                                    requestedStartMin_1 = h1 * 60 + m1;
                                    requestedEndMin_1 = (h2 === 0 && m2 === 0) ? 24 * 60 : (h2 * 60 + m2);
                                    bookingsLocal = existingRows.map(function (row) {
                                        var startMin = toLocalMinutes_1(String(row.inicio || ""));
                                        var endMin = toLocalMinutes_1(String(row.fim || ""));
                                        return {
                                            startMin: startMin,
                                            endMin: endMin <= startMin ? startMin : endMin,
                                        };
                                    }).filter(function (b) { return !isNaN(b.startMin) && !isNaN(b.endMin); });
                                    bookingsLocal.sort(function (a, b) { return a.startMin - b.startMin; });
                                    hasConflict = bookingsLocal.some(function (b) {
                                        var existingStart = b.startMin;
                                        var existingEnd = b.endMin;
                                        return !(existingEnd <= requestedStartMin_1 || existingStart >= requestedEndMin_1);
                                    });
                                    if (hasConflict) {
                                        DAY_MINUTES = 24 * 60;
                                        freeIntervals = [];
                                        lastEnd = 0;
                                        for (_10 = 0, bookingsLocal_1 = bookingsLocal; _10 < bookingsLocal_1.length; _10++) {
                                            b = bookingsLocal_1[_10];
                                            s = Math.max(0, b.startMin);
                                            e = Math.min(DAY_MINUTES, b.endMin);
                                            if (s > lastEnd) {
                                                freeIntervals.push({ startMin: lastEnd, endMin: s });
                                            }
                                            if (e > lastEnd)
                                                lastEnd = e;
                                        }
                                        if (lastEnd < DAY_MINUTES) {
                                            freeIntervals.push({ startMin: lastEnd, endMin: DAY_MINUTES });
                                        }
                                        pad_4 = function (n) { return String(n).padStart(2, "0"); };
                                        toHHMM_1 = function (mins) {
                                            var h = Math.floor(mins / 60);
                                            var m = mins % 60;
                                            return "".concat(pad_4(h), ":").concat(pad_4(m));
                                        };
                                        availableIntervals = freeIntervals
                                            .filter(function (it) { return it.endMin - it.startMin >= 30; }) // só intervalos de pelo menos 30 minutos
                                            .map(function (it) { return ({
                                            hora_inicio: toHHMM_1(it.startMin),
                                            hora_fim: toHHMM_1(it.endMin),
                                        }); });
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
                                return [3 /*break*/, 23];
                            case 22:
                                conflictErr_1 = _20.sent();
                                // Em caso de erro na checagem de conflito, não bloqueia a criação: apenas loga e segue
                                console.log("[chat-proxy] erro ao checar conflitos em create_agendamento", {
                                    message: conflictErr_1 === null || conflictErr_1 === void 0 ? void 0 : conflictErr_1.message,
                                });
                                return [3 /*break*/, 23];
                            case 23:
                                if (!(!result || result.ok !== false)) return [3 /*break*/, 34];
                                insertPayload = {
                                    codigo_empresa: empresaCodigo,
                                    inicio: inicioIso,
                                    fim: fimIso,
                                    status: status_1,
                                    modalidade: modalidadeRaw || null,
                                    clientes: [clienteNomeRaw],
                                };
                                if (quadraId)
                                    insertPayload.quadra_id = quadraId;
                                if (clienteId)
                                    insertPayload.cliente_id = clienteId;
                                return [4 /*yield*/, sb
                                        .from("agendamentos")
                                        .insert(insertPayload)
                                        .select("id, codigo, inicio, fim, status, modalidade, quadra_id")
                                        .maybeSingle()];
                            case 24:
                                _11 = _20.sent(), created = _11.data, createError = _11.error;
                                if (!(createError || !created)) return [3 /*break*/, 25];
                                result = {
                                    ok: false,
                                    policy: "write-error",
                                    domain: "agenda",
                                    error: "Erro ao criar agendamento: ".concat((createError === null || createError === void 0 ? void 0 : createError.message) || "desconhecido"),
                                };
                                return [3 /*break*/, 34];
                            case 25:
                                _20.trys.push([25, 32, , 33]);
                                participanteClienteId = clienteId;
                                if (!!participanteClienteId) return [3 /*break*/, 29];
                                _20.label = 26;
                            case 26:
                                _20.trys.push([26, 28, , 29]);
                                return [4 /*yield*/, sb
                                        .from("clientes")
                                        .select("id, is_consumidor_final")
                                        .eq("codigo_empresa", empresaCodigo)
                                        .eq("is_consumidor_final", true)
                                        .maybeSingle()];
                            case 27:
                                _12 = _20.sent(), consumidor = _12.data, consErr = _12.error;
                                if (!consErr && consumidor && consumidor.id) {
                                    participanteClienteId = String(consumidor.id);
                                }
                                return [3 /*break*/, 29];
                            case 28:
                                consErr_1 = _20.sent();
                                console.log("[chat-proxy] erro ao localizar cliente consumidor padrão em create_agendamento", {
                                    message: consErr_1 === null || consErr_1 === void 0 ? void 0 : consErr_1.message,
                                });
                                return [3 /*break*/, 29];
                            case 29:
                                if (!participanteClienteId) return [3 /*break*/, 31];
                                participanteNome = clienteNomeRaw;
                                participanteRow = {
                                    codigo_empresa: empresaCodigo,
                                    agendamento_id: created.id,
                                    cliente_id: participanteClienteId,
                                    nome: participanteNome,
                                    valor_cota: 0,
                                    status_pagamento: "Pendente",
                                    ordem: 1,
                                };
                                return [4 /*yield*/, sb
                                        .from("agendamento_participantes")
                                        .insert(participanteRow)];
                            case 30:
                                partError = (_20.sent()).error;
                                if (partError) {
                                    console.log("[chat-proxy] erro ao criar participante padrão em create_agendamento", {
                                        message: partError.message,
                                    });
                                }
                                _20.label = 31;
                            case 31: return [3 /*break*/, 33];
                            case 32:
                                partErr_1 = _20.sent();
                                console.log("[chat-proxy] erro inesperado ao inserir participante em create_agendamento", {
                                    message: partErr_1 === null || partErr_1 === void 0 ? void 0 : partErr_1.message,
                                });
                                return [3 /*break*/, 33];
                            case 33:
                                result = {
                                    ok: true,
                                    policy: "write-allowed (agendamentos:create)",
                                    domain: "agenda",
                                    created_id: created.id,
                                    created_snapshot: created,
                                };
                                _20.label = 34;
                            case 34: return [3 /*break*/, 46];
                            case 35:
                                if (!(name_1 === "update_agendamento")) return [3 /*break*/, 41];
                                agendamentoId = String((args === null || args === void 0 ? void 0 : args.agendamento_id) || "").trim();
                                campos = (args === null || args === void 0 ? void 0 : args.campos) && typeof args.campos === "object" ? args.campos : {};
                                if (!campos || typeof campos !== "object") {
                                    campos = {};
                                }
                                rootFieldCandidates = ["inicio", "fim", "status", "modalidade"];
                                for (_13 = 0, rootFieldCandidates_1 = rootFieldCandidates; _13 < rootFieldCandidates_1.length; _13++) {
                                    field = rootFieldCandidates_1[_13];
                                    if (Object.prototype.hasOwnProperty.call(args || {}, field) && campos[field] === undefined) {
                                        campos[field] = args[field];
                                    }
                                }
                                if (!!agendamentoId) return [3 /*break*/, 36];
                                result = {
                                    ok: false,
                                    policy: "write-rejected",
                                    domain: "agenda",
                                    error: "agendamento_id obrigatório para update_agendamento",
                                };
                                return [3 /*break*/, 40];
                            case 36:
                                allowedFields = ["inicio", "fim", "status", "modalidade"];
                                updatePayload = {};
                                for (_14 = 0, _15 = Object.entries(campos); _14 < _15.length; _14++) {
                                    _16 = _15[_14], key = _16[0], value = _16[1];
                                    if (allowedFields.includes(key)) {
                                        updatePayload[key] = value;
                                    }
                                }
                                appliedFields = Object.keys(updatePayload);
                                if (!(appliedFields.length === 0)) return [3 /*break*/, 37];
                                result = {
                                    ok: false,
                                    policy: "write-rejected",
                                    domain: "agenda",
                                    updated_id: agendamentoId,
                                    applied_fields: [],
                                    error: "Nenhum campo permitido foi informado em 'campos' para update_agendamento.",
                                };
                                return [3 /*break*/, 39];
                            case 37: return [4 /*yield*/, sb
                                    .from("agendamentos")
                                    .update(updatePayload)
                                    .eq("id", agendamentoId)
                                    .eq("codigo_empresa", empresaCodigo)
                                    .select("id, inicio, fim, status")
                                    .maybeSingle()];
                            case 38:
                                _17 = _20.sent(), updatedRows = _17.data, updateError = _17.error;
                                if (updateError) {
                                    result = {
                                        ok: false,
                                        policy: "write-error",
                                        domain: "agenda",
                                        updated_id: agendamentoId,
                                        applied_fields: appliedFields,
                                        error: "Erro ao atualizar agendamento: ".concat(updateError.message),
                                    };
                                }
                                else if (!updatedRows) {
                                    result = {
                                        ok: false,
                                        policy: "write-no-op",
                                        domain: "agenda",
                                        updated_id: agendamentoId,
                                        applied_fields: [],
                                        error: "Nenhum agendamento encontrado para atualizar (verifique empresa e ID).",
                                    };
                                }
                                else {
                                    result = {
                                        ok: true,
                                        policy: "write-allowed (agendamentos)",
                                        domain: "agenda",
                                        updated_id: agendamentoId,
                                        applied_fields: appliedFields,
                                        updated_snapshot: updatedRows,
                                    };
                                }
                                _20.label = 39;
                            case 39:
                                lastUpdateAgendamentoResult = result;
                                _20.label = 40;
                            case 40: return [3 /*break*/, 46];
                            case 41:
                                if (!(name_1 === "get_clientes")) return [3 /*break*/, 43];
                                searchTermRaw = String((args === null || args === void 0 ? void 0 : args.search_term) || "").trim();
                                limit = Math.min(Math.max(Number((args === null || args === void 0 ? void 0 : args.limit) || 20), 1), 50);
                                query = sb
                                    .from("clientes")
                                    .select("id, codigo, nome, email, telefone, status, flag_cliente, codigo_empresa", { count: "exact" })
                                    .eq("status", "active")
                                    .eq("flag_cliente", true)
                                    .eq("codigo_empresa", empresaCodigo)
                                    .order("nome", { ascending: true })
                                    .limit(limit);
                                s = searchTermRaw;
                                if (s) {
                                    isNumeric = /^\d+$/.test(s);
                                    if (isNumeric) {
                                        query = query.or("codigo.eq.".concat(s, ",nome.ilike.%").concat(s, "%,email.ilike.%").concat(s, "%,telefone.ilike.%").concat(s, "%"));
                                    }
                                    else {
                                        sNoH = s.replace(/h/gi, "");
                                        orParts = [];
                                        orParts.push("nome.ilike.%".concat(s, "%"), "email.ilike.%".concat(s, "%"), "telefone.ilike.%".concat(s, "%"));
                                        if (sNoH && sNoH !== s) {
                                            orParts.push("nome.ilike.%".concat(sNoH, "%"), "email.ilike.%".concat(sNoH, "%"), "telefone.ilike.%".concat(sNoH, "%"));
                                        }
                                        query = query.or(orParts.join(","));
                                    }
                                }
                                return [4 /*yield*/, query];
                            case 42:
                                _18 = _20.sent(), data = _18.data, error = _18.error, count = _18.count;
                                if (error)
                                    throw error;
                                items = (data || []).map(function (row) { return ({
                                    id: row.id,
                                    codigo: row.codigo,
                                    nome: row.nome,
                                    email: row.email,
                                    telefone: row.telefone,
                                    status: row.status,
                                }); });
                                result = {
                                    ok: true,
                                    policy: "read-only",
                                    domain: "clientes",
                                    filters: { search_term: searchTermRaw || null, limit: limit },
                                    total: items.length,
                                    rows_total: count !== null && count !== void 0 ? count : items.length,
                                    items: items,
                                };
                                return [3 /*break*/, 46];
                            case 43:
                                if (!(name_1 === "get_quadras")) return [3 /*break*/, 45];
                                apenasAtivas = Boolean(args === null || args === void 0 ? void 0 : args.apenas_ativas);
                                limit = Math.min(Math.max(Number((args === null || args === void 0 ? void 0 : args.limit) || 20), 1), 50);
                                query = sb
                                    .from("quadras")
                                    .select("id, nome, status, modalidades, codigo_empresa", { count: "exact" })
                                    .eq("codigo_empresa", empresaCodigo)
                                    .order("nome", { ascending: true })
                                    .limit(limit);
                                if (apenasAtivas) {
                                    query = query.eq("status", "Ativa");
                                }
                                return [4 /*yield*/, query];
                            case 44:
                                _19 = _20.sent(), data = _19.data, error = _19.error, count = _19.count;
                                if (error)
                                    throw error;
                                items = (data || []).map(function (row) {
                                    var rawMods = row.modalidades;
                                    var modalidades = [];
                                    if (Array.isArray(rawMods)) {
                                        modalidades = rawMods.map(function (m) { return String(m || "").trim(); }).filter(Boolean);
                                    }
                                    else if (typeof rawMods === "string" && rawMods.trim()) {
                                        modalidades = rawMods
                                            .split(",")
                                            .map(function (m) { return m.trim(); })
                                            .filter(Boolean);
                                    }
                                    return {
                                        id: row.id,
                                        nome: row.nome,
                                        status: row.status,
                                        modalidades: modalidades,
                                    };
                                });
                                result = {
                                    ok: true,
                                    policy: "read-only",
                                    domain: "quadras",
                                    filters: { apenas_ativas: apenasAtivas, limit: limit },
                                    total: items.length,
                                    rows_total: count !== null && count !== void 0 ? count : items.length,
                                    items: items,
                                };
                                return [3 /*break*/, 46];
                            case 45:
                                result = { ok: false, error: "Tool n\u00E3o suportada: ".concat(name_1) };
                                _20.label = 46;
                            case 46:
                                summary = {
                                    ok: result === null || result === void 0 ? void 0 : result.ok,
                                    policy: result === null || result === void 0 ? void 0 : result.policy,
                                    domain: result === null || result === void 0 ? void 0 : result.domain,
                                    total: result === null || result === void 0 ? void 0 : result.total,
                                    updated_id: result === null || result === void 0 ? void 0 : result.updated_id,
                                    applied_fields: result === null || result === void 0 ? void 0 : result.applied_fields,
                                    error: result === null || result === void 0 ? void 0 : result.error,
                                    conflict: result === null || result === void 0 ? void 0 : result.conflict,
                                    quadra_id: result === null || result === void 0 ? void 0 : result.quadra_id,
                                    requested_modalidade: result === null || result === void 0 ? void 0 : result.requested_modalidade,
                                    modalidades_disponiveis: result === null || result === void 0 ? void 0 : result.modalidades_disponiveis,
                                    created_id: result === null || result === void 0 ? void 0 : result.created_id,
                                };
                                console.log("[chat-proxy][".concat(reqId, "] tool_success"), { tool: name_1, args: args, summary: summary });
                                debugTools.push({ name: name_1, args: args, summary: summary });
                                return [3 /*break*/, 48];
                            case 47:
                                e_4 = _20.sent();
                                result = { ok: false, error: "Falha ao interpretar argumentos: ".concat(String(e_4)) };
                                errStr = String(e_4);
                                console.log("[chat-proxy][".concat(reqId, "] tool_error"), { tool: name_1, raw_args: argsRaw, error: errStr });
                                debugTools.push({ name: name_1, error: errStr });
                                return [3 /*break*/, 48];
                            case 48:
                                messages.push({ role: "tool", name: name_1, tool_call_id: tc.id, content: JSON.stringify(result) });
                                return [2 /*return*/];
                        }
                    });
                };
                _i = 0, toolCalls_1 = toolCalls;
                _z.label = 19;
            case 19:
                if (!(_i < toolCalls_1.length)) return [3 /*break*/, 22];
                tc = toolCalls_1[_i];
                return [5 /*yield**/, _loop_1(tc)];
            case 20:
                _z.sent();
                _z.label = 21;
            case 21:
                _i++;
                return [3 /*break*/, 19];
            case 22:
                // Se houve uma tentativa de update_agendamento que falhou (ok != true), não deixamos a IA
                // "inventar" que aplicou a alteração. Em vez disso, respondemos de forma determinística
                // informando que nada foi alterado e qual o motivo, marcando a estratégia como "reserve".
                if (lastUpdateAgendamentoResult && !lastUpdateAgendamentoResult.ok) {
                    r = lastUpdateAgendamentoResult;
                    campos = Array.isArray(r.applied_fields) ? r.applied_fields : [];
                    camposResumo = campos.length > 0 ? campos.join(", ") : "nenhum campo foi aplicado";
                    errMsg = String(r.error || "Não consegui concluir a alteração do agendamento.");
                    mdErro = "N\u00E3o consegui aplicar a altera\u00E7\u00E3o deste agendamento agora.\n\n- **ID:** ".concat(r.updated_id || "(desconhecido)", "\n- **Campos aplicados:** ").concat(camposResumo, "\n- **Motivo:** ").concat(errMsg, "\n\nNenhuma altera\u00E7\u00E3o foi gravada no sistema. Voc\u00EA pode tentar novamente informando claramente o novo hor\u00E1rio, status ou modalidade que deseja.");
                    durationErro = Date.now() - startedAt;
                    console.log("[chat-proxy][".concat(reqId, "] response"), {
                        source: "tools-direct",
                        duration_ms: durationErro,
                        reply_preview: mdErro.slice(0, 200),
                    });
                    return [2 /*return*/, new Response(JSON.stringify({ reply: mdErro, source: "tools-direct", debug: { tools: debugTools, strategy: "reserve" } }), {
                            status: 200,
                            headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(durationErro) }),
                        })];
                }
                return [4 /*yield*/, fetch("https://api.openai.com/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: "Bearer ".concat(apiKey),
                        },
                        body: JSON.stringify({
                            model: "gpt-4.1-mini",
                            temperature: 0.4,
                            messages: messages,
                        }),
                    })];
            case 23:
                secondResp = _z.sent();
                if (!secondResp.ok) {
                    durationSecond = Date.now() - startedAt;
                    console.log("[chat-proxy][".concat(reqId, "] openai_error(second) status=").concat(secondResp.status, " duration_ms=").concat(durationSecond));
                    return [2 /*return*/, new Response(JSON.stringify({ reply: "Não consegui concluir a operação agora.", source: "fallback", debug: { strategy: "reserve" } }), {
                            status: 200,
                            headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "fallback", "x-isis-duration-ms": String(durationSecond) }),
                        })];
                }
                return [4 /*yield*/, secondResp.json()];
            case 24:
                secondData = _z.sent();
                finalReply = (_v = (_u = (_t = (_s = secondData === null || secondData === void 0 ? void 0 : secondData.choices) === null || _s === void 0 ? void 0 : _s[0]) === null || _t === void 0 ? void 0 : _t.message) === null || _u === void 0 ? void 0 : _u.content) !== null && _v !== void 0 ? _v : "";
                preliminaryReply = "";
                try {
                    if (choice && typeof ((_w = choice === null || choice === void 0 ? void 0 : choice.message) === null || _w === void 0 ? void 0 : _w.content) === "string") {
                        preliminaryReply = choice.message.content.trim();
                    }
                }
                catch (_e) { }
                replies = [];
                if (preliminaryReply && preliminaryReply !== finalReply.trim()) {
                    replies.push(preliminaryReply);
                }
                if (typeof finalReply === "string" && finalReply.trim().length > 0) {
                    replies.push(finalReply);
                }
                hasWriteAllowed = debugTools.some(function (t) { var _a; return typeof ((_a = t === null || t === void 0 ? void 0 : t.summary) === null || _a === void 0 ? void 0 : _a.policy) === "string" && t.summary.policy.startsWith("write-allowed"); });
                onlyReadTools = debugTools.length > 0 && !hasWriteAllowed;
                if (userWantsChange && onlyReadTools && (!lastUpdateAgendamentoResult || !lastUpdateAgendamentoResult.ok)) {
                    durationGuard = Date.now() - startedAt;
                    if (lastGetAgendamentosResult && lastGetAgendamentosResult.ok && Array.isArray(lastGetAgendamentosResult.items) && lastGetAgendamentosResult.items.length > 0) {
                        items = lastGetAgendamentosResult.items;
                        md_4 = "";
                        if (items.length === 1) {
                            it = items[0];
                            cliente = it.representante_nome || "Cliente Consumidor";
                            quadra = it.quadra_nome || "Quadra";
                            dataLegivel = it.data_legivel || todayStr_1;
                            horarioLegivel = it.horario_legivel || "(horário não informado)";
                            md_4 += "Encontrei um agendamento que bate com o que voc\u00EA pediu:\n\n";
                            md_4 += "- **Cliente:** ".concat(cliente, "\n");
                            md_4 += "- **Quadra:** ".concat(quadra, "\n");
                            md_4 += "- **Data:** ".concat(dataLegivel, "\n");
                            md_4 += "- **Hor\u00E1rio:** ".concat(horarioLegivel, "\n\n");
                            md_4 += "Ainda **n\u00E3o cancelei nem alterei nada**. Se for esse o agendamento que voc\u00EA quer cancelar ou mudar, me confirme por favor (por exemplo: \\\"sim, pode cancelar\\\" ou \\\"sim, mude o hor\u00E1rio\\\").";
                        }
                        else {
                            md_4 += "Encontrei alguns agendamentos relacionados ao que voc\u00EA pediu:\n\n";
                            items.forEach(function (it, idx) {
                                var cliente = it.representante_nome || "Cliente Consumidor";
                                var quadra = it.quadra_nome || "Quadra";
                                var dataLegivel = it.data_legivel || todayStr_1;
                                var horarioLegivel = it.horario_legivel || "(horário não informado)";
                                md_4 += "".concat(idx + 1, ". ").concat(it.modalidade || "Agendamento", " \u2013 ").concat(quadra, "\n");
                                md_4 += "   - **Cliente:** ".concat(cliente, "\n");
                                md_4 += "   - **Data:** ".concat(dataLegivel, "\n");
                                md_4 += "   - **Hor\u00E1rio:** ".concat(horarioLegivel, "\n\n");
                            });
                            md_4 += "Ainda **n\u00E3o cancelei nem alterei nenhum agendamento**. Me diga **o n\u00FAmero ou o cliente/hor\u00E1rio** do agendamento que voc\u00EA quer cancelar ou mudar, que eu preparo a altera\u00E7\u00E3o e pe\u00E7o sua confirma\u00E7\u00E3o final antes de aplicar.";
                        }
                        console.log("[chat-proxy][".concat(reqId, "] response"), {
                            source: "tools-direct",
                            duration_ms: durationGuard,
                            reply_preview: md_4.slice(0, 200),
                        });
                        return [2 /*return*/, new Response(JSON.stringify({ reply: md_4, source: "tools-direct", debug: { tools: debugTools, strategy: "reserve" } }), {
                                status: 200,
                                headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "tools-direct", "x-isis-duration-ms": String(durationGuard) }),
                            })];
                    }
                }
                durationOpenaiTools = Date.now() - startedAt;
                console.log("[chat-proxy][".concat(reqId, "] response"), {
                    source: "openai+tools",
                    duration_ms: durationOpenaiTools,
                    reply_preview: finalReply.slice(0, 200),
                });
                return [2 /*return*/, new Response(JSON.stringify({ reply: finalReply, replies: replies, source: "openai+tools", debug: { tools: debugTools, strategy: "primary" } }), {
                        status: 200,
                        headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "openai+tools", "x-isis-duration-ms": String(durationOpenaiTools) }),
                    })];
            case 25:
                reply = (_y = (_x = choice === null || choice === void 0 ? void 0 : choice.message) === null || _x === void 0 ? void 0 : _x.content) !== null && _y !== void 0 ? _y : "";
                durationOpenai = Date.now() - startedAt;
                console.log("[chat-proxy][".concat(reqId, "] response"), {
                    source: "openai",
                    duration_ms: durationOpenai,
                    reply_preview: reply.slice(0, 200),
                });
                return [2 /*return*/, new Response(JSON.stringify({ reply: reply, replies: reply ? [reply] : [], source: "openai", debug: { tools: debugTools, strategy: "primary" } }), {
                        status: 200,
                        headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "openai", "x-isis-duration-ms": String(durationOpenai) }),
                    })];
            case 26:
                try { }
                catch (err) {
                    durationError = Date.now() - startedAt;
                    console.log("[chat-proxy][".concat(reqId, "] error=").concat(String(err), " duration_ms=").concat(durationError));
                    return [2 /*return*/, new Response(JSON.stringify({ reply: "Erro inesperado no servidor.", source: "fallback", debug: { strategy: "reserve" } }), {
                            status: 200,
                            headers: __assign(__assign({ "Content-Type": "application/json" }, corsHeaders), { "x-isis-source": "fallback", "x-isis-duration-ms": String(durationError) }),
                        })];
                }
                return [3 /*break*/, 28];
            case 27: return [7 /*endfinally*/];
            case 28:
                ;
                (0, server_ts_1.serve)(handler);
                return [2 /*return*/];
        }
    });
}); };
