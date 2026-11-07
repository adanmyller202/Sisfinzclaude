/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ParsedLancamentoItem {
  id: string;
  tipo: 'despesa' | 'receita' | 'fatura';
  descricao: string;
  valor: number;
  categoria: string;
  contaId?: string | null;
  data: string; // YYYY-MM-DD
  parcelas?: number;
  recorrencia?: 'none' | 'monthly';
  confianca: number;
  duvidas?: string[];
}
