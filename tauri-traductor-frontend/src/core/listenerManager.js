import { renderTranslateResponse } from "./sendTextToTranslate.js";

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
            await renderTranslateResponse(outputTextArea, text, selectedLanguage);
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

            // Opcional: traducir automáticamente la sugerencia seleccionada
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