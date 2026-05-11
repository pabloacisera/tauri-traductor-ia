// [ADDED v6.0] Panel de práctica deslizable — ejercicios generados por LLM con progresión de nivel
const API_BASE = 'http://localhost:8000';

window.addEventListener('error', (e) => {
  console.error('[Practice] Uncaught:', e.message, 'at', e.filename + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Practice] Unhandled rejection:', e.reason);
});

function getToken() {
  return localStorage.getItem('contextia_token');
}

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
  const token = getToken();
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  }
  const seed = await getDeviceSeed();
  if (seed) {
    h['X-Device-Seed'] = seed;
  }
  return h;
}

let currentExercise = null;
let currentLevel = 'A1';
let hasWords = false;

let selectedLang = null;        // idioma elegido para ejercicios
let enabledLanguages = [];      // idiomas habilitados (con palabras guardadas)

const LANG_NAMES = {
  en: 'Inglés', es: 'Español', pt: 'Portugués',
  it: 'Italiano', ru: 'Ruso', zh: 'Chino', ja: 'Japonés'
};

const LEVELS_BY_LANG = {
  en: ['A1','A2','B1','B2','C1','C2'],
  es: ['A1','A2','B1','B2','C1','C2'],
  pt: ['A1','A2','B1','B2','C1','C2'],
  it: ['A1','A2','B1','B2','C1','C2'],
  ru: ['A1','A2','B1','B2','C1','C2'],
  zh: ['HSK1','HSK2','HSK3','HSK4','HSK5','HSK6'],
  ja: ['N5','N4','N3','N2','N1'],
};

// [ADDED v6.0] Inyectar HTML del panel en el body
document.body.insertAdjacentHTML('beforeend', `
<!-- [ADDED v8.0] Barra de pestañas inferiores -->
<div id="bottom-tabs-bar" class="bottom-tabs-bar">
  <button class="bottom-tab" id="tab-exercises" data-panel="exercises">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
    <span>Ejercicios</span>
    <span class="tab-badge" id="tab-exercises-badge">A1</span>
  </button>
  <button class="bottom-tab" id="tab-vocabulary" data-panel="vocabulary">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
    <span>Vocabulario</span>
    <span class="tab-badge tab-badge-count hidden" id="tab-vocab-count">0</span>
  </button>
  <button class="bottom-tab" id="tab-metrics" data-panel="metrics">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    <span>Métricas</span>
  </button>
</div>

<div id="practice-panel" class="practice-panel">
  <div class="practice-panel-header">
    <div class="practice-level-track" id="practice-level-track">
      <!-- A1 → A2 → [B1] → B2 → C1 renderizado dinámicamente -->
    </div>
    <div class="practice-progress-bar">
      <div class="progress-fill" id="practice-progress-fill" style="width:0%"></div>
    </div>
    <button id="btn-metrics" class="practice-metrics-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
      Ver métricas
    </button>
    <button id="btn-close-practice">&times;</button>
  </div>

  <div id="practice-exercise-area">
    <!-- ejercicio activo o estado vacío -->
  </div>
</div>

<div id="vocabulary-panel" class="practice-panel">
  <div class="practice-panel-header">
    <span style="font-weight:600;font-size:var(--size-small)">Vocabulario guardado</span>
    <button id="btn-close-vocabulary">&times;</button>
  </div>
  <div id="vocabulary-panel-content" style="padding:var(--space-4);overflow-y:auto;flex:1">
    <div class="practice-spinner"></div>
  </div>
</div>
`);

// [ADDED v8.0] Referencias a elementos del DOM (después de inyectar HTML)
const panel = document.getElementById('practice-panel');
const area = document.getElementById('practice-exercise-area');
const levelTrack = document.getElementById('practice-level-track');
const progressFill = document.getElementById('practice-progress-fill');
const badgeLevel = document.getElementById('tab-exercises-badge');

// [ADDED v8.0] Verificar visibilidad y actualizar badges
async function checkVisibility() {
  const token = getToken();
  const headers = await authHeaders();

  try {
    const res = await fetch(`${API_BASE}/vocabulary/list?limit=1`, { headers });
    const data = await res.json();
    const total = data.total ?? 0;
    const countBadge = document.getElementById('tab-vocab-count');
    if (total > 0) {
      countBadge.textContent = total;
      countBadge.classList.remove('hidden');
    } else {
      countBadge.classList.add('hidden');
    }
  } catch(e) {}

  if (!token) {
    document.getElementById('tab-exercises-badge').textContent = 'A1';
    return;
  }

  try {
    const mres = await fetch(`${API_BASE}/metrics/summary${selectedLang ? '?language='+selectedLang : ''}`, { headers });
    const mdata = await mres.json();
    if (mdata.current_level && selectedLang) {
      currentLevel = mdata.current_level;
      document.getElementById('tab-exercises-badge').textContent = mdata.current_level;
      updateLevelUI(mdata.current_level, selectedLang);
    }
  } catch(e) {}
}

function updateLevelUI(level, lang) {
  const langKey = lang || selectedLang || 'en';
  const levels = LEVELS_BY_LANG[langKey] || ['A1','A2','B1','B2','C1','C2'];
  
  levelTrack.innerHTML = levels.map(l => {
    const cls = l === level ? 'level-dot current' : 'level-dot inactive';
    return `<span class="${cls}">${l}</span>`;
  }).join('<span style="color:var(--text-muted)">→</span>');

  const idx = levels.indexOf(level);
  const pct = Math.round(((idx + 1) / levels.length) * 100);
  progressFill.style.width = `${pct}%`;
}

async function fetchEnabledLanguages() {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/metrics/languages`, { headers });
    const data = await res.json();
    enabledLanguages = data.languages || [];
    return enabledLanguages;
  } catch(e) {
    enabledLanguages = [];
    return [];
  }
}

async function showLanguageSelector() {
  area.innerHTML = '<div style="text-align:center;padding:var(--space-8) 0"><div class="practice-spinner"></div></div>';
  await fetchEnabledLanguages();
  
  if (enabledLanguages.length === 0) {
    area.innerHTML = '<div class="practice-empty-state">No tenés palabras guardadas. Guardá palabras desde el análisis lingüístico para habilitar ejercicios.</div>';
    return;
  }
  
  // Mostrar selector
  const options = enabledLanguages.map(l => {
    const isActive = l.language === selectedLang;
    const level = l.current_level || (LEVELS_BY_LANG[l.language] || ['A1'])[0];
    return `
      <button class="lang-select-btn ${isActive ? 'lang-select-active' : ''}" data-lang="${l.language}">
        <span>${LANG_NAMES[l.language] || l.language}</span>
        <span class="lang-select-meta">${l.total_words} palabras · ${level}</span>
      </button>
    `;
  }).join('');
  
  area.innerHTML = `
    <div class="lang-selector-container">
      <div class="lang-selector-title">¿En qué idioma querés practicar?</div>
      <div class="lang-selector-options">${options}</div>
    </div>
  `;
  
  area.querySelectorAll('.lang-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedLang = btn.dataset.lang;
      const langData = enabledLanguages.find(l => l.language === selectedLang);
      const levels = LEVELS_BY_LANG[selectedLang] || ['A1','A2','B1','B2','C1','C2'];
      updateLevelUI(langData?.current_level || levels[0], selectedLang);
      loadExercise();
    });
  });

  // Click en el título del selector -> vuelve a mostrar opciones
  const title = area.querySelector('.lang-selector-title');
  if (title) {
    title.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

// [ADDED v8.0] Handlers de tabs
async function handleTabClick(panelName) {
  const token = getToken();
  if (!token) {
    const seed = await getDeviceSeed();
    if (!seed) {
      window.openAuthModal(() => {
        checkVisibility().then(() => openPanelByName(panelName));
      }, 'Iniciá sesión para acceder a esta función');
      return;
    }
  }
  openPanelByName(panelName);
}

function openPanelByName(name) {
  closeAllPanels();
  if (name === 'exercises') {
    panel.classList.add('open');
    if (!currentExercise) {
      if (!selectedLang) {
        showLanguageSelector();
      } else {
        loadExercise();
      }
    }
  } else if (name === 'vocabulary') {
    document.getElementById('vocabulary-panel').classList.add('open');
    loadVocabularyPanel();
  } else if (name === 'metrics') {
    if (window.openMetricsModal) window.openMetricsModal();
  }
}

function closeAllPanels() {
  panel.classList.remove('open');
  const vp = document.getElementById('vocabulary-panel');
  if (vp) vp.classList.remove('open');
}

document.getElementById('tab-exercises').onclick = () => handleTabClick('exercises');
document.getElementById('tab-vocabulary').onclick = () => {
  checkVisibility();
  handleTabClick('vocabulary');
};
document.getElementById('tab-metrics').onclick = () => handleTabClick('metrics');

document.getElementById('btn-close-practice').onclick = () => {
  panel.classList.remove('open');
};

document.getElementById('btn-close-vocabulary').onclick = () => {
  document.getElementById('vocabulary-panel').classList.remove('open');
};

// Cerrar al hacer click fuera
document.addEventListener('click', (e) => {
  const tabsBar = document.getElementById('bottom-tabs-bar');
  if (panel.classList.contains('open') && !panel.contains(e.target) && !tabsBar.contains(e.target)) {
    panel.classList.remove('open');
  }
  const vp = document.getElementById('vocabulary-panel');
  if (vp && vp.classList.contains('open') && !vp.contains(e.target) && !tabsBar.contains(e.target)) {
    vp.classList.remove('open');
  }
});

// [ADDED v6.0] Botón métricas
document.getElementById('btn-metrics').onclick = () => {
  if (window.openMetricsModal) window.openMetricsModal();
};

// [ADDED v6.0] Cargar ejercicio desde el backend
async function loadExercise() {
  area.innerHTML = '<div style="text-align:center;padding:var(--space-8) 0"><div class="practice-spinner"></div></div>';
  try {
    const token = getToken();
    const headers = await authHeaders();
    const endpoint = token ? `${API_BASE}/exercises/request` : `${API_BASE}/exercises/request-anonymous`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ language: selectedLang || 'en' })
    });
    const data = await res.json();

    if (typeof window.updateAnonymousExercisesCounter === 'function' && !token) {
      if (data.exercises_remaining != null) {
        window.updateAnonymousExercisesCounter(data.exercises_remaining);
      }
    }

    if (!res.ok) {
      let msg = data.detail;
      if (typeof msg === 'object' && msg !== null) {
        msg = msg.message || msg.error || JSON.stringify(msg);
      }
      if (res.status === 429) {
        area.innerHTML = `
          <div class="practice-empty-state">${msg || 'Alcanzaste tu límite de ejercicios gratuitos. Registrate para acceder a ejercicios ilimitados.'}</div>
          <div class="practice-lang-switcher" id="practice-lang-switcher" style="text-align:center;margin-top:var(--space-6)">
            <div class="practice-lang-buttons" id="practice-lang-buttons"></div>
          </div>
        `;
        if (typeof window.updateAnonymousExercisesCounter === 'function') {
          window.updateAnonymousExercisesCounter(0);
        }
        renderLangSwitcher();
      } else {
        area.innerHTML = `<div class="practice-empty-state">${msg || 'No se pudo cargar el ejercicio.'}</div>`;
      }
      return;
    }
    currentExercise = data.exercise;
    if (data.blocked) {
      renderExercise(currentExercise, true);
    } else {
      renderExercise(currentExercise, false);
    }
  } catch (e) {
    area.innerHTML = '<div class="practice-empty-state">Error de conexión. Intentá de nuevo.</div>';
  }
}

function renderExercise(ex, isBlocked) {
  const hasSpeech = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  area.innerHTML = `
    <div class="practice-exercise-content">${escapeHtml(ex.content)}</div>
    ${ex.hint ? `<div class="practice-hint">${escapeHtml(ex.hint)}</div>` : ''}
    <div class="practice-input-row">
      <input type="text" id="practice-answer" placeholder="Escribí tu respuesta..." autocomplete="off" />
      ${hasSpeech ? `
        <button class="practice-mic-btn" id="practice-mic" title="Dictar respuesta">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
        </button>
      ` : ''}
      <button class="practice-submit-btn" id="practice-submit">Enviar</button>
    </div>
    <div class="practice-lang-switcher" id="practice-lang-switcher" style="text-align:center;margin-top:var(--space-6)">
      <div class="practice-lang-buttons" id="practice-lang-buttons"></div>
    </div>
  `;

  renderLangSwitcher();

  const input = area.querySelector('#practice-answer');
  const submitBtn = area.querySelector('#practice-submit');
  const micBtn = area.querySelector('#practice-mic');

  submitBtn.onclick = () => submitAnswer(ex.id, input.value);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitAnswer(ex.id, input.value);
  });

  if (micBtn) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = selectedLang || 'en';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    micBtn.onclick = () => {
      if (micBtn.classList.contains('recording')) {
        recognition.stop();
        micBtn.classList.remove('recording');
      } else {
        try {
          recognition.start();
          micBtn.classList.add('recording');
        } catch (err) {
          micBtn.classList.remove('recording');
        }
      }
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      input.value = transcript;
      micBtn.classList.remove('recording');
    };
    recognition.onerror = () => {
      micBtn.classList.remove('recording');
    };
    recognition.onend = () => {
      micBtn.classList.remove('recording');
    };
  }
}

async function submitAnswer(exerciseId, answer) {
  if (!answer.trim()) return;
  const btn = area.querySelector('#practice-submit');
  if (btn) btn.disabled = true;

  // Guardar snapshot del ejercicio actual ANTES de que renderFeedback limpie currentExercise
  // Esto permite al botón "Reintentar" volver a mostrar el mismo ejercicio sin llamar al backend
  const exerciseSnapshot = currentExercise;

  try {
    const token = getToken();
    const headers = await authHeaders();
    const endpoint = token ? `${API_BASE}/exercises/submit` : `${API_BASE}/exercises/submit-anonymous`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        exercise_id: exerciseId,
        answer: answer.trim(),
        answer_type: 'text',
        language: selectedLang || 'en'
      })
    });
    const data = await res.json();
    if (!res.ok) {
      if (btn) btn.disabled = false;
      return;
    }
    // Actualizar contador anónimo si el submit devuelve exercises_remaining
    if (typeof window.updateAnonymousExercisesCounter === 'function' && !token) {
      if (data.exercises_remaining != null) {
        window.updateAnonymousExercisesCounter(data.exercises_remaining);
      }
    }
    renderFeedback(data, exerciseSnapshot);
  } catch (e) {
    if (btn) btn.disabled = false;
  }
}

function renderFeedback(data, exerciseSnapshot) {
  // Guardar referencia al ejercicio fallido antes de limpiar currentExercise
  const failedExercise = (data.status !== 'passed') ? (exerciseSnapshot || currentExercise) : null;
  currentExercise = null;

  const passed = data.status === 'passed';
  // Color del score según resultado
  const scoreColor = passed
    ? 'var(--accent-color)'
    : (data.score >= 50 ? '#f0a500' : '#e05555');

  area.innerHTML = `
    <div class="practice-feedback">
      <div class="practice-feedback-score" style="color:${scoreColor}">${data.score}</div>
      <div class="practice-feedback-text">${escapeHtml(data.feedback)}</div>
      ${data.level_changed ? `<div style="color:var(--accent-color);margin-top:var(--space-2);font-weight:600;">¡Nivel actualizado a ${data.new_level}!</div>` : ''}
      ${passed
        ? `<button class="practice-next-btn" id="practice-next">Siguiente ejercicio →</button>`
        : `<button class="practice-next-btn practice-retry-btn" id="practice-retry">Reintentar ejercicio</button>`
      }
    </div>
    <div class="practice-lang-switcher" id="practice-lang-switcher" style="text-align:center;margin-top:var(--space-6)">
      <div class="practice-lang-buttons" id="practice-lang-buttons"></div>
    </div>
  `;

  // Renderizar switcher de idiomas para cambiar entre idiomas habilitados
  renderLangSwitcher();

  if (data.level_changed && data.new_level) {
    currentLevel = data.new_level;
    updateLevelUI(currentLevel, selectedLang);
    document.getElementById('tab-exercises').classList.add('level-change-animation');
    setTimeout(() => document.getElementById('tab-exercises').classList.remove('level-change-animation'), 700);
  }

  if (passed) {
    const nextBtn = area.querySelector('#practice-next');
    if (nextBtn) {
      // CRÍTICO: usar addEventListener con stopPropagation, NO onclick
      // Sin stopPropagation el click sube al listener del document que cierra el panel
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        loadExercise();
      });
    }
  } else {
    // Si el score no alcanzó el mínimo, mostrar el mismo ejercicio para reintentar
    // No se llama al backend, se reutiliza el objeto ejercicio del snapshot
    const retryBtn = area.querySelector('#practice-retry');
    if (retryBtn && failedExercise) {
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentExercise = failedExercise;
        renderExercise(failedExercise, false);
      });
    }
  }
}

async function renderLangSwitcher() {
  const container = document.getElementById('practice-lang-switcher');
  const buttonsContainer = document.getElementById('practice-lang-buttons');
  if (!container || !buttonsContainer) return;

  await fetchEnabledLanguages();
  const currentLang = enabledLanguages.find(l => l.language === selectedLang);
  const otherLangs = enabledLanguages.filter(l => l.language !== selectedLang);

  if (enabledLanguages.length <= 1) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  const allLangs = [currentLang, ...otherLangs].filter(Boolean);
  buttonsContainer.innerHTML = allLangs.map(l => {
    const level = l.current_level || (LEVELS_BY_LANG[l.language] || ['A1'])[0];
    const isActive = l.language === selectedLang;
    return `
      <button class="lang-switch-btn ${isActive ? 'lang-switch-active' : ''}" data-lang="${l.language}">
        ${LANG_NAMES[l.language] || l.language}
        <span class="lang-switch-meta">${level}</span>
      </button>
    `;
  }).join('');

  buttonsContainer.querySelectorAll('.lang-switch-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedLang = btn.dataset.lang;
      currentExercise = null;
      const langData = enabledLanguages.find(l => l.language === selectedLang);
      updateLevelUI(langData?.current_level || 'A1', selectedLang);
      loadExercise();
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// [ADDED v8.0] Cargar panel de vocabulario
async function loadVocabularyPanel() {
  const content = document.getElementById('vocabulary-panel-content');
  content.innerHTML = '<div class="practice-spinner" style="margin:var(--space-8) auto"></div>';
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/vocabulary/list?limit=100`, { headers });
    const data = await res.json();
    const words = data.words || [];
    if (words.length === 0) {
      ctx_showEmptyVocabGuide();
      content.innerHTML = '<div class="practice-empty-state">No tenés palabras guardadas todavía. Guardá palabras desde el análisis lingüístico.</div>';
      return;
    }
    const LANG_DISPLAY = { en:'Inglés', es:'Español', pt:'Portugués', it:'Italiano', ru:'Ruso', zh:'Chino', ja:'Japonés' };
    const LEVEL_ORDER = ['A1','A2','B1','B2','C1','C2','HSK1','HSK2','HSK3','HSK4','HSK5','HSK6','N5','N4','N3','N2','N1'];

    // Primer nivel: idioma. Segundo nivel: nivel CEFR/HSK/JLPT
    const byLang = {};
    words.forEach(w => {
      const lang = w.target_lang || 'en';
      if (!byLang[lang]) byLang[lang] = {};
      if (!byLang[lang][w.level]) byLang[lang][w.level] = [];
      byLang[lang][w.level].push(w);
    });

    let html = '';
    Object.keys(byLang).sort().forEach(lang => {
      const langLabel = LANG_DISPLAY[lang] || lang.toUpperCase();
      const totalWords = Object.values(byLang[lang]).flat().length;
      html += `
        <div class="vocab-lang-group" style="margin-bottom:var(--space-6)">
          <div class="vocab-lang-header" style="
            font-size:var(--size-small);
            font-weight:700;
            color:var(--text-primary);
            text-transform:uppercase;
            letter-spacing:.1em;
            padding:var(--space-2) var(--space-3);
            background:var(--bg-tertiary);
            border-radius:var(--radius-md);
            border:1px solid var(--border-color);
            margin-bottom:var(--space-3);
            display:flex;
            align-items:center;
            gap:var(--space-2);
          ">
            <span style="color:var(--accent-color)">⬤</span>
            ${langLabel}
            <span style="font-weight:400;font-size:var(--size-tiny);color:var(--text-muted);margin-left:auto">
              ${totalWords} palabras
            </span>
          </div>
      `;

      LEVEL_ORDER.forEach(lvl => {
        if (!byLang[lang][lvl]?.length) return;
        html += `<div class="vocab-level-group"><div class="vocab-level-header">${lvl}</div>`;
        byLang[lang][lvl].forEach(w => {
          const score = w.last_score != null ? `· ${w.last_score}pts` : '';
          html += `
            <div class="vocab-word-row">
              <div>
                <span class="vocab-word-name">${escapeHtml(w.word)}</span>
                <span class="vocab-word-meta"> ${score}</span>
              </div>
              <div class="vocab-word-def">${escapeHtml(w.definition)}</div>
            </div>
          `;
        });
        html += `</div>`;
      });

      html += `</div>`;
    });
    content.innerHTML = html;
  } catch(e) {
    content.innerHTML = '<div class="practice-empty-state">Error cargando vocabulario.</div>';
  }
}

// [ADDED v6.0] Reaccionar a cambios de autenticación y vocabulario guardado
window.addEventListener('contextia:authchange', () => {
  selectedLang = null;
  currentExercise = null;
  checkVisibility();
});
window.addEventListener('contextia:vocabularysaved', checkVisibility);

// Verificar visibilidad al cargar
checkVisibility();

// ─── Fix 2: Guía de vocabulario vacío ───
function ctx_showEmptyVocabGuide() {
    const guideHtml = `
        <div class="auth-modal-overlay" id="guide-modal">
            <div class="auth-modal">
                <button class="auth-close" onclick="document.getElementById('guide-modal').remove()">&times;</button>
                <h2>¡Empezá a practicar!</h2>
                <p style="margin-bottom: 15px; color: var(--text-secondary);">Para generar ejercicios primero necesitás palabras en tu vocabulario:</p>
                <ol style="color: var(--text-primary); padding-left: 20px; line-height: 1.6;">
                    <li>Traducí cualquier frase.</li>
                    <li>Hacé click en <b>"Análisis Lingüístico"</b>.</li>
                    <li>Marcá el icono de <b>Bookmark (marcador)</b> en las palabras que quieras aprender.</li>
                </ol>
                <button class="auth-submit" style="margin-top:20px" onclick="document.getElementById('guide-modal').remove()">Entendido</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', guideHtml);
}
