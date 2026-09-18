export {};

interface Window {
  gsap?: {
    fromTo: (target: Element, fromVars: Record<string, unknown>, toVars: Record<string, unknown>) => void;
  };
}

const byId = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animateProgressBar(): void {
  const fill = byId<HTMLDivElement>('progressFill');
  if (!fill || prefersReducedMotion) return;
  fill.animate(
    [{ transform: 'scaleX(.96)', opacity: .7 }, { transform: 'scaleX(1)', opacity: 1 }],
    { duration: 420, easing: 'cubic-bezier(.22,.9,.32,1)' },
  );
}

function enhanceButtonFeedback(): void {
  document.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLElement>('button, label.toolbtn, .pick2');
    if (!button || prefersReducedMotion) return;
    button.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(1px) scale(.985)' }, { transform: 'translateY(0)' }],
      { duration: 180, easing: 'ease-out' },
    );
  });
}

function addLiveStatus(): void {
  const label = byId<HTMLSpanElement>('progressLabel');
  if (!label) return;
  label.setAttribute('role', 'status');
  label.setAttribute('aria-live', 'polite');

  const fill = byId<HTMLDivElement>('progressFill');
  fill?.setAttribute('role', 'progressbar');
  fill?.setAttribute('aria-label', 'Avanzamento controllo skin');
  fill?.setAttribute('aria-valuemin', '0');
  fill?.setAttribute('aria-valuemax', '100');

  const observer = new MutationObserver(() => {
    const value = label.textContent?.match(/(\d+)\s*\/\s*(\d+)/);
    if (!fill || !value) return;
    const done = Number(value[1]);
    const total = Number(value[2]);
    const percent = total ? Math.round((done / total) * 100) : 0;
    fill.setAttribute('aria-valuenow', String(percent));
    animateProgressBar();
  });
  observer.observe(label, { childList: true, characterData: true, subtree: true });
}

function addKeyboardFocusState(): void {
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    document.documentElement.classList.add('keyboard-nav');
  });
  document.addEventListener('pointerdown', () => document.documentElement.classList.remove('keyboard-nav'));
}

function initEnhancements(): void {
  enhanceButtonFeedback();
  addLiveStatus();
  addKeyboardFocusState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEnhancements, { once: true });
} else {
  initEnhancements();
}
