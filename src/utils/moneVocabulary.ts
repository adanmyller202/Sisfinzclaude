/**
 * Vocabulário multilíngue e tolerante a erros da Mone.
 * Normaliza formas naturais de pedir ações financeiras sem alterar os dados originais.
 */
const ACTION_ALIASES: Array<[RegExp, string]> = [
  [/\\b(?:faz|faca|fazer|monta|montar|bota|botar|coloca|colocar|poe|por|mete|meter|cria|crie|criar|gera|gerar|registre|registrar|registra|adiciona|adicionar|adicione|cadastra|cadastrar|cadastre|inclui|incluir|anota|anotar|lanca|lancar|lance|abre|abrir|crea|crear|haceme|hace|hacer|agrega|agregar|carga|cargar|pone|poner)\\b/g, 'cria'],
  [/\\b(?:consulta|consultar|consulte|ver|ve|olha|olhar|mostra|mostrar|liste|listar|lista|me diz|diga|informa|informar|quanto tenho|quanto devo|mostrame|muestrame|decime|dime|revisa|revisar)\\b/g, 'consultar'],
  [/\\b(?:paguei|pagar|paga|pague|quite|quitar|quitada|quitado|marcar como paga|marcar paga|abona|abonar|pagame)\\b/g, 'pagar'],
  [/\b(?:recebi|receber|recebido|caiu|entrou|depositaram)\b/g, 'receber'],
  [/\b(?:apaga|apagar|exclui|excluir|deleta|deletar|remove|remover|cancela|cancelar)\b/g, 'excluir'],
  [/\b(?:muda|mudar|altera|alterar|edita|editar|corrige|corrigir|atualiza|atualizar)\b/g, 'editar'],
  [/\\b(?:transfere|transferir|transferencia|manda|mandar|move|mover|transfiere|transferi|pasame|pasar|envia|enviar)\\b/g, 'transferir'],
  [/\b(?:guarda|guardar|poupa|poupar|economiza|economizar|separa|separar|deposita|depositar|aporta|aportar)\b/g, 'guardar'],
  [/\\b(?:resgata|resgatar|retira|retirar|saca|sacar|tirar|extrae|extraer)\\b/g, 'resgatar'],
];

const COMMON_MISSPELLINGS: Record<string, string> = {
  fz: 'faz', fassa: 'faca', faser: 'fazer', faseria: 'faria', hacr: 'hacer', agerga: 'agrega', agrga: 'agrega',
  criea: 'cria', criaa: 'cria', crira: 'cria', crir: 'criar',
  adisiona: 'adiciona', adciona: 'adiciona', adisionar: 'adicionar',
  regitra: 'registra', registrra: 'registra', cadatra: 'cadastra',
  lancar: 'lancar', lanca: 'lanca', lanse: 'lance',
  fatura: 'fatura', fautra: 'fatura', fatrua: 'fatura', faturaa: 'fatura', factura: 'fatura', facturra: 'fatura', cuoota: 'cuota', cupta: 'cuota',
  conta: 'conta', contaa: 'conta', conat: 'conta',
  parcela: 'parcela', par cela: 'parcela', parselas: 'parcelas', cuota: 'parcela', cuotas: 'parcelas',
  parcellas: 'parcelas', parcelaas: 'parcelas', veses: 'vezes',
  ves: 'vezes', vezez: 'vezes', mes: 'mes', meiz: 'mes',
  vençimento: 'vencimento', vencimeto: 'vencimento', vencimient: 'vencimento',
  vencimeno: 'vencimento', vencimento: 'vencimento',
  abacatte: 'abacate', abacate: 'abacate',
  despesa: 'despesa', despeza: 'despesa', gastu: 'gasto',
  receita: 'receita', reseita: 'receita', ingreso: 'ingresso',
  saldo: 'saldo', salddo: 'saldo', dinhero: 'dinheiro',
  cartao: 'cartao', cartaoo: 'cartao', debito: 'debito', credito: 'credito',
  contaas: 'contas', faturas: 'faturas', parcelas: 'parcelas',
};

const FINANCE_TERMS = new Set([
  'cria','criar','crie','faz','faca','fazer','adiciona','adicionar','registra','registrar',
  'cadastra','cadastrar','inclui','incluir','anota','anotar','lanca','lancar','gera','gerar',
  'monta','montar','coloca','colocar','bota','botar','consulta','consultar','consulte','mostra',
  'mostrar','lista','listar','ver','olha','pagar','pague','paga','quitar','quite','receber',
  'recebi','excluir','apagar','deletar','remover','editar','alterar','atualizar','corrigir',
  'transferir','guardar','poupar','economizar','depositar','resgatar','retirar','sacar',
  'fatura','faturas','factura','facturas','conta','contas','boleto','boletos','parcela','parcelas','cuota','cuotas','vezes','compra',
  'compras','gasto','gastos','despesa','despesas','receita','receitas','ingresso','ingressos',
  'renda','salario','saldo','dinheiro','pagamento','pagamentos','vencimento','vencimentos',
  'vencida','vencidas','paga','pagas','pendente','pendentes','atrasada','atrasadas',
  'cofrinho','cofrinhos','meta','metas','objetivo','objetivos','economia','economias',
  'transferencia','transferencias','conta','banco','cartao','credito','debito','dinheiro',
  'calendario','planejamento','previsao','relatorio','categoria','categorias','mes','ano',
  'hoje','amanha','ontem','janeiro','fevereiro','marco','abril','maio','junho','julho',
  'agosto','setembro','outubro','novembro','dezembro','abacate','ventilador','sapato',
]);

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function editDistanceOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
}

function correctKnownTypos(text: string): string {
  return text.split(/(\b)/).map((token) => {
    if (!/^[a-z]{4,}$/i.test(token)) return token;
    const word = token.toLowerCase();
    if (COMMON_MISSPELLINGS[word]) return COMMON_MISSPELLINGS[word];
    if (FINANCE_TERMS.has(word)) return token;
    const candidates = [...FINANCE_TERMS].filter((candidate) => editDistanceOne(word, candidate));
    if (candidates.length === 1) return candidates[0];
    return token;
  }).join('');
}

export function normalizeMoneCommand(input: string): string {
  let text = fold(input);
  text = correctKnownTypos(text);
  for (const [pattern, replacement] of ACTION_ALIASES) text = text.replace(pattern, replacement);
  return text;
}

export const MONE_VOCABULARY_VERSION = '1.0.0';
