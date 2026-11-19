/**
 * Automatically scrolls the Finance dashboard horizontal tab bar
 * (Visão Geral, Faturas do Mês, Próximas, Receitas, Despesas)
 * to the top of the viewport (right below the sticky header) whenever
 * ANY tab inside it is clicked, respecting the document's bottom scroll limit.
 */

let pendingTimers: number[] = [];

const clearPendingTimers = () => {
  for (const id of pendingTimers) {
    window.clearTimeout(id);
  }
  pendingTimers = [];
};

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const FINANCE_TAB_KEYWORDS = [
  'visao geral',
  'vision general',
  'overview',
  'resumen',
  'faturas do mes',
  'facturas del mes',
  'faturas',
  'facturas',
  'proximas',
  'upcoming',
  'receitas',
  'rendas',
  'ingresos',
  'incomes',
  'despesas',
  'gastos',
  'expenses',
];

const isInsideFixedOrOverlay = (el: HTMLElement): boolean => {
  if (el.closest('header, [role="dialog"]')) return true;
  let node: HTMLElement | null = el;
  while (node && node !== document.body && node !== document.documentElement) {
    if (window.getComputedStyle(node).position === 'fixed') return true;
    node = node.parentElement;
  }
  return false;
};

const findFinanceTabBar = (button: HTMLElement): HTMLElement | null => {
  if (isInsideFixedOrOverlay(button)) return null;

  let candidate: HTMLElement | null = button.parentElement;
  for (let depth = 0; depth < 2 && candidate; depth++) {
    const buttons = Array.from(candidate.querySelectorAll<HTMLElement>('button'));
    if (buttons.length >= 4 && buttons.length <= 8) {
      let matchedTabs = 0;
      for (const btn of buttons) {
        const text = normalizeText(btn.textContent || '');
        if (FINANCE_TAB_KEYWORDS.some((kw) => text.includes(kw))) {
          matchedTabs++;
        }
      }
      if (matchedTabs >= 3) {
        return candidate;
      }
    }
    candidate = candidate.parentElement;
  }

  return null;
};

const centerTabHorizontally = (tabBar: HTMLElement, button: HTMLElement) => {
  const scrollContainer =
    tabBar.scrollWidth > tabBar.clientWidth + 2
      ? tabBar
      : tabBar.parentElement && tabBar.parentElement.scrollWidth > tabBar.parentElement.clientWidth + 2
      ? tabBar.parentElement
      : null;

  if (!scrollContainer) return;

  const barRect = scrollContainer.getBoundingClientRect();
  const btnRect = button.getBoundingClientRect();
  const targetLeft =
    scrollContainer.scrollLeft + (btnRect.left - barRect.left) - (barRect.width - btnRect.width) / 2;
  const maxLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
  const clampedLeft = Math.max(0, Math.min(targetLeft, maxLeft));
  scrollContainer.scrollTo({ left: clampedLeft, behavior: 'smooth' });
};

const scrollTabBarToTop = (tabBar: HTMLElement) => {
  if (!document.body.contains(tabBar)) return;

  const header = document.querySelector<HTMLElement>('header');
  const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  const topOffset = Math.ceil(headerBottom) + 8;

  // Use native scrollIntoView with scroll-margin-top so it works reliably across
  // iOS Safari, PWA standalone mode, nested scroll containers, and respects the
  // document's natural bottom scroll limit.
  tabBar.style.scrollMarginTop = `${topOffset}px`;
  tabBar.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

let initialized = false;

export function initTabBarAutoScroll() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  initialized = true;

  // Cancel any scheduled adjustment if the user manually scrolls
  window.addEventListener('touchstart', clearPendingTimers, { passive: true });
  window.addEventListener('wheel', clearPendingTimers, { passive: true });

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const button = target.closest('button') as HTMLElement | null;
      if (!button) return;

      const tabBar = findFinanceTabBar(button);
      if (!tabBar) return;

      clearPendingTimers();
      centerTabHorizontally(tabBar, button);

      // Run after React renders the newly selected tab content, and once more
      // shortly after to override legacy billsRef/incomesRef scrollIntoView calls.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollTabBarToTop(tabBar);
        });
      });

      pendingTimers.push(
        window.setTimeout(() => {
          scrollTabBarToTop(tabBar);
        }, 140)
      );
    },
    true
  );
}
