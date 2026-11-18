/**
 * Vocabulário multilíngue e tolerante a erros da Mone.
 * Normaliza formas naturais de pedir ações financeiras sem alterar os dados originais.
 */
const ACTION_ALIASES: Array<[RegExp, string]> = [
  [/\b(?:faz|faca|fazer|monta|montar|bota|botar|coloca|colocar|poe|mete|meter|cria|crie|criar|gera|gerar|registre|registrar|registra|adiciona|adicionar|adicione|cadastra|cadastrar|cadastre|inclui|incluir|anota|anotar|lanca|lancar|lance|crea|crear|haceme|hace|hacer|agrega|agregar|carga|cargar|pone|poner)\b/g, 'cria'],
  [/\b(?:consulta|consultar|consulte|ver|ve|olha|olhar|mostra|mostrar|liste|listar|lista|me diz|diga|informa|informar|quanto tenho|quanto devo|mostrame|muestrame|decime|dime|revisa|revisar)\b/g, 'consultar'],
  [/\b(?:paguei|pagar|paga|pague|quite|quitar|quitada|quitado|marcar como paga|marcar paga|abona|abonar|pagame)\b/g, 'pagar'],
  [/\b(?:recebi|receber|recebido|caiu|entrou|depositaram)\b/g, 'receber'],
  [/\b(?:apaga|apagar|exclui|excluir|deleta|deletar|remove|remover|cancela|cancelar)\b/g, 'excluir'],
  [/\b(?:muda|mudar|altera|alterar|edita|editar|corrige|corrigir|atualiza|atualizar)\b/g, 'editar'],
  [/\b(?:transfere|transferir|transferencia|manda|mandar|move|mover|transfiere|transferi|pasame|pasar|envia|enviar)\b/g, 'transferir'],
  [/\b(?:guarda|guardar|poupa|poupar|economiza|economizar|separa|separar|deposita|depositar|aporta|aportar)\b/g, 'guardar'],
  [/\b(?:resgata|resgatar|retira|retirar|saca|sacar|tirar|extrae|extraer)\b/g, 'resgatar'],
];

const COMMON_MISSPELLINGS: Record<string, string> = {
  fz: 'faz', fassa: 'faca', faser: 'fazer', faseria: 'faria', hacr: 'hacer', agerga: 'agrega', agrga: 'agrega',
  criea: 'cria', criaa: 'cria', crira: 'cria', crir: 'criar',
  adisiona: 'adiciona', adciona: 'adiciona', adisionar: 'adicionar',
  regitra: 'registra', registrra: 'registra', cadatra: 'cadastra',
  lancar: 'lancar', lanca: 'lanca', lanse: 'lance',
  fatura: 'fatura', fautra: 'fatura', fatrua: 'fatura', faturaa: 'fatura', factura: 'fatura', facturra: 'fatura', cuoota: 'cuota', cupta: 'cuota',
  conta: 'conta', contaa: 'conta', conat: 'conta',
  parcela: 'parcela', parselas: 'parcelas', cuota: 'parcela', cuotas: 'parcelas',
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
  // Common language words are protected from typo correction.
  'para','com','sem','por','de','do','da','dos','das','em','no','na','nos','nas','que','foi','uma','uns','umas',
  'meu','minha','meus','minhas','seu','sua','seus','suas','voce','quero','queria','preciso','pode','poder',
  'primeira','primeiro','segunda','segundo','terceira','terceiro','dia','ano','todo','toda','todos','todas',
  'antes','depois','tambem','agora','hoje','amanha','ontem','qual','quando','quanto','qualquer','tanto','faz',
  'fizer','faco','faria','sobra','sobrar','sobram','sobraria','sobrariam','resta','restar','restam','restaria','restariam',
  'fica','ficar','ficaria','ficariam','terei','tera','caso','compre','comprasse','gaste','gastasse','pagasse',
  'mesmo','mesma','valor','esse','essa','isso','realizasse','realizar',
  'mil','milhao','milhoes','reais','real','pesos','peso','argentinos','argentino','dolares','dolar','usd','ars','brl',
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

  // Common mobile typo: "de eu gastar/comprar/fizer/pagar" -> "se eu gastar/comprar/fizer/pagar"
  text = text.replace(/\bde\s+eu\s+(?=(?:fizer|faco|faca|faria|comprar|comprasse|gastar|gastasse|pagar|pagasse|realizasse|realizar)\b)/gi, 'se eu ');

  // When an explicit month name follows "proximo mes" / "mes que vem" (e.g. "no próximo mês de janeiro"),
  // strip the relative prefix so extractTargetMonth resolves the explicit month ("janeiro") instead of +1 month.
  text = text.replace(
    /\b(?:no\s+|do\s+|para\s+o\s+|em\s+)?(?:proximo\s+mes|mes\s+que\s+vem|mes\s+passado|mes\s+anterior)\s+(?:de\s+|em\s+)?(?=(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|enero|febrero|marzo|mayo|junio|julio|septiembre|setiembre|octubre|noviembre|diciembre)\b)/gi,
    'em '
  );

  // Hypothetical questions must NOT be caught by rigid regexes in moneEngine.ts — let them reach the AI (/api/mone)
  // so Gemini can reason with full context, history, and 12-month projections.
  const isHypotheticalOrSimulation =
    /\b(?:se\s+(?:eu\s+)?(?:fizer|faco|faca|faria|comprar|comprasse|gastar|gastasse|pagar|pagasse|realizasse|realizar)|caso\s+(?:eu\s+)?(?:compre|comprar|gaste|pague|faca)|e\s+se\s+(?:eu\s+)?(?:fizer|faco|faca|faria|comprar|comprasse|gastar|gastasse|pagar|pagasse|realizasse|realizar)|(?:quando|se)\s+eu\s+(?:comprar|gastar|pagar))\b/i.test(text);

  if (isHypotheticalOrSimulation) {
    // Prefix with a marker token so moneEngine's rigid regexes (asksHypotheticalPurchase / asksForecast)
    // do not short-circuit the question before it reaches /api/mone!
    return `__ai_reason__ ${text.replace(/\b(?:se|caso)\b/gi, 'hipotese_condicional').replace(/\b(?:sobra\w*|resta\w*|previsao|projecao)\b/gi, 'resultado_simulado')}`;
  }

  for (const [pattern, replacement] of ACTION_ALIASES) {
    text = text.replace(pattern, replacement);
  }

  return text;
}

export const MONE_VOCABULARY_VERSION = '2.0.0';
