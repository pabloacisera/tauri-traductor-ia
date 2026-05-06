// [ADDED v6.0] Panel de práctica deslizable — ejercicios generados por LLM con progresión de nivel
const API_BASE = 'http://localhost:8000';

function getToken() {
  return localStorage.getItem('contextia_token');
}

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// [ADDED v6.0] Inyectar HTML del panel en el body
document.body.insertAdjacentHTML('beforeend', `
<!-- [ADDED v6.0] Panel de práctica deslizable — se inyecta en body, no interfiere con el traductor -->
<div id="practice-tab-trigger" class="practice-tab-trigger hidden">
  <span class="practice-tab-label">Práctica</span>
  <span class="practice-level-badge" id="practice-badge-level">A1</span>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
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
`);

const trigger = document.getElementById('practice-tab-trigger');
const panel = document.getElementById('practice-panel');
const area = document.getElementById('practice-exercise-area');
const levelTrack = document.getElementById('practice-level-track');
const progressFill = document.getElementById('practice-progress-fill');
const badgeLevel = document.getElementById('practice-badge-level');

let currentExercise = null;
let currentLevel = 'A1';
let hasWords = false;

// [ADDED v6.0] Verificar si debe mostrarse la pestaña
async function checkVisibility() {
  const token = getToken();
  if (!token) {
    trigger.classList.add('hidden');
    panel.classList.remove('open');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/vocabulary/list?limit=1`, { headers: authHeaders() });
    const data = await res.json();
    hasWords = Array.isArray(data) && data.length > 0;
    if (hasWords) {
      trigger.classList.remove('hidden');
      // Actualizar nivel desde métricas
      const mres = await fetch(`${API_BASE}/metrics/summary`, { headers: authHeaders() });
      const mdata = await mres.json();
      if (mdata.current_level) {
        currentLevel = mdata.current_level;
        updateLevelUI(currentLevel);
      }
    } else {
      trigger.classList.add('hidden');
    }
  } catch (e) {
    trigger.classList.add('hidden');
  }
}

function updateLevelUI(level) {
  const levels = ['A1','A2','B1','B2','C1','C2'];
  badgeLevel.textContent = level;
  levelTrack.innerHTML = levels.map(l => {
    const cls = l === level ? 'level-dot current' : 'level-dot inactive';
    return `<span class="${cls}">${l}</span>`;
  }).join('<span style="color:var(--text-muted)">→</span>');

  const idx = levels.indexOf(level);
  const pct = Math.round(((idx + 1) / levels.length) * 100);
  progressFill.style.width = `${pct}%`;
}

// [ADDED v6.0] Abrir/cerrar panel
trigger.onclick = () => {
  const token = getToken();
  if (!token) {
    window.openAuthModal(() => {
      checkVisibility().then(() => openPanel());
    }, 'Iniciá sesión para practicar vocabulario');
    return;
  }
  openPanel();
};

function openPanel() {
  panel.classList.add('open');
  if (!currentExercise) {
    loadExercise();
  }
}

document.getElementById('btn-close-practice').onclick = () => {
  panel.classList.remove('open');
};

// Cerrar al hacer click fuera
document.addEventListener('click', (e) => {
  if (panel.classList.contains('open') && !panel.contains(e.target) && !trigger.contains(e.target)) {
    panel.classList.remove('open');
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
    const res = await fetch(`${API_BASE}/exercises/request`, {
      method: 'POST',
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) {
      area.innerHTML = `<div class="practice-empty-state">${data.detail || 'No se pudo cargar el ejercicio.'}</div>`;
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
  `;

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
    recognition.lang = window.currentTranslationLang || 'en';
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

  try {
    const res = await fetch(`${API_BASE}/exercises/submit`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ exercise_id: exerciseId, answer: answer.trim(), answer_type: 'text' })
    });
    const data = await res.json();
    if (!res.ok) {
      if (btn) btn.disabled = false;
      return;
    }
    renderFeedback(data);
  } catch (e) {
    if (btn) btn.disabled = false;
  }
}

function renderFeedback(data) {
  currentExercise = null;
  area.innerHTML = `
    <div class="practice-feedback">
      <div class="practice-feedback-score">${data.score}</div>
      <div class="practice-feedback-text">${escapeHtml(data.feedback)}</div>
      ${data.level_changed ? `<div style="color:var(--accent-color);margin-top:var(--space-2);font-weight:600;">¡Nivel actualizado a ${data.new_level}!</div>` : ''}
      <button class="practice-next-btn" id="practice-next" ${data.status !== 'passed' ? 'disabled' : ''}>
        ${data.status === 'passed' ? 'Siguiente ejercicio' : 'Reintentar después'}
      </button>
    </div>
  `;

  if (data.level_changed && data.new_level) {
    currentLevel = data.new_level;
    updateLevelUI(currentLevel);
    trigger.classList.add('level-change-animation');
    setTimeout(() => trigger.classList.remove('level-change-animation'), 700);
  }

  const nextBtn = area.querySelector('#practice-next');
  if (nextBtn && !nextBtn.disabled) {
    nextBtn.onclick = () => loadExercise();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// [ADDED v6.0] Reaccionar a cambios de autenticación y vocabulario guardado
window.addEventListener('contextia:authchange', checkVisibility);
window.addEventListener('contextia:vocabularysaved', checkVisibility);

// Verificar visibilidad al cargar
checkVisibility();
