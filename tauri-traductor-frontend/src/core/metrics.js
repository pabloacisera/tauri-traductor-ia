// [ADDED v8.0] Modal de métricas — estadísticas de aprendizaje con gráfico SVG puro
const API_BASE = 'http://localhost:8000';

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('contextia_token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// [ADDED v8.0] Crear y mostrar modal de métricas
window.openMetricsModal = async function() {
  if (document.getElementById('metrics-modal-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'metrics-modal-overlay';
  overlay.className = 'metrics-modal-overlay';
  overlay.innerHTML = `
    <div class="metrics-modal">
      <button class="metrics-close" id="metrics-close-btn">&times;</button>
      <h2>Tu progreso</h2>
      <div id="metrics-content">
        <div style="text-align:center;padding:var(--space-8) 0"><div class="practice-spinner"></div></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#metrics-close-btn').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  try {
    const res = await fetch(`${API_BASE}/metrics/summary`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error cargando métricas');
    renderMetrics(overlay.querySelector('#metrics-content'), data);
  } catch (e) {
    overlay.querySelector('#metrics-content').innerHTML = `<div class="practice-empty-state">${e.message}</div>`;
  }
};

function renderMetrics(container, data) {
  // Sección 1 — Resumen
  const summaryHtml = `
    <div class="metrics-section">
      <span class="metrics-section-title">Resumen</span>
      <div class="metrics-grid">
        <div class="metrics-card">
          <div class="metrics-card-value">${data.current_level}</div>
          <div class="metrics-card-label">Nivel actual</div>
        </div>
        <div class="metrics-card">
          <div class="metrics-card-value">${data.accuracy_rate}%</div>
          <div class="metrics-card-label">Precisión total</div>
        </div>
        <div class="metrics-card">
          <div class="metrics-card-value">${data.words_saved}</div>
          <div class="metrics-card-label">Palabras guardadas</div>
        </div>
        <div class="metrics-card">
          <div class="metrics-card-value">${data.streak}</div>
          <div class="metrics-card-label">Racha (días)</div>
        </div>
      </div>
    </div>
  `;

  // Sección 2 — Precisión por nivel
  const levels = ['A1','A2','B1','B2','C1','C2'];
  let barsHtml = '';
  levels.forEach(lvl => {
    const val = data.accuracy_by_level[lvl] || 0;
    barsHtml += `
      <div class="level-bar-row">
        <span class="level-bar-label">${lvl}</span>
        <div class="level-bar-track"><div class="level-bar-fill" style="width:${val}%"></div></div>
        <span class="level-bar-value">${Math.round(val)}%</span>
      </div>
    `;
  });

  const accuracyHtml = `
    <div class="metrics-section">
      <span class="metrics-section-title">Precisión por nivel</span>
      ${barsHtml}
    </div>
  `;

  // Sección 3 — Evolución SVG
  const chartSvg = buildLineChart(data.recent_progress || []);
  const evolutionHtml = `
    <div class="metrics-section">
      <span class="metrics-section-title">Evolución (últimos 14 días)</span>
      ${chartSvg}
    </div>
  `;

  // Sección 4 — Palabras difíciles
  let hardestHtml = '';
  if (data.hardest_words && data.hardest_words.length > 0) {
    hardestHtml = `
      <div class="metrics-section">
        <span class="metrics-section-title">Palabras difíciles</span>
        ${data.hardest_words.map(w => `
          <div class="hardest-word-row">
            <div>
              <span class="hardest-word-name">${escapeHtml(w.word)}</span>
              <span class="hardest-word-meta"> ${w.level} · Practicada ${w.times_practiced} veces</span>
            </div>
            <div class="hardest-word-meta">Score: ${w.last_score}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = summaryHtml + accuracyHtml + evolutionHtml + hardestHtml;
}

function buildLineChart(progressData) {
  if (!progressData || progressData.length === 0) {
    return '<div class="practice-empty-state">Sin datos recientes</div>';
  }

  const width = 560;
  const height = 160;
  const padding = 30;

  const labels = progressData.map(d => {
    const date = new Date(d.date);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  });

  const values = progressData.map(d => {
    if (d.exercises === 0) return 0;
    return Math.round((d.correct / d.exercises) * 100);
  });

  const maxVal = Math.max(10, ...values);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const xStep = (width - padding * 2) / (values.length - 1 || 1);
  const points = values.map((v, i) => {
    const x = padding + i * xStep;
    const y = height - padding - ((v - minVal) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  // Líneas de grid horizontales
  const gridLines = [0, 25, 50, 75, 100].map(pct => {
    const y = height - padding - (pct / 100) * (height - padding * 2);
    return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2"/>`;
  }).join('');

  // Puntos
  const circles = values.map((v, i) => {
    const x = padding + i * xStep;
    const y = height - padding - ((v - minVal) / range) * (height - padding * 2);
    return `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent-color)"/>`;
  }).join('');

  // Etiquetas X (mostrar cada 3 días para no saturar)
  const xLabels = labels.map((lbl, i) => {
    if (i % 3 !== 0 && i !== labels.length - 1) return '';
    const x = padding + i * xStep;
    return `<text x="${x}" y="${height - 6}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${lbl}</text>`;
  }).join('');

  return `
    <svg class="metrics-chart" viewBox="0 0 ${width} ${height}">
      ${gridLines}
      <polyline fill="none" stroke="var(--accent-color)" stroke-width="2" points="${points}" stroke-linecap="round" stroke-linejoin="round"/>
      ${circles}
      ${xLabels}
    </svg>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
