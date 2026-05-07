import { addListener } from './core/listenerManager.js';
import './core/analyze.js';
import './style.css';
import './style_additions.css';
import { setupTextareaForceEnd } from './utils/textareaAlignCursor.js';

// [ADDED v1.0] Importar módulos nuevos — no modifica el traductor existente
import './core/auth.js';
import './core/vocabulary.js';
import './core/practice.js';
import './core/metrics.js';

document.querySelector('#app').innerHTML = `
<header id="app-header">
  <div class="header-logo">Context<span>IA</span></div>
  <div class="header-session" id="header-session">
    <!-- se rellena por JS después -->
  </div>
</header>
<section id="center">
  <div class="options-banner">
    <label for="select-list-language">seleccione un lenguaje de traducción</label>
    <select id="list" name="select-list-language">
      <option value="es">Español</option>
      <option value="en">Inglés</option>
      <option value="ru">Ruso</option>
      <option value="pt">Portugués</option>
      <option value="it">Italiano</option>
      <option value="zh">Chino</option>
      <option value="ja">Japonés</option>
    </select>
  </div>

  <div class="translator-layout">
    <!-- Columna izquierda: Input -->
    <div class="input-column">
      <div class="input-text-area">
        <textarea class="js-input-target" placeholder="Escribe el texto o frase a traducir..."></textarea>
        <button class="clear-input-button" title="Limpiar texto">
          <svg viewBox="0 -960 960 960"><path d="M440-520h80v-280q0-17-11.5-28.5T480-840q-17 0-28.5 11.5T440-800v280ZM200-360h560v-80H200v80Zm-58 240h98v-80q0-17 11.5-28.5T280-240q17 0 28.5 11.5T320-200v80h120v-80q0-17 11.5-28.5T480-240q17 0 28.5 11.5T520-200v80h120v-80q0-17 11.5-28.5T680-240q17 0 28.5 11.5T720-200v80h98l-40-160H182l-40 160Zm676 80H142q-39 0-63-31t-14-69l55-220v-80q0-33 23.5-56.5T200-520h160v-280q0-50 35-85t85-35q50 0 85 35t35 85v280h160q33 0 56.5 23.5T840-440v80l55 220q13 38-11.5 69T818-40Zm-58-400H200h560Zm-240-80h-80 80Z"/></svg>
        </button>
      </div>
    </div>

    <!-- Columna central: Botón -->
    <div class="button-column">
      <button class="translate-button" name="btn-translate">
        <svg viewBox="0 0 24 24"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
      </button>
    </div>

    <!-- Columna derecha: Output -->
    <div class="output-column">
      <div class="output-text-area">
        <div class="js-output-target"></div>
      </div>
    </div>
  </div>
</section>
`;

// IMPORTANTE: Primero se crea el HTML, luego se activa el JS
setupTextareaForceEnd();
addListener();

// [ADDED v8.0] Renderizar estado de sesión en el header
function renderSessionHeader() {
  const container = document.getElementById('header-session');
  if (!container) return;
  const token = window.contextiaAuth?.getToken?.();
  if (token) {
    const email = localStorage.getItem('contextia_user_email') || 'Usuario';
    const initial = email.charAt(0).toUpperCase();
    container.innerHTML = `
      <div class="header-user">
        <div class="header-avatar">${initial}</div>
        <span class="header-email">${email}</span>
        <button class="header-logout-btn" id="header-logout">Salir</button>
      </div>
    `;
    document.getElementById('header-logout').onclick = async () => {
      try {
        await fetch('http://localhost:8000/auth/logout', {
          method: 'POST',
          headers: window.contextiaAuth.authHeaders()
        });
      } catch(e) {}
      localStorage.removeItem('contextia_token');
      localStorage.removeItem('contextia_user_id');
      localStorage.removeItem('contextia_user_email');
      window.dispatchEvent(new Event('contextia:authchange'));
    };
  } else {
    container.innerHTML = `
      <button class="header-login-btn" id="header-login">Iniciar sesión</button>
    `;
    document.getElementById('header-login').onclick = () => {
      window.openAuthModal(null, 'Accedé a tu cuenta');
    };
  }
}

renderSessionHeader();
window.addEventListener('contextia:authchange', renderSessionHeader);
