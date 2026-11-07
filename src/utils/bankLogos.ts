export const BANKS = [
  { name: 'Banco Nación', aliases: ['bna', 'nacion'], domain: 'bna.com.ar' },
  { name: 'Galicia', aliases: ['banco galicia', 'galicia'], domain: 'bancogalicia.com.ar' },
  { name: 'Santander', aliases: ['santander rio', 'santander'], domain: 'santander.com.ar' },
  { name: 'BBVA', aliases: ['bbva francès', 'francès'], domain: 'bbva.com.ar' },
  { name: 'Macro', aliases: ['banco macro'], domain: 'macro.com.ar' },
  { name: 'Banco Provincia', aliases: ['bapro', 'provincia'], domain: 'bancoprovincia.com.ar' },
  { name: 'Banco Ciudad', aliases: ['ciudad'], domain: 'bancociudad.com.ar' },
  { name: 'ICBC', aliases: ['icbc'], domain: 'icbc.com.ar' },
  { name: 'HSBC', aliases: ['hsbc'], domain: 'hsbc.com.ar' },
  { name: 'Credicoop', aliases: ['credicoop'], domain: 'bancocredicoop.coop' },
  { name: 'Patagonia', aliases: ['banco patagonia', 'patagonia'], domain: 'bancopatagonia.com.ar' },
  { name: 'Supervielle', aliases: ['supervielle'], domain: 'supervielle.com.ar' },
  { name: 'Hipotecario', aliases: ['hipotecario'], domain: 'hipotecario.com.ar' },
  { name: 'Itaú', aliases: ['itau'], domain: 'itau.com.ar' },
  { name: 'Brubank', aliases: ['brubank'], domain: 'brubank.com' },
  { name: 'Naranja X', aliases: ['naranja x', 'naranja'], domain: 'naranjax.com' },
  { name: 'Mercado Pago', aliases: ['mp', 'mercado pago'], domain: 'mercadopago.com.ar' },
  { name: 'Ualá', aliases: ['uala'], domain: 'uala.com.ar' },
  { name: 'Personal Pay', aliases: ['personal pay'], domain: 'personalpay.com.ar' },
  { name: 'Lemon', aliases: ['lemon'], domain: 'lemon.me' },
  { name: 'Belo', aliases: ['belo'], domain: 'belo.app' },
  { name: 'Prex', aliases: ['prex'], domain: 'prexcard.com.ar' },
  { name: 'Nubank', aliases: ['nu', 'nubank'], domain: 'nubank.com.br' },
  { name: 'Bradesco', aliases: ['bradesco'], domain: 'bradesco.com.br' },
  { name: 'Caixa', aliases: ['caixa'], domain: 'caixa.gov.br' },
];

export const getBankDomain = (accountName: string): string | null => {
  const normalizedName = accountName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const bank = BANKS.find(b =>
    normalizedName.includes(b.name.toLowerCase()) ||
    b.aliases.some(alias => normalizedName.includes(alias.toLowerCase()))
  );
  return bank ? bank.domain : null;
};

export const getBankLogoUrl = (accountName: string): string | null => {
  const domain = getBankDomain(accountName);
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
};
