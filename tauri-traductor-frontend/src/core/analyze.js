/**
 * analyze.js - Gestión del análisis lingüístico y UI del Modal
 */

// 1. Inyectar estilos necesarios para el Modal y el Botón
const style = document.createElement('style');
style.innerHTML = `
    .analyze-btn {
        background: transparent;
        border: 1px solid #444;
        color: #aaa;
        padding: 5px 12px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 12px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
    }
    .analyze-btn:hover {
        border-color: #4CAF50;
        color: #4CAF50;
        background: rgba(76, 175, 80, 0.05);
    }
    .analyze-btn svg {
        width: 14px;
        height: 14px;
    }

    /* Modal Styles */
    #linguistic-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        backdrop-filter: blur(4px);
    }
    #linguistic-modal {
        background: #1a1a1a;
        color: #e0e0e0;
        width: 90%;
        max-width: 600px;
        max-height: 85vh;
        border: 1px solid #333;
        border-radius: 8px;
        overflow-y: auto;
        font-family: 'Courier New', Courier, monospace;
        padding: 25px;
        position: relative;
        box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    #linguistic-modal h2 {
        color: #4CAF50;
        font-size: 18px;
        margin-top: 0;
        border-bottom: 1px solid #333;
        padding-bottom: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    #linguistic-modal .modal-section {
        margin-bottom: 20px;
    }
    #linguistic-modal .section-title {
        color: #888;
        font-size: 13px;
        font-weight: bold;
        margin-bottom: 5px;
        display: block;
    }
    #linguistic-modal .section-content {
        background: #222;
        padding: 10px;
        border-radius: 4px;
        font-size: 14px;
        line-height: 1.5;
        border-left: 3px solid #444;
    }
    #linguistic-modal .vocab-tag {
        display: inline-block;
        background: #333;
        padding: 2px 8px;
        border-radius: 3px;
        margin: 2px;
        font-size: 12px;
        border: 1px solid #444;
    }
    #linguistic-modal .close-modal {
        position: absolute;
        top: 15px;
        right: 15px;
        background: none;
        border: none;
        color: #666;
        font-size: 24px;
        cursor: pointer;
    }
    #linguistic-modal .close-modal:hover { color: #fff; }

    /* Spinner */
    .spinner-container { text-align: center; padding: 40px; }
    .spinner {
        width: 30px;
        height: 30px;
        border: 2px solid #333;
        border-top-color: #4CAF50;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
`;
document.head.appendChild(style);

/**
 * Define la función globalmente para evitar ReferenceError
 */
window.openAnalysisModal = async function(text, translated, source, target) {
    // 1. Crear Overlay y Modal de Carga
    const overlay = document.createElement('div');
    overlay.id = 'linguistic-modal-overlay';
    overlay.innerHTML = `
        <div id="linguistic-modal">
            <button class="close-modal">&times;</button>
            <div class="spinner-container">
                <div class="spinner"></div>
                <p style="margin-top:15px; font-size:12px; color:#888;">Analizando estructuras...</p>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Cerrar con click fuera o botón
    const closeModal = () => overlay.remove();
    overlay.querySelector('.close-modal').onclick = closeModal;
    overlay.onclick = (e) => { if(e.target === overlay) closeModal(); };
    window.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeModal(); }, { once: true });

    try {
        // 2. Fetch al backend
        const response = await fetch('http://localhost:8000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, translated, source_lang: source, target_lang: target })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        // Guardar en global por si se necesita
        window.currentLinguisticAnalysis = data.analysis;
        const analysis = data.analysis;

        // 3. Renderizar Contenido Real
        const modal = overlay.querySelector('#linguistic-modal');
        modal.innerHTML = `
            <button class="close-modal">&times;</button>
            <h2>Análisis Lingüístico</h2>
            
            <div class="modal-section">
                <span class="section-title">TRADUCCIÓN</span>
                <div class="section-content" style="color:#4CAF50;">${translated}</div>
            </div>

            <div class="modal-section">
                <span class="section-title">TIEMPO VERBAL / ESTRUCTURA</span>
                <div class="section-content">
                    <strong>${analysis.grammar.verb_tense}</strong><br>
                    <small style="color:#888;">${analysis.grammar.sentence_structure}</small>
                </div>
            </div>

            <div class="modal-section">
                <span class="section-title">EXPLICACIÓN GRAMATICAL</span>
                <div class="section-content">
                    ${analysis.translation_explanation.grammar_rules_applied}
                </div>
            </div>

            <div class="modal-section">
                <span class="section-title">VOCABULARIO CLAVE</span>
                <div class="section-content">
                    ${analysis.vocabulary.level_words.slice(0, 3).map(w => `
                        <div style="margin-bottom:5px;">
                            <span class="vocab-tag">${w.word}</span> 
                            <small style="color:#888;">[${w.level}] - ${w.definition}</small>
                        </div>
                    `).join('')}
                </div>
            </div>

            ${analysis.common_errors.literal_translation_mistakes.length > 0 ? `
            <div class="modal-section">
                <span class="section-title">ALERTA: ERROR COMÚN</span>
                <div class="section-content" style="border-left-color: #e67e22; color: #e67e22;">
                    ${analysis.common_errors.literal_translation_mistakes[0]}
                </div>
            </div>
            ` : ''}

            <div style="text-align:right; margin-top:20px;">
                <small style="color:#444;">Deep Linguistics Engine v1.0</small>
            </div>
        `;
        
        modal.querySelector('.close-modal').onclick = closeModal;

    } catch (error) {
        console.error('Modal Analysis Error:', error);
        overlay.querySelector('.spinner-container').innerHTML = `
            <p style="color:#e74c3c;">Error al cargar el análisis.</p>
            <button onclick="this.closest('#linguistic-modal-overlay').remove()" 
                    class="analyze-btn" style="margin-top:10px;">Cerrar</button>
        `;
    }
};
