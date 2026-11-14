// Small UI pieces shared by the phone apps and shop dialogs.
import { h } from '../dom.js';
import { fmtMoney } from '../../core/utils.js';

export const section = (title, ...kids) => h('div.sec', title ? h('div.sec-title', title) : null, ...kids);
export const kv = (k, v, cls = '') => h('div.kv', h('span.muted', k), h('span' + (cls ? '.' + cls : ''), v));
export const empty = (text) => h('div.empty', text);

/** Row with icon, title/subtitle and a right-hand value or button. */
export function row({ icon, title, sub, right, onclick, cls = '' }) {
  return h(
    (onclick ? 'button' : 'div') + '.lrow' + (cls ? '.' + cls : ''),
    { onclick },
    icon ? h('div.lrow-icon', icon) : null,
    h('div.grow', h('div.lrow-title', title), sub ? h('div.lrow-sub', sub) : null),
    right != null ? h('div.lrow-right', right) : null,
  );
}

/** Segmented tab control. tabs = [[id,label],...] */
export function tabs(list, current, onPick) {
  return h(
    'div.seg',
    list.map(([id, label]) => h('button.seg-btn' + (id === current ? '.active' : ''), { onclick: () => onPick(id) }, label)),
  );
}

/** Signed money with colour. */
export const money = (n, sign = false) => h('span.' + (n < 0 ? 'bad' : sign ? 'good' : ''), (sign && n > 0 ? '+' : '') + fmtMoney(n));

/**
 * Amount picker: quick chips + free input, then a confirm button.
 * onConfirm(amount)
 */
export function amountPicker({ max, label = 'Confirm', chips = [100, 500, 1000], onConfirm }) {
  max = Math.floor(max);
  const input = h('input.text.amount', { type: 'number', min: 0, max, placeholder: 'Amount', value: '' });
  const set = (v) => (input.value = Math.max(0, Math.min(max, Math.floor(v))));
  return h(
    'div.amount',
    h('div.chips', chips.filter((c) => c <= max).map((c) => h('button.chip', { onclick: () => set(c) }, fmtMoney(c))), max > 0 ? h('button.chip', { onclick: () => set(max / 2) }, 'Half') : null, max > 0 ? h('button.chip', { onclick: () => set(max) }, 'Max') : null),
    h(
      'div.row',
      input,
      h(
        'button.btn.primary.small',
        {
          onclick: () => {
            const v = Math.floor(+input.value);
            if (v > 0 && v <= max) onConfirm(v);
          },
        },
        label,
      ),
    ),
  );
}

/** Line chart on a canvas. values: number[] */
export function lineChart(values, { w = 300, hgt = 110, color = '#ffb347', fill = true, zero = false } = {}) {
  const cv = h('canvas.chart', { width: w * 2, height: hgt * 2, style: { width: '100%', height: hgt + 'px' } });
  const g = cv.getContext('2d');
  g.scale(2, 2);
  if (values.length < 2) values = values.length ? [values[0], values[0]] : [0, 0];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (zero) min = Math.min(min, 0);
  if (max - min < 1e-6) {
    max += 1;
    min -= 1;
  }
  const pad = 6;
  const X = (i) => pad + (i / (values.length - 1)) * (w - pad * 2);
  const Y = (v) => hgt - pad - ((v - min) / (max - min)) * (hgt - pad * 2);
  if (min < 0 && max > 0) {
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.setLineDash([4, 4]);
    g.beginPath();
    g.moveTo(pad, Y(0));
    g.lineTo(w - pad, Y(0));
    g.stroke();
    g.setLineDash([]);
  }
  g.beginPath();
  values.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))));
  g.strokeStyle = color;
  g.lineWidth = 2.2;
  g.lineJoin = 'round';
  g.stroke();
  if (fill) {
    g.lineTo(X(values.length - 1), hgt);
    g.lineTo(X(0), hgt);
    g.closePath();
    const grd = g.createLinearGradient(0, 0, 0, hgt);
    grd.addColorStop(0, color + '55');
    grd.addColorStop(1, color + '00');
    g.fillStyle = grd;
    g.fill();
  }
  return cv;
}

/** Horizontal share bar list: items = [{label, value, color}] */
export function shareBars(items, total) {
  total = total || items.reduce((s, i) => s + i.value, 0) || 1;
  return h(
    'div.shares',
    items.map((i) =>
      h('div.share', h('div.row.between', h('span', i.label), h('span', fmtMoney(i.value))), h('div.bar', h('div.bar-fill', { style: { width: Math.max(2, (i.value / total) * 100) + '%', background: i.color || 'var(--accent)' } }))),
    ),
  );
}
