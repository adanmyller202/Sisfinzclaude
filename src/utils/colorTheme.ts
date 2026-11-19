export type ColorThemeId =
  | 'factory'
  | 'menta_botanica'
  | 'salvia_calma'
  | 'azul_sereno'
  | 'ceu_nordico'
  | 'lavanda_suave'
  | 'rosa_quartzo'
  | 'pessego_creme'
  | 'mel_manteiga'
  | 'areia_minimal'
  | 'nuvem_grafite';

export interface ColorThemeDefinition {
  id: ColorThemeId;
  name: string;
  nameEs: string;
  nameEn: string;
  subtitle: string;
  subtitleEs: string;
  subtitleEn: string;
  preview: {
    bg: string;
    soft: string;
    accent: string;
    accentDark: string;
  };
  surfaceBg: string;
  softBg: string;
  glassBg: string;
  accentRgb: string;
  accentLightRgb: string;
  scale: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  };
}

export const FACTORY_THEME: ColorThemeDefinition = {
  id: 'factory',
  name: 'Verde Esmeralda',
  nameEs: 'Verde Esmeralda',
  nameEn: 'Emerald Green',
  subtitle: 'Padrão original de fábrica',
  subtitleEs: 'Estándar original de fábrica',
  subtitleEn: 'Original factory default',
  preview: {
    bg: '#F4F8F6',
    soft: '#D1FAEB',
    accent: '#059669',
    accentDark: '#065F46',
  },
  surfaceBg: '#F4F8F6',
  softBg: '#ECFDF5',
  glassBg: 'rgba(209, 250, 235, 0.65)',
  accentRgb: '16, 185, 129',
  accentLightRgb: '52, 211, 153',
  scale: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
  },
};

export const PASTEL_COLOR_THEMES: ColorThemeDefinition[] = [
  {
    id: 'menta_botanica',
    name: 'Menta Botânica',
    nameEs: 'Menta Botánica',
    nameEn: 'Botanical Mint',
    subtitle: 'Verde-água suave e fresco',
    subtitleEs: 'Verde agua suave y fresco',
    subtitleEn: 'Soft fresh seafoam',
    preview: { bg: '#F2FAF8', soft: '#D5F3EC', accent: '#2A9D8F', accentDark: '#1E756A' },
    surfaceBg: '#F2FAF8',
    softBg: '#E6F7F3',
    glassBg: 'rgba(213, 243, 236, 0.68)',
    accentRgb: '42, 157, 143',
    accentLightRgb: '116, 206, 194',
    scale: {
      50: '#eefaf7',
      100: '#d5f3ec',
      200: '#ade6da',
      300: '#7cd4c3',
      400: '#4ebba7',
      500: '#2fa694',
      600: '#248c7d',
      700: '#1e7166',
      800: '#1b5a52',
      900: '#184a44',
      950: '#0a2d29',
    },
  },
  {
    id: 'salvia_calma',
    name: 'Sálvia Calma',
    nameEs: 'Salvia Calma',
    nameEn: 'Calm Sage',
    subtitle: 'Verde oliva pastel minimalista',
    subtitleEs: 'Verde oliva pastel minimalista',
    subtitleEn: 'Minimalist pastel sage',
    preview: { bg: '#F5F7F3', soft: '#E2EAD9', accent: '#5D7D5B', accentDark: '#445D42' },
    surfaceBg: '#F5F7F3',
    softBg: '#EEF2E9',
    glassBg: 'rgba(226, 234, 217, 0.7)',
    accentRgb: '93, 125, 91',
    accentLightRgb: '150, 181, 147',
    scale: {
      50: '#f4f7f2',
      100: '#e2ead9',
      200: '#c7d6b9',
      300: '#a4bc92',
      400: '#809e6d',
      500: '#658454',
      600: '#516c43',
      700: '#415737',
      800: '#36472f',
      900: '#2d3b27',
      950: '#172014',
    },
  },
  {
    id: 'azul_sereno',
    name: 'Azul Sereno',
    nameEs: 'Azul Sereno',
    nameEn: 'Serene Sky',
    subtitle: 'Azul bebê com destaque suave',
    subtitleEs: 'Azul cielo suave y limpio',
    subtitleEn: 'Soft baby blue clarity',
    preview: { bg: '#F2F8FC', soft: '#D8EEFA', accent: '#2D84B5', accentDark: '#1F638B' },
    surfaceBg: '#F2F8FC',
    softBg: '#E8F4FC',
    glassBg: 'rgba(216, 238, 250, 0.7)',
    accentRgb: '45, 132, 181',
    accentLightRgb: '125, 196, 235',
    scale: {
      50: '#f0f8fd',
      100: '#d8eefa',
      200: '#b7dff6',
      300: '#85c8ee',
      400: '#50ace2',
      500: '#2d8fd0',
      600: '#2175b0',
      700: '#1c5e8f',
      800: '#1b4f76',
      900: '#1b4262',
      950: '#112a41',
    },
  },
  {
    id: 'ceu_nordico',
    name: 'Céu Nórdico',
    nameEs: 'Cielo Nórdico',
    nameEn: 'Nordic Sky',
    subtitle: 'Azul gelo e índigo fosco',
    subtitleEs: 'Azul hielo e índigo suave',
    subtitleEn: 'Ice blue & soft indigo',
    preview: { bg: '#F4F6FC', soft: '#DFE6FA', accent: '#4F63B5', accentDark: '#3A4A8F' },
    surfaceBg: '#F4F6FC',
    softBg: '#ECEFF9',
    glassBg: 'rgba(223, 230, 250, 0.72)',
    accentRgb: '79, 99, 181',
    accentLightRgb: '147, 164, 230',
    scale: {
      50: '#f3f5fc',
      100: '#dfe6fa',
      200: '#c5d1f5',
      300: '#9fb2ed',
      400: '#768de2',
      500: '#586ed4',
      600: '#4759bd',
      700: '#3b489d',
      800: '#333e80',
      900: '#2d3768',
      950: '#1c2141',
    },
  },
  {
    id: 'lavanda_suave',
    name: 'Lavanda Suave',
    nameEs: 'Lavanda Suave',
    nameEn: 'Soft Lavender',
    subtitle: 'Lilás pastel elegante',
    subtitleEs: 'Lila pastel elegante',
    subtitleEn: 'Refined pastel lilac',
    preview: { bg: '#F7F4FC', soft: '#EAE0FA', accent: '#7E57C2', accentDark: '#5E3B9E' },
    surfaceBg: '#F7F4FC',
    softBg: '#F2ECFA',
    glassBg: 'rgba(234, 224, 250, 0.72)',
    accentRgb: '126, 87, 194',
    accentLightRgb: '185, 155, 235',
    scale: {
      50: '#f6f3fc',
      100: '#eae0fa',
      200: '#d7c5f5',
      300: '#bc9ded',
      400: '#9d74e0',
      500: '#8354cf',
      600: '#7142b8',
      700: '#5f349c',
      800: '#4f2c80',
      900: '#422669',
      950: '#271444',
    },
  },
  {
    id: 'rosa_quartzo',
    name: 'Rosa Quartzo',
    nameEs: 'Rosa Cuarzo',
    nameEn: 'Rose Quartz',
    subtitle: 'Rosa blush delicado',
    subtitleEs: 'Rosa blush delicado',
    subtitleEn: 'Delicate blush rose',
    preview: { bg: '#FCF4F7', soft: '#FBE1EB', accent: '#C85C84', accentDark: '#9F3E64' },
    surfaceBg: '#FCF4F7',
    softBg: '#FBEBF1',
    glassBg: 'rgba(251, 225, 235, 0.72)',
    accentRgb: '200, 92, 132',
    accentLightRgb: '240, 158, 189',
    scale: {
      50: '#fdf2f6',
      100: '#fbe1eb',
      200: '#f7c4d8',
      300: '#ef99bc',
      400: '#e26b9a',
      500: '#cf4d80',
      600: '#b83b6b',
      700: '#992e57',
      800: '#7f284a',
      900: '#6b2440',
      950: '#3f1023',
    },
  },
  {
    id: 'pessego_creme',
    name: 'Pêssego Creme',
    nameEs: 'Durazno Crema',
    nameEn: 'Peach Cream',
    subtitle: 'Salmão pastel acolhedor',
    subtitleEs: 'Salmón pastel acogedor',
    subtitleEn: 'Warm pastel peach',
    preview: { bg: '#FCF6F2', soft: '#FBE6D8', accent: '#D4724B', accentDark: '#AD5330' },
    surfaceBg: '#FCF6F2',
    softBg: '#FBF0E8',
    glassBg: 'rgba(251, 230, 216, 0.72)',
    accentRgb: '212, 114, 75',
    accentLightRgb: '245, 175, 145',
    scale: {
      50: '#fdf5f0',
      100: '#fbe6d8',
      200: '#f6cbb0',
      300: '#efa77f',
      400: '#e58152',
      500: '#d66838',
      600: '#be5329',
      700: '#9e4122',
      800: '#813621',
      900: '#692f1e',
      950: '#39150c',
    },
  },
  {
    id: 'mel_manteiga',
    name: 'Mel & Manteiga',
    nameEs: 'Miel y Manteca',
    nameEn: 'Butter Honey',
    subtitle: 'Creme dourado sofisticado',
    subtitleEs: 'Crema dorada sofisticada',
    subtitleEn: 'Sophisticated warm cream',
    preview: { bg: '#FCF9F0', soft: '#F8ECCB', accent: '#B8862B', accentDark: '#8F6419' },
    surfaceBg: '#FCF9F0',
    softBg: '#FAF3DF',
    glassBg: 'rgba(248, 236, 203, 0.72)',
    accentRgb: '184, 134, 43',
    accentLightRgb: '234, 195, 112',
    scale: {
      50: '#fcf9ee',
      100: '#f8eccb',
      200: '#f0d897',
      300: '#e6be60',
      400: '#d7a13b',
      500: '#bf8726',
      600: '#a36c1d',
      700: '#85531a',
      800: '#6e431b',
      900: '#5d381b',
      950: '#361d0b',
    },
  },
  {
    id: 'areia_minimal',
    name: 'Areia Minimal',
    nameEs: 'Arena Minimal',
    nameEn: 'Minimal Sand',
    subtitle: 'Bege champagne e café suave',
    subtitleEs: 'Beige champagne y café suave',
    subtitleEn: 'Champagne sand & soft taupe',
    preview: { bg: '#F8F6F2', soft: '#ECE5DA', accent: '#8B735B', accentDark: '#6A5643' },
    surfaceBg: '#F8F6F2',
    softBg: '#F2EDE5',
    glassBg: 'rgba(236, 229, 218, 0.74)',
    accentRgb: '139, 115, 91',
    accentLightRgb: '194, 175, 155',
    scale: {
      50: '#f7f5f1',
      100: '#ece5da',
      200: '#dad0bf',
      300: '#c3b29b',
      400: '#a89278',
      500: '#8f775e',
      600: '#7a634d',
      700: '#655140',
      800: '#554437',
      900: '#473a30',
      950: '#271e18',
    },
  },
  {
    id: 'nuvem_grafite',
    name: 'Nuvem Grafite',
    nameEs: 'Nube Grafito',
    nameEn: 'Cloud Slate',
    subtitle: 'Cinza pérola super clean',
    subtitleEs: 'Gris perla súper limpio',
    subtitleEn: 'Ultra-clean pearl slate',
    preview: { bg: '#F4F6F8', soft: '#E2E8F0', accent: '#475569', accentDark: '#334155' },
    surfaceBg: '#F4F6F8',
    softBg: '#EDF1F5',
    glassBg: 'rgba(226, 232, 240, 0.74)',
    accentRgb: '71, 85, 105',
    accentLightRgb: '148, 163, 184',
    scale: {
      50: '#f5f7f9',
      100: '#e5eaf0',
      200: '#cbd5e1',
      300: '#a8b7c9',
      400: '#7d90a8',
      500: '#5b6f87',
      600: '#47586e',
      700: '#3a4759',
      800: '#313c4a',
      900: '#29323e',
      950: '#171d26',
    },
  },
];

export const ALL_COLOR_THEMES: ColorThemeDefinition[] = [
  FACTORY_THEME,
  ...PASTEL_COLOR_THEMES,
];

const STORAGE_KEY = 'sisfinz_color_theme_v1';
const STYLE_ELEMENT_ID = 'sisfinz-style-color-theme';

export function getSavedColorThemeId(): ColorThemeId {
  if (typeof window === 'undefined') return 'factory';
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ColorThemeId | null;
    if (saved && ALL_COLOR_THEMES.some((t) => t.id === saved)) {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'factory';
}

export function getColorThemeById(id: ColorThemeId): ColorThemeDefinition {
  return ALL_COLOR_THEMES.find((t) => t.id === id) || FACTORY_THEME;
}

export function applyColorTheme(themeId: ColorThemeId): void {
  if (typeof document === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, themeId);
  } catch {
    // ignore storage errors
  }

  const existing = document.getElementById(STYLE_ELEMENT_ID);

  if (themeId === 'factory') {
    if (existing) existing.remove();
    document.documentElement.removeAttribute('data-color-theme');
    const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = '#059669';
    window.dispatchEvent(new CustomEvent('sisfinz-theme-change', { detail: themeId }));
    return;
  }

  const theme = getColorThemeById(themeId);
  document.documentElement.setAttribute('data-color-theme', theme.id);

  const css = `
:root {
  --color-emerald-50: ${theme.scale[50]};
  --color-emerald-100: ${theme.scale[100]};
  --color-emerald-200: ${theme.scale[200]};
  --color-emerald-300: ${theme.scale[300]};
  --color-emerald-400: ${theme.scale[400]};
  --color-emerald-500: ${theme.scale[500]};
  --color-emerald-600: ${theme.scale[600]};
  --color-emerald-700: ${theme.scale[700]};
  --color-emerald-800: ${theme.scale[800]};
  --color-emerald-900: ${theme.scale[900]};
  --color-emerald-950: ${theme.scale[950]};
  --color-teal-50: ${theme.scale[50]};
  --color-teal-100: ${theme.scale[100]};
  --color-teal-200: ${theme.scale[200]};
  --color-teal-300: ${theme.scale[300]};
  --color-teal-400: ${theme.scale[400]};
  --color-teal-500: ${theme.scale[500]};
  --color-teal-600: ${theme.scale[600]};
  --color-teal-700: ${theme.scale[700]};
  --color-teal-800: ${theme.scale[800]};
  --color-teal-900: ${theme.scale[900]};
  --color-teal-950: ${theme.scale[950]};
}

html, body, #root {
  background-color: ${theme.surfaceBg} !important;
}

.mesh-gradient {
  background-color: ${theme.surfaceBg} !important;
  background-image:
    radial-gradient(at 0% 0%, rgba(${theme.accentRgb}, 0.14) 0px, transparent 52%),
    radial-gradient(at 100% 0%, rgba(${theme.accentLightRgb}, 0.16) 0px, transparent 52%),
    radial-gradient(at 100% 100%, rgba(${theme.accentRgb}, 0.10) 0px, transparent 52%),
    radial-gradient(at 0% 100%, rgba(${theme.accentLightRgb}, 0.12) 0px, transparent 52%) !important;
}

.glass-emerald,
.glass-dark {
  background: ${theme.glassBg} !important;
  border-color: rgba(${theme.accentRgb}, 0.22) !important;
  box-shadow: 0 4px 15px rgba(${theme.accentRgb}, 0.08) !important;
}

.glass-dark {
  color: ${theme.scale[900]} !important;
}

.financial-calendar-day-backdrop {
  background: ${theme.glassBg} !important;
}

.glass {
  box-shadow: 0 10px 30px rgba(${theme.accentRgb}, 0.06) !important;
}

.glass-panel {
  box-shadow: 0 15px 35px rgba(${theme.accentRgb}, 0.07) !important;
}

.premium-shadow {
  box-shadow:
    0 10px 25px -3px rgba(${theme.accentRgb}, 0.09),
    0 4px 6px -4px rgba(0, 0, 0, 0.03),
    inset 0 0 0 1px rgba(255, 255, 255, 0.8) !important;
}

.premium-shadow-emerald {
  box-shadow:
    0 20px 25px -5px rgba(${theme.accentRgb}, 0.16),
    0 8px 10px -6px rgba(${theme.accentRgb}, 0.10) !important;
}

[class*="bg-[#F4F8F6]"]:not([data-theme-preview]) {
  background-color: ${theme.surfaceBg} !important;
}

[class*="bg-[#F0FDF7]"]:not([data-theme-preview]),
[class*="bg-[#ECFDF5]"]:not([data-theme-preview]) {
  background-color: ${theme.softBg} !important;
}

[class*="bg-[#D1FAEB]"]:not([data-theme-preview]) {
  background-color: ${theme.glassBg} !important;
}
`;

  let styleEl = existing as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;

  const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = theme.scale[600];

  window.dispatchEvent(new CustomEvent('sisfinz-theme-change', { detail: themeId }));
}

export function initColorTheme(): void {
  const saved = getSavedColorThemeId();
  applyColorTheme(saved);
}
