import { addListener } from './core/listenerManager.js';
import './core/analyze.js';
import './style.css';
import { setupTextareaForceEnd } from './utils/textareaAlignCursor.js';

document.querySelector('#app').innerHTML = `
<section id="center">
  <h3 class="app-logo">Context<span>IA</span></h3>

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
