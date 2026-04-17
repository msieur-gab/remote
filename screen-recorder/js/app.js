import { $, $$ } from './utils/dom.js';
import { renderRecorderView } from './components/recorder-view.js';
import { renderLibraryView } from './components/library-view.js';
import { renderTrimmerView } from './components/trimmer-view.js';

const root = $('#view-root');
const tabs = $$('.tab');
let current = null;
let state = { view: 'recorder', trimId: null, autostart: false };

async function swap(next) {
  if (current?.destroy) current.destroy();
  current = null;
  if (next) current = await next;
}

function setTab(view) {
  for (const t of tabs) {
    t.setAttribute('aria-selected', String(t.dataset.view === view));
  }
}

async function navigate(next) {
  state = { ...state, ...next };
  if (state.view === 'recorder') {
    setTab('recorder');
    await swap(renderRecorderView(root, {
      autostart: state.autostart,
      onSaved: () => navigate({ view: 'library', autostart: false }),
      onOpenBookmarklet: openBookmarkletDialog
    }));
    state.autostart = false;
  } else if (state.view === 'library') {
    setTab('library');
    await swap(renderLibraryView(root, {
      onOpenTrimmer: (id) => navigate({ view: 'trimmer', trimId: id })
    }));
  } else if (state.view === 'trimmer') {
    await swap(renderTrimmerView(root, {
      id: state.trimId,
      onBack: () => navigate({ view: 'library' }),
      onSaved: () => navigate({ view: 'library' })
    }));
  }
}

for (const t of tabs) {
  t.addEventListener('click', () => navigate({ view: t.dataset.view }));
}

function openBookmarkletDialog() {
  const dialog = $('#bookmarklet-dialog');
  const link = $('#bookmarklet-link');
  const source = $('#bookmarklet-source');
  const url = new URL('./index.html', location.href);
  url.searchParams.set('autostart', '1');
  const code = `javascript:(function(){window.open(${JSON.stringify(url.href)},'_blank','noopener');})();`;
  link.href = code;
  source.value = code;
  dialog.showModal();
}

const params = new URLSearchParams(location.search);
if (params.get('autostart') === '1') {
  state.autostart = true;
}

navigate({ view: 'recorder' });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}
