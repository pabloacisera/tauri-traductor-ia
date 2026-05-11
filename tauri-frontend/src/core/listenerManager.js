import { renderTranslateResponse } from "./sendTextToTranslate.js";

async function getDeviceSeed() {
  try {
    const { getClientSeed } = await import('../utils/device.js');
    return await getClientSeed();
  } catch (e) {
    return null;
  }
}

export function addListener() {
    const btnTranslate = document.querySelector('.translate-button');
    const btnClear = document.querySelector('.clear-input-button');
    const inputTextArea = document.querySelector('.js-input-target');
    const outputTextArea = document.querySelector('.js-output-target');
    const selectLanguage = document.querySelector('#list');

    // Click en botón
    btnTranslate.addEventListener('click', async () => {
        await translate();
    });

    // Click en botón limpiar
    btnClear.addEventListener('click', () => {
        inputTextArea.value = '';
        outputTextArea.innerHTML = '';
        inputTextArea.focus();
    });

    // Enter en textarea
    inputTextArea.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            await translate();
        }
    });

    async function translate() {
        const text = inputTextArea.value.trim();
        if (!text) return;

        const selectedLanguage = selectLanguage.value;
        outputTextArea.textContent = 'Traduciendo...';

        try {
            const headers = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('contextia_token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const seed = await getDeviceSeed();
            if (seed) {
                headers['X-Device-Seed'] = seed;
            }

            const response = await fetch('http://localhost:8000/translate/tracked', {
                method: 'POST',
                headers,
                body: JSON.stringify({ text, target_lang: selectedLanguage, source_lang: 'auto' })
            });

            const data = await response.json();
            window.currentTranslationLang = selectedLanguage;

            if (data.success) {
                if (data.audio) {
                    window.currentAudioBase64 = data.audio;
                }

                outputTextArea.innerHTML = `
                    <div class="translation-result">
                        <p>Traducción:</p>
                        <p>${data.translated}</p>
                        <button class="speech-voice-icon" id="play-translation" title="Reproducir traducción">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                        </button>
                        <div class="analysis-container" style="margin-top: 15px; border-top: 1px solid #333; padding-top: 10px;">
                            <button class="analyze-btn js-open-analysis" 
                                    data-text="${text}" 
                                    data-translated="${data.translated}" 
                                    data-source="${data.source_lang}" 
                                    data-target="${data.target_lang}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                Análisis Lingüístico
                            </button>
                        </div>
                    </div>
                `;
            } else if (Array.isArray(data.suggestions) && data.suggestions.length > 0 && data.suggestions.every(s => typeof s === 'string' && s.trim().length > 3)) {
                outputTextArea.innerHTML = '<p class="suggestions-title">Sugerencias:</p>'; 
                const ul = document.createElement('ul');

                data.suggestions.forEach(suggestion => {
                    const li = document.createElement('li');
                    
                    const span = document.createElement('span');
                    span.textContent = suggestion;

                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = 'suggestion';
                    radio.value = suggestion;
                    radio.classList.add('suggestion-radio');

                    li.appendChild(span);
                    li.appendChild(radio);
                    ul.appendChild(li);
                });
                outputTextArea.appendChild(ul);
            } else {
                outputTextArea.innerHTML = `
                    <div class="translation-error">
                        <p>No pudimos procesar el texto en este momento.</p>
                        <p>Por favor revisá la ortografía e intentá de nuevo.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error al traducir:', error);
            outputTextArea.textContent = 'Error al traducir el texto. Por favor, inténtalo de nuevo.';
        }
    }

    // ✅ DELEGACIÓN DE EVENTOS CORRECTA
    // El evento se delega en el contenedor PADRE que SIEMPRE existe (.js-output-target)
    outputTextArea.addEventListener('change', function (event) {
        // Verificamos que el elemento que disparó el evento sea un radio
        if (event.target && event.target.matches('input[type="radio"].suggestion-radio')) {
            console.log('Radio seleccionado:', event.target.value);

            // Obtener el LI padre
            const li = event.target.closest('li');
            // Obtener el texto de la sugerencia (el span dentro del li)
            const suggestionText = li?.querySelector('span')?.textContent || event.target.value;

            console.log('Texto de la sugerencia:', suggestionText);

            // Aquí puedes hacer lo que necesites con el texto seleccionado
            // Por ejemplo: copiarlo al textarea de entrada
            inputTextArea.value = suggestionText;

            // Traducir la sugerencia usando /translate/tracked (descuenta del límite)
            translate();
        }
    });

    // Delegar el evento en el contenedor padre que SIEMPRE existe (document.body o #app)
    document.body.addEventListener('click', (event) => {
        // Verificar si el elemento clickeado o su padre es el ícono
        const playIcon = event.target.closest('#play-translation');

        if (playIcon && window.currentAudioBase64) {
            try {
                // Convertir Base64 a Blob
                const binaryString = atob(window.currentAudioBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
                const audioUrl = URL.createObjectURL(audioBlob);

                // Reproducir
                const audio = new Audio(audioUrl);
                audio.play();
                audio.onended = () => URL.revokeObjectURL(audioUrl);
            } catch (error) {
                console.error('Error reproduciendo audio:', error);
            }
        }

        // Análisis lingüístico
        const analyzeLink = event.target.closest('.js-open-analysis');
        if (analyzeLink) {
            event.preventDefault();
            const { text, translated, source, target } = analyzeLink.dataset;
            if (window.openAnalysisModal) {
                window.openAnalysisModal(text, translated, source, target);
            }
        }
    });
}