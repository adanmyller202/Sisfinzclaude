import express from 'express';
import { GoogleGenAI } from '@google/genai';

export interface ScannedReceiptResult {
  type: 'expense' | 'bill';
  amount: number;
  name: string;
  category: string;
  date: string;
}

function getTodayYYYYMMDD(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseAmountValue(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw * 100) / 100;
  }
  if (typeof raw !== 'string') return 0;
  let s = raw.replace(/[^\d.,-]/g, '').trim();
  if (!s) return 0;

  // Handle "12.450,50" (AR/BR format) vs "12,450.50" (US format)
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      s = s.replace(/\./g, '');
    }
  }

  const num = Number(s);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : 0;
}

function normalizeDateYYYYMMDD(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${dmy[2]}-${dmy[1]}`;
  }
  return fallback;
}

export function mountReceiptScanRoutes(app: express.Express) {
  app.post('/api/receipts/scan', async (req, res) => {
    try {
      const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
      }

      const imageDataUrl = String(req.body?.imageDataUrl || '').trim();
      const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ error: 'Imagem inválida para leitura do ticket.' });
      }

      const safeMimeType = match[1];
      const cleanBase64 = match[2];
      if (cleanBase64.length > 10 * 1024 * 1024) {
        return res.status(413).json({ error: 'Imagem muito grande. Tente aproximar do valor total.' });
      }

      const rawCategories = Array.isArray(req.body?.categories) ? req.body.categories : [];
      const categories: string[] = rawCategories
        .map((c: unknown) => String(c || '').trim())
        .filter(Boolean)
        .slice(0, 40);

      const language = req.body?.language === 'es' ? 'es' : 'pt';
      const todayStr =
        typeof req.body?.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.today)
          ? req.body.today
          : getTodayYYYYMMDD();

      const categoryPromptLine =
        categories.length > 0
          ? `Escolha a melhor categoria EXATAMENTE desta lista: [${categories.join(', ')}].`
          : `Sugira uma categoria curta (ex: Alimentação, Supermercado, Farmácia, Serviços, Transporte, Outros).`;

      const prompt =
        language === 'es'
          ? `Lee rápido este ticket, recibo o factura y devuelve SOLO un JSON válido:
{"type":"expense","amount":12450.5,"name":"Supermercado Coto","category":"Alimentación","date":"${todayStr}"}
Reglas:
- "amount": número decimal positivo con el TOTAL pagado o a pagar. Ignora subtotales, vuelto o ítems sueltos.
- "type": usa "bill" si es una factura de servicio con vencimiento (luz, agua, gas, internet, alquiler, tarjeta); si es compra común (supermercado, tienda, farmacia, restaurante), usa "expense".
- "name": descripción corta y automática del comercio o tipo de gasto (máx 40 caracteres, ej: "Supermercado Coto", "Farmacia", "Factura de Luz").
- "category": ${categoryPromptLine}
- "date": fecha del ticket o vencimiento en formato YYYY-MM-DD. Si no se lee, usa "${todayStr}".`
          : `Leia rapidamente este ticket, cupom fiscal ou fatura e retorne APENAS um JSON válido:
{"type":"expense","amount":12450.5,"name":"Supermercado Coto","category":"Alimentação","date":"${todayStr}"}
Regras:
- "amount": número decimal positivo com o VALOR TOTAL gasto ou a pagar. Ignore subtotais, troco/vuelto ou itens individuais.
- "type": use "bill" se for conta/fatura com vencimento (luz, água, gás, internet, aluguel, boleto, cartão); se for compra comum (supermercado, loja, farmácia, padaria, restaurante), use "expense".
- "name": descrição curta e automática do local ou tipo de gasto (máx 40 caracteres, ex: "Supermercado Coto", "Farmácia", "Conta de Luz").
- "category": ${categoryPromptLine}
- "date": data do ticket ou vencimento no formato YYYY-MM-DD. Se não estiver legível, use "${todayStr}".`;

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-flash-latest'];
      let rawText = '';
      let lastErr: any = null;

      for (const modelName of modelsToTry) {
        try {
          const generatePromise = ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { data: cleanBase64, mimeType: safeMimeType } },
                  { text: prompt },
                ],
              },
            ],
            config: {
              responseMimeType: 'application/json',
              temperature: 0,
              maxOutputTokens: 220,
              thinkingConfig: { thinkingBudget: 0 },
            },
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout no modelo ${modelName}`)), 12000)
          );

          const response = await Promise.race([generatePromise, timeoutPromise]);
          rawText = response.text || '';
          if (rawText.trim()) break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!rawText.trim()) {
        throw lastErr || new Error('Não foi possível ler o ticket.');
      }

      const cleanedJson = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
      const parsed = JSON.parse(cleanedJson);

      const amount = parseAmountValue(parsed?.amount);
      const type: 'expense' | 'bill' = parsed?.type === 'bill' ? 'bill' : 'expense';
      const rawName = String(parsed?.name || '').trim().slice(0, 48);
      const name =
        rawName ||
        (type === 'bill'
          ? language === 'es'
            ? 'Factura escaneada'
            : 'Fatura escaneada'
          : language === 'es'
          ? 'Compra escaneada'
          : 'Compra escaneada');

      const rawCategory = String(parsed?.category || '').trim();
      let category = rawCategory || 'Outros';
      if (categories.length > 0) {
        const exact = categories.find((c) => c.toLowerCase() === rawCategory.toLowerCase());
        const partial =
          exact ||
          categories.find(
            (c) =>
              rawCategory &&
              (c.toLowerCase().includes(rawCategory.toLowerCase()) ||
                rawCategory.toLowerCase().includes(c.toLowerCase()))
          );
        category = partial || categories[0];
      }

      const date = normalizeDateYYYYMMDD(parsed?.date, todayStr);

      const result: ScannedReceiptResult = {
        type,
        amount,
        name,
        category,
        date,
      };

      return res.json(result);
    } catch (err: any) {
      console.error('[ReceiptScan] Failed to parse ticket:', err);
      return res.status(500).json({
        error: err?.message || 'Não foi possível ler o ticket. Tente tirar outra foto focando no total.',
      });
    }
  });
}
