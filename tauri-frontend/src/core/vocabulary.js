// [ADDED v3.0] Módulo de vocabulario — bookmark de palabras desde el modal de análisis
const API_BASE = 'http://localhost:8000';

async function getDeviceSeed() {
  try {
    const { getClientSeed } = await import('../utils/device.js');
    return await getClientSeed();
  } catch (e) {
    return null;
  }
}

async function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('contextia_token');
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  }
  const seed = await getDeviceSeed();
  if (seed) {
    h['X-Device-Seed'] = seed;
  }
  return h;
}

// [ADDED v3.0] Inyectar botones bookmark dentro del modal de análisis
function injectBookmarkButtons() {
  const modal = document.getElementById('linguistic-modal');
  if (!modal) return;

  const vocabContainers = modal.querySelectorAll('.section-content');
  vocabContainers.forEach(container => {
    const tags = container.querySelectorAll('.vocab-tag');
    tags.forEach(tag => {
      // Evitar duplicados
      if (tag.parentElement.querySelector('.vocab-bookmark')) return;

      const word = tag.textContent.trim();
      const levelSmall = tag.parentElement.querySelector('small');
      let level = 'B1';
      let definition = '';
      if (levelSmall) {
        const text = levelSmall.textContent;
        const match = text.match(/\[(.*?)\]\s*-\s*(.*)/);
        if (match) {
          level = match[1];
          definition = match[2];
        }
      }

      const btn = document.createElement('button');
      btn.className = 'vocab-bookmark';
      btn.dataset.word = word;
      btn.dataset.level = level;
      btn.dataset.definition = definition;
      btn.title = 'Guardar para practicar';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
      tag.parentElement.appendChild(btn);
    });
  });
}

// [ADDED v3.0] Observer sobre el contenido del modal para detectar re-renderizado
let modalContentObserver = null;

function watchModalContent(modal) {
  if (modalContentObserver) {
    modalContentObserver.disconnect();
    modalContentObserver = null;
  }
  if (!modal) return;

  modalContentObserver = new MutationObserver(() => {
    injectBookmarkButtons();
  });
  modalContentObserver.observe(modal, { childList: true, subtree: true });
}

// [ADDED v3.0] Observer global en body para detectar cuando aparece el modal de análisis
const bodyObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType === 1 && node.id === 'linguistic-modal-overlay') {
        const modal = node.querySelector('#linguistic-modal');
        if (modal) {
          watchModalContent(modal);
        }
        // Intentar inyectar inmediatamente y con retraso por si el contenido se reemplaza
        injectBookmarkButtons();
        setTimeout(injectBookmarkButtons, 150);
        setTimeout(injectBookmarkButtons, 700);
        setTimeout(injectBookmarkButtons, 1500);
      }
      // Si el modal ya estaba en el DOM y se le cambió el contenido
      if (node.nodeType === 1 && node.id === 'linguistic-modal') {
        watchModalContent(node);
        injectBookmarkButtons();
      }
    }
    for (const node of m.removedNodes) {
      if (node.nodeType === 1 && node.id === 'linguistic-modal-overlay') {
        if (modalContentObserver) {
          modalContentObserver.disconnect();
          modalContentObserver = null;
        }
      }
    }
  }
});
bodyObserver.observe(document.body, { childList: true, subtree: true });

// [ADDED v3.0] Delegación de eventos para clicks en bookmark
document.body.addEventListener('click', async (e) => {
  const btn = e.target.closest('.vocab-bookmark');
  if (!btn) return;
  e.preventDefault();
  await saveWord(btn);
});

async function saveWord(btn) {
  if (btn.classList.contains('saved')) return;

  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/vocabulary/save`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        word: btn.dataset.word,
        definition: btn.dataset.definition || '',
        level: btn.dataset.level || 'B1',
        target_lang: window.currentTranslationLang || 'en'
      })
    });
    const data = await res.json();
    if (res.ok) {
      btn.classList.add('saved');
      btn.title = 'Guardado';
      window.dispatchEvent(new CustomEvent('contextia:vocabularysaved'));
      if (window.checkVisibility) {
        window.checkVisibility();
      }
    } else if (res.status === 401) {
      window.openAuthModal(() => {
        saveWord(btn);
      }, 'Guardá palabras para practicarlas después');
    }
  } catch (err) {
  }
}
