import './style.css';
import { setupTextareaForceEnd } from './utils/textareaAlignCursor.js';

document.querySelector('#app').innerHTML = `
<section id="center">
  <h3>traductor online</h3>

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
  
  <div class="container input-text-area">
    <!-- El textarea ahora tiene una clase propia para que el JS no se pierda -->
    <textarea class="js-input-target" placeholder="Escribe el texto o frase a traducir..."></textarea>
    <section id="btn-transform">
      <input
        type="button"
        name="btn"
        value="traducir"
      ></input>
    </section>
  </div>

  <div class="container output-text-area">
    <!-- Agregamos 'readonly' para que el usuario no pueda escribir -->
    <textarea class="js-output-target" readonly></textarea>
  </div>
</section>  
`;

// IMPORTANTE: Primero se crea el HTML, luego se activa el JS
setupTextareaForceEnd();
