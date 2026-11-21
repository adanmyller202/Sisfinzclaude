/**
 * Ensures any legacy SisFinz logo image tags anywhere in the app
 * (Navbar, Sidebar, NavigationDrawer, Login, Reset/Verification screens, etc.)
 * automatically render the new vector emerald folded-S logo (`/logo-sisfinz.svg`).
 */

const NEW_LOGO_SRC = '/logo-sisfinz.svg';
const LEGACY_LOGO_PATTERNS = [
  'image_89b2520a.jpeg',
  '/logo.png',
];

function swapLegacyLogos() {
  if (typeof document === 'undefined') return;
  const imgs = document.querySelectorAll<HTMLImageElement>('img');
  imgs.forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (LEGACY_LOGO_PATTERNS.some((pattern) => src.includes(pattern))) {
      img.setAttribute('src', NEW_LOGO_SRC);
      img.style.backgroundColor = '#FFFFFF';
      img.style.objectFit = 'contain';
    }
  });
}

let logoSyncInitialized = false;

export function initBrandLogoSync() {
  if (logoSyncInitialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  logoSyncInitialized = true;

  swapLegacyLogos();

  const observer = new MutationObserver(() => {
    swapLegacyLogos();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
