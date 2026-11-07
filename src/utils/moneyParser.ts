/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Universal money parser for pt-BR / es-AR format.
 * Rules:
 * - "20.000" = 20000 (dot with exactly 3 digits after is thousand separator)
 * - "1.234.567" = 1234567
 * - "1.234,56" = 1234.56
 * - "20,50" = 20.5; "20,5" = 20.5
 * - "20.50" = 20.5; "20.5" = 20.5 (dot with 1 or 2 digits after is decimal)
 * - Textual expressions: "20 mil" = 20000, "1,5 mil" = 1500, "2 milhões" = 2000000, "2,5k" = 2500
 * - Words: "vinte mil" = 20000, "cem reais" = 100, "mil e quinhentos" = 1500, "quinhentos" = 500
 * - Handles currency symbols & units: "R$", "$", "€", "pesos", "reais", "pila", "conto", "pau"
 */

const PT_WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezesdeis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  trezentos: 300,
  quatrocentos: 400,
  quinhentos: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
};

const MULTIPLIERS: Record<string, number> = {
  k: 1000,
  mil: 1000,
  milhão: 1000000,
  milhao: 1000000,
  milhões: 1000000,
  milhoes: 1000000,
  mi: 1000000,
  bilhão: 1000000000,
  bilhao: 1000000000,
  bilhões: 1000000000,
  bilhoes: 1000000000,
  bi: 1000000000,
};

/**
 * Parses a pure numeric string formatted with pt-BR / es-AR separators into a number
 */
export function parseRawNumericStr(raw: string): number | null {
  if (!raw) return null;

  // Clean whitespace and non-numeric symbols except digits, dots, commas
  let clean = raw.trim().replace(/[^\d.,]/g, '');
  if (!clean) return null;

  const lastDot = clean.lastIndexOf('.');
  const lastComma = clean.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      // e.g. "1.234,56" or "20.000,00"
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // e.g. "1,234.56"
      clean = clean.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Only comma present, e.g. "20,50" -> "20.50"
    clean = clean.replace(',', '.');
  } else if (lastDot !== -1) {
    // Only dot present: e.g. "20.000" vs "20.50" vs "1.234.567"
    const parts = clean.split('.');
    const lastPart = parts[parts.length - 1];

    if (parts.length > 2) {
      // Multiple dots e.g. "1.234.567" -> all dots are thousand separators
      clean = clean.replace(/\./g, '');
    } else if (lastPart.length === 3) {
      // Exactly 3 digits after single dot e.g. "20.000" or "5.000" -> thousand separator
      clean = clean.replace(/\./g, '');
    } else {
      // 1 or 2 digits after dot e.g. "20.50", "20.5" -> decimal separator
      // Keep dot as is
    }
  }

  const num = Number(clean);
  if (isNaN(num) || !isFinite(num)) return null;
  return num;
}

/**
 * Main function: converts monetary expressions (text or numbers) to float number.
 * Never calls parseFloat directly on raw user strings.
 */
export function parseMoneyBR(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    return isFinite(input) && input > 0 ? input : null;
  }

  const rawStr = String(input).trim();
  if (!rawStr) return null;

  // 1. Check for combined number + multiplier word (e.g. "20 mil", "1,5 mil", "2 milhões", "2,5k")
  const numMultiplierMatch = rawStr.match(
    /^[\sR$€$]*([\d.,]+)\s*(k|mil|milhão|milhao|milhões|milhoes|mi|bilhão|bilhao|bilhões|bilhoes|bi)\b/i
  );
  if (numMultiplierMatch) {
    const baseNum = parseRawNumericStr(numMultiplierMatch[1]);
    const multKey = numMultiplierMatch[2].toLowerCase();
    const multiplier = MULTIPLIERS[multKey] || 1;
    if (baseNum !== null) {
      return baseNum * multiplier;
    }
  }

  // 2. Check for numeric pattern in string (e.g. "20.000", "1.234,56", "20,50", "20.50", "500")
  const numericMatch = rawStr.match(/[\d]+(?:[.,][\d]+)*/);
  if (numericMatch) {
    // Check if there is a multiplier after the matched number
    const matchIndex = rawStr.indexOf(numericMatch[0]);
    const rest = rawStr.slice(matchIndex + numericMatch[0].length).trim().toLowerCase();
    const multWordMatch = rest.match(/^(k|mil|milhão|milhao|milhões|milhoes|mi|bilhão|bilhao|bilhões|bilhoes|bi)\b/i);

    const baseNum = parseRawNumericStr(numericMatch[0]);
    if (baseNum !== null) {
      if (multWordMatch) {
        const multKey = multWordMatch[1].toLowerCase();
        const multiplier = MULTIPLIERS[multKey] || 1;
        return baseNum * multiplier;
      }
      return baseNum;
    }
  }

  // 3. Check for textual word numbers in Portuguese (e.g. "vinte mil", "cem reais", "mil e quinhentos")
  const words = rawStr
    .toLowerCase()
    .replace(/[^\wáàâãéèêíóòôõúç\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let totalSum = 0;
  let currentGroup = 0;
  let foundWordNumber = false;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === 'e' || w === 'de' || w === 'reais' || w === 'real' || w === 'pesos' || w === 'peso' || w === 'pila' || w === 'conto' || w === 'pau' || w === 'r$') {
      continue;
    }

    if (MULTIPLIERS[w]) {
      foundWordNumber = true;
      const mult = MULTIPLIERS[w];
      const factor = currentGroup === 0 ? 1 : currentGroup;
      totalSum += factor * mult;
      currentGroup = 0;
    } else if (PT_WORD_NUMBERS[w] !== undefined) {
      foundWordNumber = true;
      currentGroup += PT_WORD_NUMBERS[w];
    }
  }

  totalSum += currentGroup;

  if (foundWordNumber && totalSum > 0) {
    return totalSum;
  }

  return null;
}

/**
 * Formats a number to Brazilian currency format string: e.g. 20000 -> "20.000,00"
 */
export function formatNumberBR(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

/**
 * Extracts value and cleans monetary phrases from text to avoid trailing residues like ".pesos"
 */
export function extractValueAndCleanDescription(text: string): { valor: number | null; descricao: string } {
  if (!text) return { valor: null, descricao: '' };

  const valor = parseMoneyBR(text);

  let cleanDesc = text
    // Action verbs
    .replace(/\b(gastei|paguei|comprei|recebi|ganhei|fiz\s*um|coloque|adicione|lançar|lancar)\b/gi, '')
    // Full numeric patterns with optional dots/commas and currency/multiplier words
    .replace(/(?:R\$|\$|€)?\s*\d+(?:[.,]\d+)*(?:\s*(?:k|mil|milhão|milhao|milhões|milhoes|mi|bilhão|bilhao|bilhões|bilhoes|bi|reais|real|pesos|peso|dólares|dolares|dólar|dolar|euros|euro|pila|conto|pau))?/gi, '')
    // Portuguese word numbers with currency
    .replace(/\b(vinte|trinta|quarenta|cinquenta|cem|cento|duzentos|quinhentos|mil)\s*(?:mil|milhões|milhoes)?\s*(?:reais|real|pesos|peso|pila|conto|pau)?\b/gi, '')
    // Relative dates
    .replace(/\b(hoje|ontem|amanhã|amanha)\b/gi, '')
    // Connectives
    .replace(/\b(no|na|de|do|da|com|em|para)\b/gi, '')
    // Remove isolated dots, commas, symbols leftover
    .replace(/^[.,\s]+|[.,\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize
  if (cleanDesc) {
    cleanDesc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);
  }

  return { valor, descricao: cleanDesc };
}
