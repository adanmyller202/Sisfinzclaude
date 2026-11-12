/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase client configuration for secure server-side exact lookup
let firebaseConfig: any = {};
try {
  const rawConfig = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf-8');
  firebaseConfig = JSON.parse(rawConfig);
} catch (e) {
  console.warn('Could not load firebase-applet-config.json in server:', e);
}

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message, err.stack);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

app.use(express.json({ limit: '15mb' }));

// Rate limiting in-memory store for exact user lookup (sliding window)
// Max 15 searches per IP per 60 seconds to prevent enumeration/scraping attacks
const searchRateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 15;

  const timestamps = (searchRateLimitMap.get(ip) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    searchRateLimitMap.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  searchRateLimitMap.set(ip, timestamps);
  return true;
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Secure Exact-Email User Lookup with Abuse & Rate-Limiting Protection (Server Token Verified)
app.post('/api/search-user', async (req, res) => {
  try {
    const apiKey = firebaseConfig.apiKey;
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

    if (!projectId || !apiKey) {
      res.status(500).json({ error: 'Configuração do Firestore indisponível no servidor.' });
      return;
    }

    // 1. Enforce Firebase ID Token in Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autenticação não fornecido no header Authorization.' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1]?.trim();
    if (!idToken) {
      res.status(401).json({ error: 'Token de autenticação vazio.' });
      return;
    }

    // 2. Cryptographic token verification on Google Identity Toolkit
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
    const verifyResp = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!verifyResp.ok) {
      res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
      return;
    }

    const verifyData: any = await verifyResp.json();
    const verifiedUser = verifyData.users?.[0];
    if (!verifiedUser || !verifiedUser.localId) {
      res.status(401).json({ error: 'Falha ao identificar usuário autenticado a partir do token.' });
      return;
    }

    const verifiedUid = verifiedUser.localId;

    // 3. Dual Rate Limiting: IP-based AND Authenticated UID-based (15 requests/min)
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

    if (!checkRateLimit(`ip:${clientIp}`) || !checkRateLimit(`uid:${verifiedUid}`)) {
      res.status(429).json({
        error: 'Muitas tentativas de busca. Por segurança, aguarde um minuto antes de tentar novamente.',
      });
      return;
    }

    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'E-mail é obrigatório para busca.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.length < 3 || cleanEmail.length > 150 || !cleanEmail.includes('@')) {
      res.status(400).json({ error: 'Formato de e-mail inválido.' });
      return;
    }

    // Deterministic SHA-256 hash of email for exact document matching
    const emailHash = crypto.createHash('sha256').update(cleanEmail).digest('hex');

    // Headers for Firestore REST calls (pass user's ID token to satisfy rules)
    const firestoreHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    };

    console.log(`[SearchUser] Searching for ${cleanEmail} (hash: ${emailHash})`);

    // -------------------------------------------------------------
    // Tier 1: Exact REST document lookup on user_directory_lookup/${emailHash}
    // -------------------------------------------------------------
    try {
      const lookupUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/user_directory_lookup/${emailHash}?key=${apiKey}`;
      const lookupResp = await fetch(lookupUrl, { headers: firestoreHeaders });
      
      if (lookupResp.ok) {
        const docData: any = await lookupResp.json();
        const fields = docData.fields || {};
        if (fields.uid?.stringValue) {
          console.log(`[SearchUser] Tier 1 Success: found UID ${fields.uid.stringValue}`);
          res.json({
            found: true,
            user: {
              uid: fields.uid.stringValue,
              email: fields.email?.stringValue || cleanEmail,
              displayName: fields.displayName?.stringValue || cleanEmail.split('@')[0],
            },
          });
          return;
        }
      } else {
        console.log(`[SearchUser] Tier 1 Failed: Status ${lookupResp.status}`);
      }
    } catch (e) {
      console.warn('[SearchUser] Tier 1 error:', e);
    }

    const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery?key=${apiKey}`;

    // -------------------------------------------------------------
    // Tier 2: Query user_directory collection by email
    // -------------------------------------------------------------
    // NOTE: Requires 'allow list' permissions which may be blocked.
    try {
      const queryBodyUserDir = {
        structuredQuery: {
          from: [{ collectionId: 'user_directory' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'email' },
              op: 'EQUAL',
              value: { stringValue: cleanEmail },
            },
          },
          limit: 1,
        },
      };

      const qResp1 = await fetch(runQueryUrl, {
        method: 'POST',
        headers: firestoreHeaders,
        body: JSON.stringify(queryBodyUserDir),
      });

      if (qResp1.ok) {
        const qData1: any = await qResp1.json();
        const firstDoc1 = qData1?.[0]?.document;
        if (firstDoc1?.fields?.uid?.stringValue) {
          console.log(`[SearchUser] Tier 2 Success: found UID ${firstDoc1.fields.uid.stringValue}`);
          res.json({
            found: true,
            user: {
              uid: firstDoc1.fields.uid.stringValue,
              email: firstDoc1.fields.email?.stringValue || cleanEmail,
              displayName: firstDoc1.fields.displayName?.stringValue || cleanEmail.split('@')[0],
            },
          });
          return;
        }
      } else {
        console.log(`[SearchUser] Tier 2 Failed: Status ${qResp1.status}`);
      }
    } catch (e) {
      console.warn('[SearchUser] Tier 2 error:', e);
    }

    // -------------------------------------------------------------
    // Tier 3: Query users collection by email
    // -------------------------------------------------------------
    // NOTE: Usually blocked as it contains PII.
    try {
      const queryBodyUsers = {
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'email' },
              op: 'EQUAL',
              value: { stringValue: cleanEmail },
            },
          },
          limit: 1,
        },
      };

      const qResp2 = await fetch(runQueryUrl, {
        method: 'POST',
        headers: firestoreHeaders,
        body: JSON.stringify(queryBodyUsers),
      });

      if (qResp2.ok) {
        const qData2: any = await qResp2.json();
        const firstDoc2 = qData2?.[0]?.document;
        if (firstDoc2?.fields?.uid?.stringValue) {
          console.log(`[SearchUser] Tier 3 Success: found UID ${firstDoc2.fields.uid.stringValue}`);
          res.json({
            found: true,
            user: {
              uid: firstDoc2.fields.uid.stringValue,
              email: firstDoc2.fields.email?.stringValue || cleanEmail,
              displayName: firstDoc2.fields.displayName?.stringValue || cleanEmail.split('@')[0],
            },
          });
          return;
        }
      } else {
        console.log(`[SearchUser] Tier 3 Failed: Status ${qResp2.status}`);
      }
    } catch (e) {
      console.warn('[SearchUser] Tier 3 error:', e);
    }

    // -------------------------------------------------------------
    // Tier 4: Master Auth lookup via Google Identity Toolkit
    // -------------------------------------------------------------
    // NOTE: Only works if API Key has required permissions.
    try {
      const identityUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const identityResp = await fetch(identityUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: [cleanEmail] }),
      });

      if (identityResp.ok) {
        const identityData: any = await identityResp.json();
        const authUser = identityData.users?.[0];
        if (authUser && authUser.localId) {
          console.log(`[SearchUser] Tier 4 Success: found UID ${authUser.localId}`);
          res.json({
            found: true,
            user: {
              uid: authUser.localId,
              email: authUser.email || cleanEmail,
              displayName: authUser.displayName || cleanEmail.split('@')[0],
            },
          });
          return;
        }
      } else {
        console.log(`[SearchUser] Tier 4 Failed: Status ${identityResp.status}`);
      }
    } catch (e) {
      console.warn('[SearchUser] Tier 4 error:', e);
    }

    // User not found across all 4 tiers
    console.log(`[SearchUser] User ${cleanEmail} NOT found after all 4 tiers.`);
    res.json({ found: false, user: null });
  } catch (err: any) {
    console.error('Error in /api/search-user:', err);
    res.status(500).json({ error: 'Erro ao processar busca de usuário.' });
  }
});


// AI Chat Assistant endpoint for Mone (Server Token Verified)
app.post('/api/mone', async (req, res) => {
  try {
    const apiKeyConfig = firebaseConfig.apiKey;
    if (!apiKeyConfig) {
      res.status(500).json({ error: 'Configuração do Firebase indisponível no servidor.' });
      return;
    }

    // Enforce Firebase ID Token verification
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autenticação não fornecido no header Authorization.' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1]?.trim();
    if (!idToken) {
      res.status(401).json({ error: 'Token de autenticação vazio.' });
      return;
    }

    // Cryptographic token verification on Google Identity Toolkit
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKeyConfig}`;
    const verifyResp = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!verifyResp.ok) {
      res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
      return;
    }

    const verifyData: any = await verifyResp.json();
    const verifiedUser = verifyData.users?.[0];
    if (!verifiedUser || !verifiedUser.localId) {
      res.status(401).json({ error: 'Falha ao identificar usuário autenticado a partir do token.' });
      return;
    }

    const verifiedUid = verifiedUser.localId;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

    if (!checkRateLimit(`mone_ip:${clientIp}`) || !checkRateLimit(`mone_uid:${verifiedUid}`)) {
      res.status(429).json({ error: 'Limite de requisições do assistente excedido. Aguarde 60 segundos.' });
      return;
    }

    const { message, audio, audioMimeType, history = [], context = {}, persona: rawPersona } = req.body;

    if ((!message || typeof message !== 'string') && (!audio || typeof audio !== 'string')) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const validPersonas = ['direto', 'coach', 'vovo', 'sincerao'] as const;
    const persona = typeof rawPersona === 'string' && (validPersonas as readonly string[]).includes(rawPersona)
      ? rawPersona
      : 'direto';

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    const {
      currentBalance = 0,
      currency = 'BRL',
      language = 'pt',
      bills = [],
      incomes = [],
      expenses = [],
      goals = [],
      lastActionItem = null,
    } = context;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentMonthStr = todayStr.substring(0, 7);

    const billsSummary = bills.map((b: any) => ({
      id: b.id,
      name: b.name,
      amount: b.amount,
      dueDay: b.dueDay,
      dueDate: b.dueDate,
      category: b.category,
      recurrence: b.recurrence,
      recurrenceMonthsCount: b.recurrenceMonthsCount,
    }));

    const incomesSummary = incomes.map((i: any) => ({
      id: i.id,
      name: i.name,
      amount: i.amount,
      expectedDay: i.expectedDay,
      category: i.category,
    }));

    const recentExpensesSummary = (expenses || []).slice(-20).map((e: any) => ({
      id: e.id,
      name: e.name,
      amount: e.amount,
      date: e.date,
      category: e.category,
    }));

    const goalsSummary = (goals || []).map((g: any) => ({
      id: g.id,
      title: g.title,
      targetAmount: g.targetAmount,
    }));

    const conversationHistoryStr = (history || [])
      .slice(-8)
      .map((m: any) => `${m.sender === 'user' ? 'Usuário' : 'Mone'}: "${m.text}"`)
      .join('\n');

    const personaDescriptions: Record<string, string> = {
      coach: 'entusiasmado, motivador, focado em metas e evolução financeira, usa metáforas de treino/conquista com moderação',
      vovo: 'carinhoso, protetor, acolhedor, trata com afeto de avó/avô zeloso, dá pequenos conselhos gentis sobre guardar um dinheirinho',
      sincerao: 'bem-humorado, direto ao ponto, levemente irônico com gastos supérfluos, sem rodeios mas sempre respeitoso e construtivo',
    };

    const stylePrompt = persona !== 'direto' && personaDescriptions[persona]
      ? `\n\nESTILO DO MONE: ${personaDescriptions[persona]}. O estilo afeta SOMENTE o tom do directResponse. Nunca altere intent, data, números, datas ou valores: continuam exatos. Máximo 2 frases curtas. Responda no idioma preferido do usuário. Nunca zombe da aparência, origem, renda ou dívidas da pessoa. Se a mensagem indicar aflição financeira séria (dívida impagável, desespero, 'não aguento mais'), responda calmo e acolhedor mesmo no estilo sincero.`
      : '';

    const systemPrompt = `Você é o Mone, o cérebro financeiro do aplicativo Mone.
Sua missão é identificar a intenção do usuário em linguagem natural e retornar uma estrutura JSON precisa com a ação real a ser executada no banco de dados e uma resposta curta, natural e direta.

Contexto financeiro do usuário:
- Data atual: ${todayStr} (Mês: ${currentMonthStr})
- Moeda ativa: ${currency}
- Idioma preferido: ${language === 'pt' ? 'Português' : language === 'es' ? 'Español' : 'English'}
- Saldo atual em conta: ${currentBalance}
- Último item manipulado nesta conversa: ${lastActionItem ? JSON.stringify(lastActionItem) : 'Nenhum'}
- Contas cadastradas: ${JSON.stringify(billsSummary)}
- Receitas cadastradas: ${JSON.stringify(incomesSummary)}
- Despesas recentes: ${JSON.stringify(recentExpensesSummary)}
- Metas de economia: ${JSON.stringify(goalsSummary)}

Histórico recente da conversa:
${conversationHistoryStr || 'Nenhuma mensagem anterior.'}

REGRAS DE RESPOSTA E EXECUÇÃO (MUITO RIGOROSO):
1. Respostas ULTRA DIRETAS e CURTAS, focadas exclusivamente no que foi perguntado ou executado.
2. NUNCA diga saudações repetitivas como "Olá, sou Mone...", "Excelente notícia!", "É importante registrar..." nem dê conselhos morais se o usuário não pediu.
3. NUNCA mostre termos técnicos como "Cálculo Interno Direto", nomes de tabelas ou JSON na resposta de texto.
4. Se o usuário fizer uma pergunta matemática (ex: "quanto é 50.000 + 50.000?"), intent: "math", directResponse: "100.000."
5. SE O USUÁRIO PEDIR PARA MODIFICAR/EDITAR DADOS DE UMA CONTA OU REGISTRO EXISTENTE:
   - Alterar vencimento ou data de conta existente (ex: "mudar o vencimento da compra da sapatilha para o dia 20", "alterar vencimento da sapatilha para dia 20", "trocar data da conta de luz para o dia 10"):
     intent: "update_bill"
     name: "Compra da sapatilha" (ou o nome correspondente encontrado)
     matchedId: id da conta correspondente encontrada em Contas cadastradas
     dueDay: 20
     directResponse: "Vencimento de Compra da sapatilha alterado para o dia 20."
   - Alterar valor de conta existente (ex: "mudar valor da sapatilha para 150", "alterar conta de internet para 130"):
     intent: "update_bill"
     name: "Compra da sapatilha"
     matchedId: id da conta correspondente
     amount: 150
     directResponse: "Valor de Compra da sapatilha alterado para $ 150."
   - Alterar valor de despesa (ex: "mudar valor do uber para 35"):
     intent: "update_expense"
     name: "Uber"
     matchedId: id da despesa
     amount: 35
     directResponse: "Despesa de Uber alterada para $ 35."
   - Alterar receita ou salário (ex: "mudar meu salário para 55 mil"):
     intent: "update_income"
     name: "Salário"
     matchedId: id da receita
     amount: 55000
     directResponse: "Salário alterado para $ 55.000."
6. SE O USUÁRIO PEDIR PARA CRIAR REGISTROS:
   - Compra parcelada (ex: "comprei um tênis de 200 mil em 5 vezes", "compra de tênis de 200.000 em 5 parcelas vencendo dia 17"):
     intent: "add_installment_bill"
     name: "Compra de tênis"
     totalAmount: 200000
     installmentsCount: 5
     amount: 40000
     dueDay: 17
     directResponse: "Pronto. Compra de tênis criada em 5 parcelas de $ 40.000, todo dia 17."
   - Despesa avulsa (ex: "gastei 2500 pesos de uber agora", "adicione despesa de 4000 de uber hoje"):
     intent: "add_expense"
     name: "Uber"
     amount: 2500
     category: "Transporte"
     directResponse: "Despesa de Uber de $ 2.500 adicionada."
   - Receita (ex: "recebi 50 mil de salário", "adicione receita de 1500"):
     intent: "add_income"
     name: "Salário"
     amount: 50000
     isRecurring: true se salário
     directResponse: "Receita de Salário de $ 50.000 adicionada."
   - Conta regular (ex: "minha internet vence todo dia 10"):
     Se faltar o valor e não existir conta: intent: "ask_clarification", directResponse: "Qual é o valor da sua conta de internet?"
     Se tiver valor: intent: "add_bill", name: "Internet", amount: 120, dueDay: 10, directResponse: "Pronto. Conta Internet de $ 120 criada para todo dia 10."
7. OUTRAS AÇÕES:
   - Marcar como pago (ex: "paguei a academia", "marca a sapatilha como paga"):
     intent: "mark_bill_paid"
     name: nome da conta
     matchedBillId: id correspondente
     directResponse: "Pronto. Academia marcada como paga."
   - Corrigir item anterior (ex: "na verdade foi 3000, não 2500"):
     intent: "correct_last_item"
     newAmount: 3000
     directResponse: "Corrigido. Valor alterado para $ 3.000."
   - Excluir item (ex: "apaga a despesa de uber", "excluir conta da academia", "excluir compra da sapatilha"):
     intent: "delete_item"
     name: nome do item
     itemType: "bill" | "expense" | "income"
     matchedId: id do item correspondente
     directResponse: "Registro excluído."
   - Consultas (quanto gastei com transporte este mês?, quanto vou receber em novembro?, tenho algo para pagar em novembro?, qual meu saldo?):
     intent: "query_spending" | "query_incomes" | "query_bills" | "query_balance" | "query_forecast"
     targetMonth: "YYYY-MM"
     directResponse: resposta direta e exata.

REGRA ABSOLUTA:
NUNCA use 'general_query' quando o usuário pedir para criar, alterar data, alterar vencimento, alterar valor ou excluir um registro. Identifique a conta ou registro nas listas fornecidas e retorne a intenção de modificação correspondente.${stylePrompt}

FORMATO DE RESPOSTA (ESTRITAMENTE JSON):
{
  "intent": "add_expense" | "add_income" | "add_installment_bill" | "add_bill" | "update_bill" | "update_expense" | "update_income" | "mark_bill_paid" | "correct_last_item" | "delete_item" | "create_goal" | "query_spending" | "query_incomes" | "query_bills" | "query_balance" | "query_forecast" | "ask_clarification" | "general_query" | "math",
  "data": {
    "name": "string",
    "amount": number,
    "totalAmount": number,
    "installmentsCount": number,
    "dueDay": number,
    "expectedDay": number,
    "isRecurring": boolean,
    "targetMonth": "YYYY-MM",
    "category": "string",
    "matchedId": "string",
    "matchedBillId": "string",
    "itemType": "expense" | "bill" | "income",
    "newAmount": number,
    "newName": "string"
  },
  "directResponse": "string"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        {
          role: 'user',
          parts: audio
            ? [
                { inlineData: { mimeType: typeof audioMimeType === 'string' ? audioMimeType : 'audio/webm', data: audio } },
                { text: `${systemPrompt}\n\nInterprete o áudio anexado como a mensagem do usuário. Entenda português informal, valores falados, correções e intenção. Não invente informações que não foram ditas.` },
              ]
            : [{ text: `${systemPrompt}\n\nMensagem do usuário: "${message}"` }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 300,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const rawText = response.text?.trim() || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = {
        intent: 'general_query',
        directResponse: rawText,
      };
    }

    res.json(parsed);
  } catch (err: any) {
    console.error('Error in /api/mone:', err);
    res.status(500).json({
      error: 'Failed to process Mone request',
      details: err?.message || String(err),
    });
  }
});

// Short-lived token verification cache (5 minutes TTL) to avoid hitting Google Identity Toolkit on every request
const tokenCache = new Map<string, { uid: string; expiresAt: number }>();

function getCachedUid(token: string): string | null {
  const cached = tokenCache.get(token);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.uid;
  }
  if (cached) tokenCache.delete(token);
  return null;
}

function setCachedUid(token: string, uid: string) {
  tokenCache.set(token, { uid, expiresAt: Date.now() + 5 * 60 * 1000 });
}

// Helper to run a promise with a timeout in milliseconds
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage = 'Timeout excedido'): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Ultra-fast Voice Transaction Parsing Endpoint using Gemini Flash-Lite & Token Cache
app.post('/api/parse-lancamento', async (req, res) => {
  const startTime = Date.now();
  let tokenVerifyTime = 0;
  let aiTime = 0;

  try {
    const apiKey = firebaseConfig.apiKey;
    if (!apiKey) {
      const errPayload = {
        erro: 'Configuração do Firebase indisponível',
        detalhe: 'firebaseConfig.apiKey não foi encontrada no servidor.',
      };
      console.error('Error in /api/parse-lancamento:', errPayload);
      res.status(500).json(errPayload);
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const errPayload = {
        erro: 'Não autorizado',
        detalhe: 'Header Authorization com Bearer token do Firebase é obrigatório.',
      };
      console.error('Error in /api/parse-lancamento:', errPayload);
      res.status(401).json(errPayload);
      return;
    }

    const idToken = authHeader.split('Bearer ')[1]?.trim();
    if (!idToken) {
      const errPayload = {
        erro: 'Token de autenticação vazio',
        detalhe: 'O token fornecido no header Authorization está vazio.',
      };
      console.error('Error in /api/parse-lancamento:', errPayload);
      res.status(401).json(errPayload);
      return;
    }

    // 1. Fast Token Verification (using cache if available)
    const tokenStart = Date.now();
    let verifiedUid = getCachedUid(idToken);

    if (!verifiedUid) {
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      let verifyResp;
      try {
        verifyResp = await fetch(verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      } catch (fetchErr: any) {
        const errPayload = {
          erro: 'Erro de verificação de token',
          detalhe: fetchErr?.message || String(fetchErr),
        };
        console.error('Error verifying token in /api/parse-lancamento:', fetchErr);
        res.status(401).json(errPayload);
        return;
      }

      if (!verifyResp.ok) {
        const respText = await verifyResp.text();
        const errPayload = {
          erro: 'Token de autenticação inválido',
          detalhe: `Identity Toolkit retornou HTTP ${verifyResp.status}: ${respText.slice(0, 150)}`,
        };
        console.error('Firebase Auth verification failed in /api/parse-lancamento:', errPayload);
        res.status(401).json(errPayload);
        return;
      }

      const verifyData: any = await verifyResp.json();
      const verifiedUser = verifyData.users?.[0];
      if (!verifiedUser || !verifiedUser.localId) {
        const errPayload = {
          erro: 'Usuário não encontrado',
          detalhe: 'Não foi possível identificar a sessão do usuário no Firebase Auth.',
        };
        console.error('User lookup failed in /api/parse-lancamento:', errPayload);
        res.status(401).json(errPayload);
        return;
      }

      const uidString = verifiedUser.localId as string;
      verifiedUid = uidString;
      setCachedUid(idToken, uidString);
    }
    tokenVerifyTime = Date.now() - tokenStart;

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

    // Rate limiting: 30 requests/min per user / IP
    if (!checkRateLimit(`v_ip:${clientIp}`) || !checkRateLimit(`v_uid:${verifiedUid}`)) {
      const errPayload = {
        erro: 'Limite de solicitações excedido',
        detalhe: 'Você atingiu o limite de requisições de voz (HTTP 429). Por favor, aguarde 60 segundos.',
      };
      console.error('Rate limit reached in /api/parse-lancamento:', errPayload);
      res.status(429).json(errPayload);
      return;
    }

    const { texto, audio, mimeType, dataAtual, categorias = [], contas = [], userPreferences = {} } = req.body;

    if ((!texto || typeof texto !== 'string' || !texto.trim()) && (!audio || typeof audio !== 'string' || !audio.trim())) {
      const errPayload = {
        erro: 'Entrada não fornecida',
        detalhe: 'Forneça um texto transcrito ou um áudio em base64.',
      };
      console.error('Missing input in /api/parse-lancamento:', errPayload);
      res.status(400).json(errPayload);
      return;
    }

    const geminiKey = process.env.GEMINI_API_KEY || '';
    if (!geminiKey) {
      const errPayload = {
        erro: 'Chave do Gemini ausente',
        detalhe: 'GEMINI_API_KEY não configurada no servidor (process.env.GEMINI_API_KEY ausente).',
      };
      console.error('Missing GEMINI_API_KEY in /api/parse-lancamento:', errPayload);
      res.status(503).json(errPayload);
      return;
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const refDate = dataAtual || new Date().toISOString().split('T')[0];

    // Ultra-concise direct prompt with strict numeric rules for pt-BR / es-AR
    const systemPrompt = `Você é o parser financeiro de alta velocidade do SisFinz.
Extraia lançamentos financeiros do comando do usuário (seja texto ou áudio em pt-BR).
Hoje: ${refDate}
Categorias: ${JSON.stringify(categorias)}
Contas: ${JSON.stringify(contas)}
Preferências do usuário: ${JSON.stringify(userPreferences)}

REGRAS RÁPIDAS DE VALORES MONETÁRIOS (CRÍTICO):
1. O ponto com exatamente 3 dígitos depois é separador de milhar: "20.000" = 20000 (vinte mil, NUNCA vinte); "1.234.567" = 1234567.
2. A vírgula ou ponto com 1 ou 2 dígitos é decimal: "20,50" ou "20.50" = 20.5; "20,5" = 20.5.
3. Expressões textuais e gírias: "20 mil" = 20000; "1,5 mil" = 1500; "2 milhões" = 2000000; "50 conto/pila/pau" = 50; "1k" = 1000.
4. O campo "valor" DEVE ser um número (number) puro maior que 0, NUNCA texto ou string.
5. Na descrição, REMOVA totalmente a quantia monetária e a unidade de moeda (ex: em "gastei 20.000 pesos no bolso", o valor é 20000 e a descrição é "Bolso", sem resíduos como ".pesos").
6. Se for enviado um áudio, transcreva a fala exata e inclua a transcrição em "textoTranscrito".
7. Retorne obrigatoriamente um objeto JSON com array "lancamentos".`;

    const generateConfig = {
      systemInstruction: systemPrompt,
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          textoTranscrito: { type: Type.STRING },
          lancamentos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tipo: { type: Type.STRING, enum: ['despesa', 'receita', 'fatura'] },
                descricao: { type: Type.STRING },
                valor: { type: Type.NUMBER },
                categoria: { type: Type.STRING },
                contaId: { type: Type.STRING, nullable: true },
                data: { type: Type.STRING },
                parcelas: { type: Type.NUMBER },
                recorrencia: { type: Type.STRING, enum: ['none', 'monthly'] },
                confianca: { type: Type.NUMBER },
              },
              required: ['tipo', 'descricao', 'valor', 'categoria', 'data', 'confianca'],
            },
          },
        },
        required: ['lancamentos'],
      },
    };

    const parts: any[] = [];
    if (audio) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'audio/webm',
          data: audio,
        },
      });
      parts.push({
        text: 'Analise este áudio gravado em pt-BR. Transcreva o que foi falado e extraia os lançamentos financeiros.',
      });
    } else {
      parts.push({
        text: `Comando: "${texto}"`,
      });
    }

    const aiStart = Date.now();
    let response: any = null;
    let lastError: any = null;

    // Fast model candidates with strict 8s timeout on attempt 1, and 5s timeout on retry
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
    for (let attempt = 0; attempt < 2 && !response; attempt++) {
      const modelName = modelsToTry[attempt] || 'gemini-3.1-flash-lite';
      const timeoutMs = attempt === 0 ? 8000 : 5000;
      try {
        response = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts }],
            config: generateConfig,
          }),
          timeoutMs,
          `Gemini API (${modelName}) timeout de ${timeoutMs}ms excedido`
        );
      } catch (err: any) {
        console.warn(`[Parse-Lançamento] Tentativa ${attempt + 1} (${modelName}) falhou:`, err?.message || String(err));
        lastError = err;
      }
    }

    aiTime = Date.now() - aiStart;
    const totalTime = Date.now() - startTime;

    // Output performance metrics to server log
    console.log(
      `[Parse-Lançamento] InputType: ${audio ? 'AUDIO' : 'TEXT'} | Token verify: ${tokenVerifyTime}ms | Gemini AI: ${aiTime}ms | Total: ${totalTime}ms`
    );

    if (!response) {
      const isQuota =
        lastError?.status === 'RESOURCE_EXHAUSTED' ||
        lastError?.message?.includes('RESOURCE_EXHAUSTED') ||
        lastError?.message?.includes('429');

      const errPayload = {
        erro: isQuota ? 'Cota de IA excedida' : 'Timeout ou falha na IA',
        detalhe: lastError?.message || 'A resposta da IA levou mais de 8 segundos.',
      };
      res.status(isQuota ? 429 : 504).json(errPayload);
      return;
    }

    const responseText = response.text?.trim() || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch (jsonErr: any) {
      const errPayload = {
        erro: 'Erro ao interpretar resposta da IA',
        detalhe: `Resposta não é JSON válido: ${responseText.slice(0, 150)}`,
      };
      console.error('JSON Parse error in /api/parse-lancamento:', jsonErr, responseText);
      res.status(500).json(errPayload);
      return;
    }

    // Post-process and sanitize items to guarantee valid numbers and clean descriptions
    if (parsed.lancamentos && Array.isArray(parsed.lancamentos)) {
      parsed.lancamentos = parsed.lancamentos.map((item: any) => {
        // Sanitize numeric value using server-side rules if needed
        let val = Number(item.valor);
        if (isNaN(val) || !isFinite(val) || val <= 0) {
          val = 0;
        }

        // Clean up description residue if any
        let desc = String(item.descricao || '')
          .replace(/^[.,\s]+|[.,\s]+$/g, '')
          .replace(/^\.?(?:pesos|peso|reais|real)\b/gi, '')
          .trim();

        if (!desc) desc = 'Lançamento por voz';

        return {
          ...item,
          valor: val,
          descricao: desc,
        };
      });
    }

    res.json(parsed);
  } catch (err: any) {
    const totalTime = Date.now() - startTime;
    console.error(`Fatal catch in /api/parse-lancamento (Total: ${totalTime}ms):`, err?.message || String(err));
    res.status(500).json({
      erro: 'Erro interno no servidor',
      detalhe: err?.message || String(err),
    });
  }
});

// Ping route
app.get('/api/ping', (_req, res) => res.json({ ok: true }));

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
