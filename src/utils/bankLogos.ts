export const BANKS = [
  { name: "Itaú Unibanco", aliases: ["itau","itaú"], domain: "itau.com.br", country: "BR" },
  { name: "Banco do Brasil", aliases: ["bb","banco brasil"], domain: "bb.com.br", country: "BR" },
  { name: "Caixa Econômica Federal", aliases: ["caixa","cef"], domain: "caixa.gov.br", country: "BR" },
  { name: "Bradesco", aliases: ["bradesco"], domain: "bradesco.com.br", country: "BR" },
  { name: "Santander Brasil", aliases: ["santander brasil","santander"], domain: "santander.com.br", country: "BR" },
  { name: "Nubank", aliases: ["nu","nubank"], domain: "nubank.com.br", country: "BR" },
  { name: "Banco Inter", aliases: ["inter","banco inter"], domain: "inter.co", country: "BR" },
  { name: "C6 Bank", aliases: ["c6","c6 bank"], domain: "c6bank.com.br", country: "BR" },
  { name: "BTG Pactual", aliases: ["btg"], domain: "btgpactual.com", country: "BR" },
  { name: "Banco Safra", aliases: ["safra"], domain: "safra.com.br", country: "BR" },
  { name: "Banco BV", aliases: ["bv","banco bv"], domain: "bv.com.br", country: "BR" },
  { name: "Sicredi", aliases: ["sicredi"], domain: "sicredi.com.br", country: "BR" },
  { name: "Sicoob", aliases: ["sicoob"], domain: "sicoob.com.br", country: "BR" },
  { name: "Banrisul", aliases: ["banrisul"], domain: "banrisul.com.br", country: "BR" },
  { name: "PicPay", aliases: ["picpay"], domain: "picpay.com", country: "BR" },
  { name: "Mercado Pago Brasil", aliases: ["mercado pago","mp"], domain: "mercadopago.com.br", country: "BR" },
  { name: "PagBank", aliases: ["pagbank","pagseguro"], domain: "pagbank.com.br", country: "BR" },
  { name: "Neon", aliases: ["neon"], domain: "neon.com.br", country: "BR" },
  { name: "Banco PAN", aliases: ["pan","banco pan"], domain: "bancopan.com.br", country: "BR" },
  { name: "Banco Original", aliases: ["original"], domain: "original.com.br", country: "BR" },
  { name: "Banco de la Nación Argentina", aliases: ["nacion","bna","banco nación"], domain: "bna.com.ar", country: "AR" },
  { name: "Banco Galicia", aliases: ["galicia"], domain: "galicia.ar", country: "AR" },
  { name: "Banco Santander Argentina", aliases: ["santander rio","santander argentina"], domain: "santander.com.ar", country: "AR" },
  { name: "BBVA Argentina", aliases: ["bbva","frances"], domain: "bbva.com.ar", country: "AR" },
  { name: "Banco Macro", aliases: ["macro"], domain: "macro.com.ar", country: "AR" },
  { name: "Banco Provincia", aliases: ["bapro","provincia"], domain: "bancoprovincia.com.ar", country: "AR" },
  { name: "Banco Ciudad", aliases: ["ciudad"], domain: "bancociudad.com.ar", country: "AR" },
  { name: "ICBC Argentina", aliases: ["icbc"], domain: "icbc.com.ar", country: "AR" },
  { name: "Banco Supervielle", aliases: ["supervielle"], domain: "supervielle.com.ar", country: "AR" },
  { name: "Banco Patagonia", aliases: ["patagonia"], domain: "bancopatagonia.com.ar", country: "AR" },
  { name: "Banco Credicoop", aliases: ["credicoop"], domain: "bancocredicoop.coop", country: "AR" },
  { name: "Banco Hipotecario", aliases: ["hipotecario"], domain: "hipotecario.com.ar", country: "AR" },
  { name: "Banco Comafi", aliases: ["comafi"], domain: "comafi.com.ar", country: "AR" },
  { name: "Bancor", aliases: ["bancor","cordoba"], domain: "bancor.com.ar", country: "AR" },
  { name: "Banco de Santa Fe", aliases: ["santa fe","santafe"], domain: "bancosantafe.com.ar", country: "AR" },
  { name: "Brubank", aliases: ["brubank"], domain: "brubank.com", country: "AR" },
  { name: "Ualá", aliases: ["uala","ualá"], domain: "uala.com.ar", country: "AR" },
  { name: "Naranja X", aliases: ["naranja x","naranja"], domain: "naranjax.com", country: "AR" },
  { name: "Mercado Pago Argentina", aliases: ["mercado pago","mp"], domain: "mercadopago.com.ar", country: "AR" },
  { name: "Personal Pay", aliases: ["personal pay"], domain: "personalpay.com.ar", country: "AR" },
];

export const getBankDomain = (accountName: string): string | null => {
  const normalizedName = accountName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const bank = BANKS.find(b =>
    normalizedName.includes(b.name.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')) ||
    b.aliases.some(alias => normalizedName.includes(alias.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')))
  );
  return bank ? bank.domain : null;
};

export const getBankLogoUrl = (accountName: string): string | null => {
  const domain = getBankDomain(accountName);
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
};
