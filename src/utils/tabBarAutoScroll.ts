/**
 * Automatically scrolls the Finance dashboard horizontal tab bar
 * (Visão Geral, Faturas do Mês, Próximas, Receitas, Despesas)
 * to the top of the viewport (right below the sticky header) whenever
 * any tab inside it is clicked, respecting the document's bottom scroll limit.
 */

import {
  repairCachedIncomesSynchronously,
  repairMissingIncomeExpectedDates,
} from '../components/ErrorBoundary';
import { initSalaryBreakdownViewer } from './salaryBreakdownViewer';

let pendingTimers: number[] = [];

const clearPendingTimers = () => {
  for (const id of pendingTimers) {
    window.clearTimeout(id);
  }
  pendingTimers = [];
};

const findScrollableVerticalParent = (el: HTMLElement): HTMLElement | null => {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight + 2
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
};

const isFinanceTabBar = (el: HTMLElement | null): el is HTMLElement => {
  if (!el) return false;
  if (el.closest('header, nav, [role="dialog"]')) return false;
  const cls = el.classList;
  if (!cls.contains('glass') || !cls.contains('overflow-x-auto') || !cls.contains('no-scrollbar')) {
    return false;
  }
  const directButtons = Array.from(el.children).filter(
    (child) => child.tagName === 'BUTTON'
  );
  return directButtons.length >= 4;
};

const centerTabHorizontally = (tabBar: HTMLElement, button: HTMLElement) => {
  const barRect = tabBar.getBoundingClientRect();
  const btnRect = button.getBoundingClientRect();
  const targetLeft =
    tabBar.scrollLeft + (btnRect.left - barRect.left) - (barRect.width - btnRect.width) / 2;
  const maxLeft = Math.max(0, tabBar.scrollWidth - tabBar.clientWidth);
  const clampedLeft = Math.max(0, Math.min(targetLeft, maxLeft));
  tabBar.scrollTo({ left: clampedLeft, behavior: 'smooth' });
};

const scrollTabBarToTop = (tabBar: HTMLElement) => {
  if (!document.body.contains(tabBar)) return;

  const header = document.querySelector<HTMLElement>('header');
  const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  const topPadding = headerBottom + 8;

  const scrollParent = findScrollableVerticalParent(tabBar);
  if (scrollParent) {
    const parentRect = scrollParent.getBoundingClientRect();
    const barRect = tabBar.getBoundingClientRect();
    const desiredTop = scrollParent.scrollTop + (barRect.top - parentRect.top) - 8;
    const maxTop = Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight);
    const clampedTop = Math.max(0, Math.min(desiredTop, maxTop));
    scrollParent.scrollTo({ top: clampedTop, behavior: 'smooth' });
    return;
  }

  const barRect = tabBar.getBoundingClientRect();
  const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  const desiredY = currentScrollY + barRect.top - topPadding;
  const docHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );
  const maxScrollY = Math.max(0, docHeight - window.innerHeight);
  const clampedY = Math.max(0, Math.min(desiredY, maxScrollY));

  window.scrollTo({ top: clampedY, behavior: 'smooth' });
};

let initialized = false;

export function initTabBarAutoScroll() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  initialized = true;

  // Proactively repair any income cached without expectedDate before React mounts
  repairCachedIncomesSynchronously();
  repairMissingIncomeExpectedDates().catch(() => {});

  // Enable interactive salary composition breakdown viewer on synced salary incomes in Receitas
  initSalaryBreakdownViewer();

  // Cancel any scheduled adjustment if the user starts manually scrolling
  window.addEventListener('touchstart', clearPendingTimers, { passive: true });
  window.addEventListener('wheel', clearPendingTimers, { passive: true });

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const button = target.closest('button') as HTMLElement | null;
      if (!button) return;

      const tabBar = button.parentElement;
      if (!isFinanceTabBar(tabBar)) return;

      clearPendingTimers();
      centerTabHorizontally(tabBar, button);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollTabBarToTop(tabBar);
        });
      });

      pendingTimers.push(
        window.setTimeout(() => {
          scrollTabBarToTop(tabBar);
        }, 120)
      );
    },
    true
  );
}
