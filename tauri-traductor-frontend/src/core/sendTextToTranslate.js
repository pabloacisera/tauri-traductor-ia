export async function sendText(text, language) {
    const response = await fetch('http://localhost:8000/translate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text,
            target_lang: language
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Respuesta del servidor:', data);
    return data;
}

export async function renderTranslateResponse(element, textToTranslate, target_lang) {
    const data = await sendText(textToTranslate, target_lang);
    // ✅ Guardar el idioma de traducción para el speech
    window.currentTranslationLang = target_lang;

    if (data.success) {

        if (data.audio) {
            window.currentAudioBase64 = data.audio;
        }

        element.innerHTML = `
            <div class="translation-result">
                <p>Traducción:</p>
                <p>${data.translated}</p>
                <button class="speech-voice-icon" id="play-translation" title="Reproducir traducción">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                </button>
                <div class="analysis-container" style="margin-top: 15px; border-top: 1px solid #333; padding-top: 10px;">
                    <button class="analyze-btn js-open-analysis" 
                            data-text="${textToTranslate}" 
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
        element.innerHTML = '<p class="suggestions-title">Sugerencias:</p>'; 
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
        element.appendChild(ul);
    } else {
        // Error sin sugerencias: mostrar mensaje amigable, nunca datos crudos del sistema
        element.innerHTML = `
            <div class="translation-error">
                <p>No pudimos procesar el texto en este momento.</p>
                <p>Por favor revisá la ortografía e intentá de nuevo.</p>
            </div>
        `;
    }
}
