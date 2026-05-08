// [ADDED MVP-v1] Módulo de historial de traducciones
const API_BASE = 'http://localhost:8000';

// ——— Estilos ———
const historyStyles = document.createElement('style');
historyStyles.innerHTML = `
  .history-panel-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    z-index: 8000;
    display: flex;
    justify-content: flex-end;
    animation: fadeIn 0.2s ease;
  }
  .history-panel {
    background: var(--bg-secondary);
    width: min(420px, 100vw);
    height: 100vh;
    overflow-y: auto;
    border-left: 1px solid var(--border-color);
    padding: var(--space-6);
    font-family: var(--font-mono);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .history-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: var(--space-4);
  }
  .history-panel-title {
    color: var(--accent-color);
    font-size: var(--size-small);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .history-close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 22px;
    cursor: pointer;
  }
  .history-close-btn:hover { color: var(--text-primary); }
  .history-item {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    cursor: pointer;
    transition: border-color var(--transition-fast);
  }
  .history-item:hover { border-color: var(--accent-color); }
  .history-item-langs {
    font-size: var(--size-tiny);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: var(--space-1);
  }
  .history-item-original {
    font-size: var(--size-xsmall);
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .history-item-translated {
    font-size: var(--size-small);
    color: var(--text-primary);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .history-item-date {
    font-size: var(--size-tiny);
    color: var(--text-muted);
    margin-top: var(--space-1);
  }
  .history-item-badges {
    display: flex;
    gap: var(--space-1);
    margin-top: var(--space-1);
  }
  .history-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: var(--radius-full);
    background: #222;
    color: var(--text-muted);
    border: 1px solid #333;
  }
  .history-badge.has-analysis { border-color: var(--accent-color); color: var(--accent-color); }
  .history-load-more {
    background: none;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--size-xsmall);
    width: 100%;
    transition: all var(--transition-fast);
  }
  .history-load-more:hover { border-color: var(--accent-color); color: var(--accent-color); }
  .history-empty {
    text-align: center;
    color: var(--text-muted);
    font-size: var(--size-xsmall);
    padding: var(--space-8) 0;
  }
  .history-detail-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    z-index: 9000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }
  .history-detail-modal {
    background: var(--bg-secondary);
    width: min(600px, 95vw);
    max-height: 85vh;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    font-family: var(--font-mono);
  }
  .history-detail-section {
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--border-color);
  }
  .history-detail-label {
    font-size: var(--size-tiny);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: var(--space-1);
  }
  .history-detail-value {
    font-size: var(--size-small);
    color: var(--text-primary);
  }
  .history-detail-translated {
    color: var(--accent-color);
    font-size: var(--size-base);
  }
  .history-icon-btn {
    background: none;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    padding: 6px 8px;
    border-radius: var(--radius-md);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }
  .history-icon-btn:hover { border-color: var(--accent-color); color: var(--accent-color); }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .history-spinner {
    width: 24px; height: 24px;
    border: 2px solid #333;
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 40px auto;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
document.head.appendChild(historyStyles);

// ——— Inyectar botón de historial en el header (ELIMINADO - Ahora en Perfil) ———
function injectHistoryButton() {
  // No hacer nada, el botón de historial ahora vive dentro del modal de perfil
}

// ——— Panel principal de historial ———
let currentPage = 1;
let totalPages = 1;

async function openHistoryPanel() {
  const token = localStorage.getItem('contextia_token');
  if (!token) {
    window.openAuthModal(null, 'Iniciá sesión para ver tu historial');
    return;
  }
  
  if (document.getElementById('history-panel-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'history-panel-overlay';
  overlay.className = 'history-panel-overlay';
  overlay.innerHTML = `
    <div class="history-panel" id="history-panel-inner">
      <div class="history-panel-header">
        <span class="history-panel-title">Historial</span>
        <button class="history-close-btn" id="history-close-btn">&times;</button>
      </div>
      <div id="history-items-container">
        <div class="history-spinner"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  overlay.onclick = (e) => { if (e.target === overlay) closeHistoryPanel(); };
  document.getElementById('history-close-btn').onclick = closeHistoryPanel;
  
  currentPage = 1;
  await loadHistoryPage(1);
}

function closeHistoryPanel() {
  const overlay = document.getElementById('history-panel-overlay');
  if (overlay) overlay.remove();
}

async function loadHistoryPage(page) {
  const token = localStorage.getItem('contextia_token');
  const container = document.getElementById('history-items-container');
  if (!container) return;
  
  if (page === 1) {
    container.innerHTML = '<div class="history-spinner"></div>';
  }
  
  try {
    const res = await fetch(`${API_BASE}/history?page=${page}&per_page=20`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) throw new Error('Error al cargar historial');
    const data = await res.json();
    
    totalPages = data.pages || 1;
    
    if (page === 1) {
      container.innerHTML = '';
    } else {
      // Remover botón "cargar más" si existe
      const oldBtn = document.getElementById('history-load-more-btn');
      if (oldBtn) oldBtn.remove();
    }
    
    if (data.items.length === 0 && page === 1) {
      container.innerHTML = '<div class="history-empty">No hay traducciones guardadas aún.<br>Hacé una traducción para verla aquí.</div>';
      return;
    }
    
    data.items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.dataset.id = item.id;
      
      const date = new Date(item.created_at).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      
      el.innerHTML = `
        <div class="history-item-langs">${item.source_language} → ${item.target_language}</div>
        <div class="history-item-original">${escapeHtml(item.original_text)}</div>
        <div class="history-item-translated">${escapeHtml(item.translated_text)}</div>
        <div class="history-item-date">${date}</div>
        <div class="history-item-badges">
          ${item.has_analysis ? '<span class="history-badge has-analysis">Análisis</span>' : ''}
          ${item.has_audio ? '<span class="history-badge">Audio</span>' : ''}
        </div>
      `;
      
      el.onclick = () => openHistoryDetail(item.id);
      container.appendChild(el);
    });
    
    if (page < totalPages) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'history-load-more-btn';
      loadMoreBtn.className = 'history-load-more';
      loadMoreBtn.textContent = 'Cargar más...';
      loadMoreBtn.onclick = () => {
        currentPage++;
        loadHistoryPage(currentPage);
      };
      container.appendChild(loadMoreBtn);
    }
    
  } catch (err) {
    container.innerHTML = `<div class="history-empty">Error al cargar el historial.<br>${err.message}</div>`;
  }
}

// ——— Modal de detalle ———
async function openHistoryDetail(historyId) {
  const token = localStorage.getItem('contextia_token');
  
  const detailOverlay = document.createElement('div');
  detailOverlay.className = 'history-detail-overlay';
  detailOverlay.id = 'history-detail-overlay';
  detailOverlay.innerHTML = `
    <div class="history-detail-modal">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4)">
        <span style="color:var(--accent-color);font-size:var(--size-xsmall);text-transform:uppercase;letter-spacing:1px">Detalle</span>
        <button id="history-detail-close" style="background:none;border:none;color:var(--text-muted);font-size:22px;cursor:pointer">&times;</button>
      </div>
      <div class="history-spinner"></div>
    </div>
  `;
  document.body.appendChild(detailOverlay);
  
  detailOverlay.onclick = (e) => { if (e.target === detailOverlay) detailOverlay.remove(); };
  detailOverlay.querySelector('#history-detail-close').onclick = () => detailOverlay.remove();
  
  try {
    const res = await fetch(`${API_BASE}/history/${historyId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('No se pudo cargar el detalle');
    const item = await res.json();
    
    const modal = detailOverlay.querySelector('.history-detail-modal');
    let analysisHtml = '';
    if (item.analysis && typeof item.analysis === 'object') {
      const a = item.analysis;
      analysisHtml = `
        <div class="history-detail-section">
          <div class="history-detail-label">Análisis — Gramática</div>
          <div class="history-detail-value" style="font-size:var(--size-xsmall)">
            ${a.grammar?.verb_tense || ''}<br>
            <small style="color:var(--text-muted)">${a.grammar?.sentence_structure || ''}</small>
          </div>
        </div>
        ${a.translation_explanation?.grammar_rules_applied ? `
        <div class="history-detail-section">
          <div class="history-detail-label">Reglas aplicadas</div>
          <div class="history-detail-value" style="font-size:var(--size-xsmall)">${a.translation_explanation.grammar_rules_applied}</div>
        </div>` : ''}
      `;
    }
    
    const date = new Date(item.created_at).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4)">
        <span style="color:var(--accent-color);font-size:var(--size-xsmall);text-transform:uppercase;letter-spacing:1px">Detalle · ${date}</span>
        <button id="history-detail-close2" style="background:none;border:none;color:var(--text-muted);font-size:22px;cursor:pointer">&times;</button>
      </div>
      <div class="history-detail-section">
        <div class="history-detail-label">${item.source_language} (original)</div>
        <div class="history-detail-value">${escapeHtml(item.original_text)}</div>
      </div>
      <div class="history-detail-section">
        <div class="history-detail-label">${item.target_language} (traducción)</div>
        <div class="history-detail-translated">${escapeHtml(item.translated_text)}</div>
        ${item.audio_base64 ? `
          <button id="history-play-audio" class="history-icon-btn" style="margin-top:var(--space-2)" title="Reproducir">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
        ` : ''}
      </div>
      ${analysisHtml}
      <div style="display:flex;gap:var(--space-2);margin-top:var(--space-4)">
        ${!item.analysis ? `
          <button id="history-gen-analysis" class="history-icon-btn" style="font-size:var(--size-tiny);padding:6px 12px">
            + Generar análisis
          </button>
        ` : ''}
      </div>
    `;
    
    modal.querySelector('#history-detail-close2').onclick = () => detailOverlay.remove();
    
    if (item.audio_base64) {
      modal.querySelector('#history-play-audio').onclick = () => {
        try {
          const audio = new Audio(`data:audio/mp3;base64,${item.audio_base64}`);
          audio.play();
        } catch(e) {}
      };
    }
    
    // Botón para generar análisis on-demand
    const genBtn = modal.querySelector('#history-gen-analysis');
    if (genBtn) {
      genBtn.onclick = async () => {
        genBtn.textContent = 'Generando...';
        genBtn.disabled = true;
        try {
          const analysisRes = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              text: item.original_text,
              translated: item.translated_text,
              source_lang: item.source_language,
              target_lang: item.target_language
            })
          });
          const analysisData = await analysisRes.json();
          if (analysisData.success) {
            // Guardar análisis en historial
            await fetch(`${API_BASE}/history/${historyId}/analysis`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ analysis: analysisData.analysis })
            });
            genBtn.textContent = '✓ Análisis guardado';
          }
        } catch(e) {
          genBtn.textContent = 'Error';
        }
      };
    }
    
  } catch(err) {
    detailOverlay.querySelector('.history-detail-modal').innerHTML = `
      <p style="color:var(--text-muted);padding:var(--space-4)">Error: ${err.message}</p>
      <button onclick="this.closest('.history-detail-overlay').remove()" class="history-icon-btn">Cerrar</button>
    `;
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ——— Init ———
// Esperar a que el DOM esté listo con el header
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectHistoryButton);
} else {
  injectHistoryButton();
}
// Re-render cuando cambia auth
window.addEventListener('contextia:authchange', () => {
  injectHistoryButton();
  const existing = document.getElementById('history-panel-overlay');
  if (existing) existing.remove();
});

// Exponer globalmente
window.openHistoryPanel = openHistoryPanel;
