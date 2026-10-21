// Element picker for the designer's Tweak page (apps/mobile/scripts/tweak). Only when the web app runs inside its
// iframe: in pick mode hovering outlines the styled element under the cursor and a click sends its source (the
// data-tw marks added by scripts/tweak/babel-plugin.cjs) to the page instead of tapping it.
if (typeof window !== 'undefined' && window.parent !== window) {
  let picking = false;
  const box = document.createElement('div');
  const picked = document.createElement('div');
  for (const [el, color] of [[box, '#1D9BF0'], [picked, '#E2B100']] as const) {
    Object.assign(el.style, { position: 'fixed', pointerEvents: 'none', zIndex: '2147483647', border: `1.5px solid ${color}`, borderRadius: '2px', display: 'none' });
    document.documentElement.appendChild(el);
  }
  const place = (el: HTMLElement, target: Element | null) => {
    if (!target) return void (el.style.display = 'none');
    const r = target.getBoundingClientRect();
    Object.assign(el.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  };
  const marked = (t: EventTarget | null) => (t instanceof Element ? t.closest('[data-tw]') : null);
  let selected: Element | null = null;

  window.addEventListener('message', (e) => {
    if (e.data?.tweak !== 'pick') return;
    picking = !!e.data.on;
    document.documentElement.style.cursor = picking ? 'crosshair' : '';
    if (!picking) place(box, null);
  });
  document.addEventListener('mousemove', (e) => picking && place(box, marked(e.target)), true);
  document.addEventListener('scroll', () => place(picked, selected), true);
  const block = (e: Event) => {
    if (!picking) return;
    e.preventDefault();
    e.stopPropagation();
  };
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) document.addEventListener(type, block, true);
  document.addEventListener(
    'click',
    (e) => {
      if (!picking) return;
      block(e);
      const el = marked(e.target);
      if (!el) return;
      const chain: string[] = [];
      for (let p: Element | null = el; p && chain.length < 6; p = p.parentElement ? p.parentElement.closest('[data-tw]') : null) {
        const tw = (p as HTMLElement).dataset.tw;
        if (tw && !chain.includes(tw)) chain.push(tw);
      }
      selected = el;
      place(picked, el);
      window.parent.postMessage({ tweak: 'picked', chain, path: location.pathname }, '*');
    },
    true,
  );
}
export {};
