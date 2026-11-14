// Tiny DOM helpers used by every UI module.

/**
 * h('div.card.big', { onclick, style, text, html, ...attrs }, child, [children], 'text')
 */
export function h(sel, props, ...kids) {
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (props && (props instanceof Node || typeof props !== 'object' || Array.isArray(props))) {
    kids.unshift(props);
    props = null;
  }
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v);
    }
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export const clear = (el) => {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
};

/** Labelled progress bar. value 0..1 */
export function bar(value, color = 'var(--accent)', cls = '') {
  return h('div.bar' + (cls ? '.' + cls : ''), h('div.bar-fill', { style: { width: Math.round(Math.max(0, Math.min(1, value)) * 100) + '%', background: color } }));
}

export const btn = (label, onclick, cls = '') => h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { onclick, type: 'button' }, label);
