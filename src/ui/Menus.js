// Pause menu, settings, controls, save-slot picker, credits and generic
// dialogs (never alert/confirm/prompt).
import { h, btn } from './dom.js';
import { listSlots, saveSlot, loadSlot, deleteSlot, exportSave, importSave } from '../core/SaveSystem.js';
import { getCity } from '../data/cities/index.js';
import { ARCHETYPE_BY_ID } from '../data/archetypes.js';
import { fmtMoney } from '../core/utils.js';

/** Generic centred dialog. Returns the overlay element. */
export function dialog(game, { title, body, buttons = [], cls = '', onClose, closable = true, wide = false }) {
  const box = h('div.dialog' + (wide ? '.wide' : '') + (cls ? '.' + cls : ''), title ? h('div.dialog-title', title) : null, h('div.dialog-body', body), buttons.length ? h('div.dialog-foot', buttons) : null);
  const el = h('div.overlay.dim', { onclick: (e) => closable && e.target === el && game.closeOverlay(el) }, box);
  game.openOverlay(el, { onClose, closable });
  return el;
}

/** Promise-based yes/no question. */
export function confirmBox(game, { title, text, yes = 'Yes', no = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const el = dialog(game, {
      title,
      body: h('div.muted', text),
      onClose: () => !answered && resolve(false),
      buttons: [
        btn(no, () => game.closeOverlay(el)),
        btn(
          yes,
          () => {
            answered = true;
            game.closeOverlay(el);
            resolve(true);
          },
          danger ? 'danger' : 'primary',
        ),
      ],
    });
  });
}

export function openPause(game) {
  if (game.overlays.some((o) => o.el.classList.contains('pause'))) return;
  const el = dialog(game, {
    cls: 'pause',
    title: 'Paused',
    body: h(
      'div.menu-col',
      btn('▶  Resume', () => game.closeOverlay(el), 'primary'),
      btn('💾  Save game', () => openSlots(game, 'save')),
      btn('📂  Load game', () => openSlots(game, 'load')),
      btn('⚙️  Settings', () => openSettings(game)),
      btn('🎮  Controls', () => openControls(game)),
      btn('🚪  Quit to title', async () => {
        if (await confirmBox(game, { title: 'Quit to title?', text: 'Your progress is saved first.', yes: 'Save & quit' })) {
          game.saveNow();
          game.toTitle();
        }
      }),
    ),
  });
}

export function openControls(game) {
  const rows = [
    ['W A S D', 'Move'],
    ['Shift', 'Run'],
    ['Space', 'Jump'],
    ['Mouse drag / pointer lock', 'Orbit camera'],
    ['Mouse wheel', 'Zoom'],
    ['E', 'Interact (doors, people, shops, beds, computers)'],
    ['Tab or P', 'Phone'],
    ['M', 'Map'],
    ['B', 'Build mode (inside your home)'],
    ['T', 'Wait / skip time'],
    ['F', 'Enter / exit vehicle'],
    ['W S / A D', 'Drive: throttle, brake / steer'],
    ['Esc', 'Pause / close'],
  ];
  dialog(game, { title: 'Controls', body: h('div.controls', rows.map(([k, v]) => h('div.kv', h('span', k.split(' or ').length > 1 || k.length < 6 ? k.split(' ').map((x) => (x === 'or' || x === '/' ? ' ' + x + ' ' : h('kbd', x))) : h('kbd', k)), h('span.muted', v)))) });
}

export function openCredits(game) {
  dialog(game, {
    title: 'Credits',
    body: h(
      'div.credits',
      h('div.big', 'PENNY TO PENTHOUSE'),
      h('div.muted', 'Start with nothing. Build everything.'),
      h('p', 'Design & development: ', h('b', 'Quan Bui'), ' (GitHub: DQuanBui)'),
      h('p', 'Built with Claude (Fable 5.2) in VS Code.'),
      h('p.muted', 'Engine: Three.js + Vite. All art, cities, characters and sound are generated procedurally at runtime. Every business and brand in the game is fictional.'),
    ),
  });
}

export function openSettings(game) {
  const s = game.settings;
  const sel = (key, opts) =>
    h(
      'div.seg',
      opts.map(([v, label]) =>
        h(
          'button.seg-btn' + (s.get(key) === v ? '.active' : ''),
          {
            onclick: (e) => {
              s.set(key, v);
              for (const b of e.target.parentElement.children) b.classList.toggle('active', b === e.target);
            },
          },
          label,
        ),
      ),
    );
  const slider = (key, min, max, step, fmt = (v) => Math.round(v * 100) + '%') => {
    const out = h('span.muted', fmt(s.get(key)));
    return h(
      'div.row',
      h('input.slider.grow', {
        type: 'range', min, max, step, value: s.get(key),
        oninput: (e) => {
          s.set(key, +e.target.value);
          out.textContent = fmt(+e.target.value);
        },
      }),
      out,
    );
  };
  const toggle = (key) => sel(key, [[true, 'On'], [false, 'Off']]);
  const line = (label, control) => h('div.set-row', h('div.set-label', label), h('div.set-ctl', control));
  dialog(game, {
    title: 'Settings',
    wide: true,
    body: h(
      'div.settings',
      h('div.set-group', 'Graphics'),
      line('Quality preset', sel('graphics', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']])),
      line('Auto-lower quality if slow', toggle('autoQuality')),
      line('Show FPS', toggle('showFps')),
      line('UI scale', slider('uiScale', 0.8, 1.3, 0.05)),
      h('div.set-group', 'Camera & controls'),
      line('Camera mode', sel('cameraMode', [['hold', 'Drag mouse'], ['lock', 'Pointer lock']])),
      line('Mouse sensitivity', slider('sensitivity', 0.3, 2.5, 0.05, (v) => v.toFixed(2) + '×')),
      line('Invert Y', toggle('invertY')),
      line('Touch controls', sel('touch', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']])),
      line('Touch look speed', slider('touchLook', 0.4, 2.5, 0.1, (v) => v.toFixed(1) + '×')),
      line('Vibrate on touch buttons', toggle('haptics')),
      h('div.set-group', 'Game'),
      line('Time speed', sel('timeSpeed', [[0.5, 'Relaxed'], [1, 'Normal'], [2, 'Fast'], [4, 'Very fast']])),
      line('Autosave each day', toggle('autosave')),
      line('Reduce flashing (lightning)', toggle('reduceFlashes')),
      h('div.set-group', 'Audio'),
      line('Master volume', slider('master', 0, 1, 0.05)),
      line('Music', slider('music', 0, 1, 0.05)),
      line('Sound effects', slider('sfx', 0, 1, 0.05)),
    ),
  });
}

function slotCard(meta) {
  if (!meta) return h('div.grow', h('div.slot-name.muted', 'Empty slot'), h('div.muted.small', 'Start a new life here'));
  const city = getCity(meta.cityId);
  const arch = ARCHETYPE_BY_ID[meta.archetype];
  const hrs = Math.floor(meta.playtime / 3600);
  const mins = Math.floor((meta.playtime % 3600) / 60);
  return h(
    'div.grow',
    h('div.slot-name', `${arch?.icon || ''} ${meta.name}`, h('span.muted.small', ` · ${arch?.name || ''}`)),
    h('div.muted.small', `${city.name} · Day ${meta.day} · Age ${meta.age}${meta.job ? ' · ' + meta.job : ''}`),
    h('div.small', h('span.good', `Net worth ${fmtMoney(meta.netWorth || 0)}`), h('span.muted', ` · played ${hrs}h ${mins}m`)),
  );
}

/**
 * Slot picker. mode: 'save' | 'load' | 'new'
 * onPick(slot) is used for 'new'.
 */
export function openSlots(game, mode, onPick) {
  const body = h('div.menu-col');
  const title = mode === 'save' ? 'Save game' : mode === 'load' ? 'Load game' : 'Choose a save slot';
  const el = dialog(game, { title, body, wide: true });
  const render = () => {
    body.replaceChildren(
      ...listSlots().map(({ slot, meta }) =>
        h(
          'div.slot',
          h('div.slot-num', String(slot)),
          slotCard(meta),
          h(
            'div.row',
            mode === 'save'
              ? btn('Save', async () => {
                  if (meta && slot !== game.slot && !(await confirmBox(game, { title: `Overwrite slot ${slot}?`, text: `${meta.name}'s life will be replaced.`, yes: 'Overwrite', danger: true }))) return;
                  game.slot = slot;
                  game.saveNow();
                  render();
                }, 'small primary')
              : null,
            mode === 'load' && meta
              ? btn('Load', () => {
                  game.closeAllOverlays();
                  game.loadGame(slot);
                }, 'small primary')
              : null,
            mode === 'new'
              ? btn(meta ? 'Overwrite' : 'Use', async () => {
                  if (meta && !(await confirmBox(game, { title: `Overwrite slot ${slot}?`, text: `${meta.name}'s life will be replaced when you start.`, yes: 'Overwrite', danger: true }))) return;
                  game.closeOverlay(el);
                  onPick(slot);
                }, 'small ' + (meta ? 'danger' : 'primary'))
              : null,
            meta && mode !== 'new'
              ? btn('🗑', async () => {
                  if (await confirmBox(game, { title: `Delete slot ${slot}?`, text: 'This cannot be undone.', yes: 'Delete', danger: true })) {
                    deleteSlot(slot);
                    render();
                    game.events.emit('slotsChanged');
                  }
                }, 'small')
              : null,
          ),
        ),
      ),
      h(
        'div.row',
        game.state && mode !== 'new' ? btn('⬇ Export current game to file', () => exportSave(game.state, game.saveMeta()), 'small') : null,
        mode !== 'save'
          ? btn('⬆ Import save file', async () => {
              try {
                const state = await importSave();
                const free = listSlots().find((s) => !s.meta)?.slot || 3;
                if (!saveSlot(free, state, { netWorth: 0 })) throw new Error('Save failed — browser storage is full. Delete a slot and try again.');
                game.events.emit('toast', { icon: '📂', title: 'Save imported', text: `Stored in slot ${free}.`, kind: 'good' });
                render();
                game.events.emit('slotsChanged');
              } catch (e) {
                body.append(h('div.bad.small', e.message));
              }
            }, 'small')
          : null,
      ),
    );
  };
  render();
  return el;
}

export { loadSlot };
