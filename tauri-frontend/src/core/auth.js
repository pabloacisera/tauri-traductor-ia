// [ADDED v7.0] Módulo de autenticación — modal login/registro y toast de límite
const API_BASE = 'http://localhost:8000';

// [ADDED v7.0] Utilidades de token
function getToken() {
  return localStorage.getItem('contextia_token');
}
function getUserId() {
  return localStorage.getItem('contextia_user_id');
}
function getAnonymousId() {
  let aid = localStorage.getItem('contextia_anon_id');
  if (!aid) {
    aid = crypto.randomUUID();
    localStorage.setItem('contextia_anon_id', aid);
  }
  return aid;
}
function isAuthenticated() {
  return !!getToken();
}

// [ADDED v7.0] Headers comunes para fetch
function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  } else {
    h['X-Anonymous-ID'] = getAnonymousId();
  }
  return h;
}

// [ADDED v7.0] Exponer utilidades globales para otros módulos
window.contextiaAuth = {
  getToken,
  getUserId,
  getAnonymousId,
  isAuthenticated,
  authHeaders
};

// [ADDED v7.0] Crear y mostrar modal de autenticación
let authCallback = null;
window.openAuthModal = function(callback, message) {
  authCallback = callback || null;

  if (document.getElementById('auth-modal-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'auth-modal-overlay';
  overlay.className = 'auth-modal-overlay';
  overlay.innerHTML = `
    <div class="auth-modal">
      <button class="auth-close" id="auth-close-btn">&times;</button>
      <h2>${message || 'Accedé a tu cuenta'}</h2>
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">Iniciar sesión</button>
        <button class="auth-tab" data-tab="register">Registrarse</button>
      </div>
      <form class="auth-form" id="auth-form">
        <label>Email</label>
        <input type="email" id="auth-email" placeholder="tu@email.com" required />
        <label>Contraseña</label>
        <input type="password" id="auth-password" placeholder="••••••••" required />
        <div class="auth-error" id="auth-error"></div>
        <button type="submit" class="auth-submit" id="auth-submit">Iniciar sesión</button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const closeModal = () => {
    overlay.remove();
    authCallback = null;
  };

  overlay.querySelector('#auth-close-btn').onclick = closeModal;
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

  const tabs = overlay.querySelectorAll('.auth-tab');
  const form = overlay.querySelector('#auth-form');
  const submitBtn = overlay.querySelector('#auth-submit');
  const errorDiv = overlay.querySelector('#auth-error');

  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      submitBtn.textContent = tab.dataset.tab === 'login' ? 'Iniciar sesión' : 'Registrarse';
      errorDiv.textContent = '';
    };
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    errorDiv.textContent = '';
    const email = form.querySelector('#auth-email').value.trim();
    const password = form.querySelector('#auth-password').value;
    const mode = overlay.querySelector('.auth-tab.active').dataset.tab;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Procesando...';

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error en la autenticación');
      }
      localStorage.setItem('contextia_token', data.token);
      localStorage.setItem('contextia_user_id', data.user_id);
      localStorage.setItem('contextia_user_email', email);
      closeModal();
      if (authCallback) authCallback();
      // [ADDED v7.0] Notificar a otros módulos que el auth cambió
      window.dispatchEvent(new Event('contextia:authchange'));
    } catch (err) {
      errorDiv.textContent = err.message;
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'login' ? 'Iniciar sesión' : 'Registrarse';
    }
  };
};

// [ADDED v7.0] Toast de límite de traducciones para anónimos
function showAnonymousToast() {
  if (document.getElementById('contextia-toast')) return;
  const toast = document.createElement('div');
  toast.id = 'contextia-toast';
  toast.className = 'contextia-toast';
  toast.innerHTML = `
    ⚠ Modo sin cuenta: 5 traducciones gratuitas · 
    <a id="toast-register-link">Registrate</a> para acceder a 15 traducciones/día
  `;
  document.body.appendChild(toast);

  toast.querySelector('#toast-register-link').onclick = () => {
    window.openAuthModal();
  };

  setTimeout(() => {
    toast.style.animation = 'toastFadeOut 0.4s ease forwards';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function showLimitToast(msg) {
  if (document.getElementById('contextia-toast')) return;
  const toast = document.createElement('div');
  toast.id = 'contextia-toast';
  toast.className = 'contextia-toast';
  toast.innerHTML = `🚫 ${msg}`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastFadeOut 0.4s ease forwards';
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

// [ADDED v7.0] Al cargar la app: mostrar toast si no está autenticado (solo 1 vez cada 24h)
if (!isAuthenticated()) {
  const lastShown = localStorage.getItem('contextia_toast_shown');
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  if (!lastShown || (now - parseInt(lastShown)) > oneDay) {
    showAnonymousToast();
    localStorage.setItem('contextia_toast_shown', now.toString());
  }
}

// [ADDED v8.0] Cargar contadores de anónimos al iniciar
async function loadAnonymousCounters() {
  if (isAuthenticated()) return;
  try {
    const { getClientSeed } = await import('../utils/device.js');
    const seed = await getClientSeed();
    if (!seed) return;

    const res = await fetch(`${API_BASE}/subscription/anonymous-status`, {
      headers: {
        'X-Device-Seed': seed,
        'X-Anonymous-ID': getAnonymousId()
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.translations_remaining != null) {
        updateAnonymousCounter(data.translations_remaining);
      }
      if (data.exercises_remaining != null) {
        updateAnonymousExercisesCounter(data.exercises_remaining);
      }
    }
  } catch(e) {}
}

loadAnonymousCounters();

// [ADDED v2.0] Interceptar fetch para usar /translate/tracked y enviar headers de anonimato sin modificar sendTextToTranslate.js
const _originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
  let actualUrl = url;
  if (typeof url === 'string' && url === `${API_BASE}/translate`) {
    actualUrl = `${API_BASE}/translate/tracked`;
  }
  let headers = options.headers || {};
  if (headers instanceof Headers) {
    const plain = {};
    headers.forEach((v, k) => plain[k] = v);
    headers = plain;
  }
  if (!headers['Authorization'] && !headers['X-Anonymous-ID']) {
    headers['X-Anonymous-ID'] = getAnonymousId();
  }
  // Enviar device seed para tracking de anonymous
  if (typeof url === 'string' && url.includes('/translate') && !getToken()) {
    try {
      const { getClientSeed } = await import('../utils/device.js');
      const seed = await getClientSeed();
      headers['X-Device-Seed'] = seed;
    } catch(e) {}
  }
  const fetchResult = await _originalFetch(actualUrl, { ...options, headers });

  if (typeof url === 'string' && url.includes('/translate') && !getToken()) {
    const clone = fetchResult.clone();
    clone.json().then(data => {
      if (data && typeof data.translations_remaining === 'number') {
        updateAnonymousCounter(data.translations_remaining);
      }
      if (!fetchResult.ok && fetchResult.status === 429) {
        const detail = data?.detail;
        const msg = typeof detail === 'object' && detail !== null
          ? (detail.message || detail.error || JSON.stringify(detail))
          : (detail || 'Alcanzaste tu límite de traducciones gratuitas.');
        showLimitToast(msg);
      }
    }).catch(() => {});
  }

  return fetchResult;
};

// [ADDED v8.0] Contador de traducciones para usuarios anónimos
function updateAnonymousCounter(remaining) {
  const slot = document.getElementById('anon-counter-slot');
  if (!slot) return;
  if (!isAuthenticated()) {
    const text = remaining === 1
      ? `${remaining} traducción restante`
      : `${remaining} traducciones restantes`;
    slot.textContent = text;
    slot.className = `anon-counter-slot ${remaining <= 2 ? 'anon-counter-low' : ''}`;
  } else {
    slot.textContent = '';
    slot.className = '';
  }
}

function updateAnonymousExercisesCounter(remaining) {
  const slot = document.getElementById('anon-exercises-counter-slot');
  if (!slot) return;
  if (!isAuthenticated()) {
    const text = remaining === 1
      ? `${remaining} ejercicio restante`
      : `${remaining} ejercicios restantes`;
    slot.textContent = text;
    slot.className = `anon-counter-slot ${remaining <= 2 ? 'anon-counter-low' : ''}`;
  } else {
    slot.textContent = '';
    slot.className = '';
  }
}

// Exponer a window para que main.js (SSE) y practice.js puedan llamarlas
window.updateAnonymousCounter = updateAnonymousCounter;
window.updateAnonymousExercisesCounter = updateAnonymousExercisesCounter;

function showLimitReachedModal() {
  if (document.getElementById('limit-reached-overlay')) return;
  window.openAuthModal(null, '🚫 Límite diario alcanzado. Registrate para traducciones ilimitadas');
}
