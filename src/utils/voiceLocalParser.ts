/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedLancamentoItem } from '../types/voice';
import { extractValueAndCleanDescription } from './moneyParser';

/**
 * Fast client-side rule-based parser for common financial voice and text inputs.
 * Interprets simple phrases instantly (< 10ms) without calling external AI APIs.
 */

function resolveRelativeDate(text: string): string {
  const today = new Date();
  const lower = text.toLowerCase();

  if (lower.includes('ontem')) {
    today.setDate(today.getDate() - 1);
  } else if (lower.includes('amanhã') || lower.includes('amanha')) {
    today.setDate(today.getDate() + 1);
  } else {
    // Check "dia X"
    const diaMatch = lower.match(/\bdia\s+(\d{1,2})\b/i);
    if (diaMatch) {
      const dayNum = parseInt(diaMatch[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        today.setDate(dayNum);
      }
    }
  }

  return today.toISOString().split('T')[0];
}

function matchCategory(description: string, categories: string[], userPreferences: Record<string, string> = {}): string {
  const descLower = description.toLowerCase().trim();

  // 1. Check user preferences
  for (const [kw, cat] of Object.entries(userPreferences)) {
    if (descLower.includes(kw.toLowerCase())) {
      return cat;
    }
  }

  // 2. Built-in keywords mapping
  const keywordCategories: Array<[RegExp, string]> = [
    [/\b(almoço|almoco|jantar|lanche|restaurante|padaria|ifood|uber\s*eats|comida|mcdonalds|pizzaria)\b/i, 'Alimentação'],
    [/\b(mercado|supermercado|feira|açougue|acougue|hortifruti|carrefour|extra)\b/i, 'Supermercado'],
    [/\b(uber|99|taxi|táxi|combustível|gasolina|etanol|estacionamento|pedágio|pedagio|ônibus|onibus|metrô|metro)\b/i, 'Transporte'],
    [/\b(luz|água|agua|internet|aluguel|condomínio|condominio|gás|gas|iptu)\b/i, 'Moradia'],
    [/\b(remédio|remedio|farmácia|farmacia|médico|medico|dentista|exame|consulta)\b/i, 'Saúde'],
    [/\b(salário|salario|pagamento|pix\s*recebido|freela|venda|comissão|comissao|rendimento)\b/i, 'Salário'],
  ];

  for (const [regex, categoryName] of keywordCategories) {
    if (regex.test(descLower)) {
      // Return user's actual category if case matches, else standard categoryName
      const foundInUserCat = categories.find((c) => c.toLowerCase() === categoryName.toLowerCase());
      return foundInUserCat || categoryName;
    }
  }

  return categories[0] || 'Outros';
}

export function parseLancamentoLocally(
  text: string,
  categories: string[],
  userPreferences: Record<string, string> = {}
): ParsedLancamentoItem[] | null {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  if (!clean || clean.length < 5) return null;

  const lower = clean.toLowerCase();

  // 1. Determine type
  let tipo: 'despesa' | 'receita' | 'fatura' = 'despesa';
  if (/\b(recebi|ganhei|pix\s*de|salário|salario|freela|venda|receita|pingou)\b/i.test(lower)) {
    tipo = 'receita';
  } else if (/\b(fatura|conta\s*de|vencimento|aluguel|luz|água|agua|internet)\b/i.test(lower)) {
    tipo = 'fatura';
  }

  // 2. Extract monetary value and clean description using parseMoneyBR
  const { valor, descricao: extractedDesc } = extractValueAndCleanDescription(clean);
  if (!valor || valor <= 0) return null;

  let descricao = extractedDesc;
  if (!descricao) {
    descricao = tipo === 'receita' ? 'Receita por voz' : 'Despesa por voz';
  }

  // 3. Resolve category
  const categoria = matchCategory(descricao, categories, userPreferences);

  // 4. Resolve relative date
  const data = resolveRelativeDate(clean);

  return [
    {
      id: `local_${Date.now()}`,
      tipo,
      descricao,
      valor,
      categoria,
      data,
      confianca: 0.9,
    },
  ];
}
