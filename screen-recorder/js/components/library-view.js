import { $, cloneTemplate, mount } from '../utils/dom.js';
import { formatClock, formatBytes, formatDate } from '../utils/time.js';
import { listRecordings, deleteRecording, renameRecording } from '../services/storage.js';
import { downloadBlob, extensionForMime } from '../utils/download.js';

export async function renderLibraryView(root, { onOpenTrimmer } = {}) {
  const view = cloneTemplate('tpl-library');
  mount(root, view);

  const list = $('#recordings', view);
  const empty = $('#library-empty', view);

  const objectUrls = [];
  function refresh() {
    while (objectUrls.length) URL.revokeObjectURL(objectUrls.pop());
    return render();
  }

  async function render() {
    const recordings = await listRecordings();
    list.replaceChildren();
    empty.hidden = recordings.length > 0;

    for (const rec of recordings) {
      const li = document.createElement('li');
      li.className = 'recording';

      const video = document.createElement('video');
      const url = URL.createObjectURL(rec.blob);
      objectUrls.push(url);
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      const meta = document.createElement('div');
      meta.className = 'meta';
      const h3 = document.createElement('h3');
      h3.textContent = rec.name;
      const p = document.createElement('p');
      p.textContent = `${formatClock(rec.durationSec)} · ${formatBytes(rec.size)} · ${formatDate(rec.createdAt)}`;
      meta.append(h3, p);

      const actions = document.createElement('div');
      actions.className = 'actions';

      const trimBtn = document.createElement('button');
      trimBtn.className = 'primary';
      trimBtn.textContent = 'Trim';
      trimBtn.addEventListener('click', () => onOpenTrimmer?.(rec.id));

      const dlBtn = document.createElement('button');
      dlBtn.textContent = 'Download';
      dlBtn.addEventListener('click', () => {
        const ext = extensionForMime(rec.mimeType);
        downloadBlob(rec.blob, `${rec.name}.${ext}`);
      });

      const renameBtn = document.createElement('button');
      renameBtn.className = 'ghost';
      renameBtn.textContent = 'Rename';
      renameBtn.addEventListener('click', async () => {
        const name = prompt('Rename recording', rec.name);
        if (name && name.trim()) {
          await renameRecording(rec.id, name.trim());
          refresh();
        }
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        if (confirm(`Delete "${rec.name}"?`)) {
          await deleteRecording(rec.id);
          refresh();
        }
      });

      actions.append(trimBtn, dlBtn, renameBtn, delBtn);
      li.append(video, meta, actions);
      list.append(li);
    }
  }

  await render();

  return {
    destroy() {
      while (objectUrls.length) URL.revokeObjectURL(objectUrls.pop());
    }
  };
}
