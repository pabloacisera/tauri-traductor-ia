// [ADDED] Modal de pago falso - simulador de gateway de pago
// Reemplazable por Stripe/MercadoPago manteniendo la misma interfaz
const API_BASE = 'http://localhost:8000';

const fakePaymentStyles = document.createElement('style');
fakePaymentStyles.innerHTML = `
  .fp-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.88);
    z-index: 9500;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
  }
  .fp-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    width: min(480px, 96vw);
    padding: var(--space-8);
    font-family: var(--font-mono);
    position: relative;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }
  .fp-header {
    text-align: center;
    margin-bottom: var(--space-6);
  }
  .fp-title {
    font-size: var(--size-h2);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: var(--space-1);
  }
  .fp-subtitle {
    font-size: var(--size-xsmall);
    color: var(--text-muted);
  }
  .fp-plan-info {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    margin-bottom: var(--space-6);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .fp-plan-name {
    font-size: var(--size-small);
    font-weight: 700;
    color: var(--text-primary);
  }
  .fp-plan-price {
    font-size: var(--size-h3);
    font-weight: 800;
    color: var(--accent-color);
    text-align: right;
  }
  .fp-plan-period {
    font-size: var(--size-tiny);
    color: var(--text-muted);
    text-align: right;
  }
  .fp-card-section {
    margin-bottom: var(--space-5);
  }
  .fp-label {
    display: block;
    font-size: var(--size-tiny);
    color: var(--text-muted);
    margin-bottom: var(--space-2);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .fp-input-group {
    position: relative;
    margin-bottom: var(--space-4);
  }
  .fp-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--size-small);
    transition: border-color var(--transition-fast);
    padding-right: 48px;
  }
  .fp-input:focus {
    outline: none;
    border-color: var(--accent-color);
  }
  .fp-input.error {
    border-color: #ef4444;
  }
  .fp-input.valid {
    border-color: var(--accent-color);
  }
  .fp-input-icon {
    position: absolute;
    right: var(--space-4);
    top: 50%;
    transform: translateY(-50%);
    font-size: 20px;
  }
  .fp-input-icon.valid { color: var(--accent-color); }
  .fp-input-icon.error { color: #ef4444; }
  .fp-input-error {
    font-size: var(--size-tiny);
    color: #ef4444;
    margin-top: var(--space-1);
    min-height: 16px;
  }
  .fp-row { display: flex; gap: var(--space-4); }
  .fp-row .fp-input-group { flex: 1; margin-bottom: 0; }
  .fp-submit {
    width: 100%;
    background: linear-gradient(135deg, var(--accent-color), #059669);
    color: #000;
    border: none;
    border-radius: var(--radius-md);
    padding: var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--size-small);
    font-weight: 800;
    cursor: pointer;
    transition: opacity var(--transition-fast);
    margin-bottom: var(--space-3);
  }
  .fp-submit:hover:not(:disabled) { opacity: 0.85; }
  .fp-submit:disabled { opacity: 0.4; cursor: not-allowed; }
  .fp-cancel {
    width: 100%;
    background: none;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    padding: var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--size-xsmall);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .fp-cancel:hover { border-color: var(--text-muted); color: var(--text-secondary); }
  .fp-result-error {
    background: rgba(239,68,68,0.1);
    border: 1px solid #ef4444;
    border-radius: var(--radius-md);
    padding: var(--space-3);
    color: #ef4444;
    font-size: var(--size-xsmall);
    text-align: center;
    margin-bottom: var(--space-3);
  }
  .fp-result-success {
    background: rgba(16,185,129,0.1);
    border: 1px solid var(--accent-color);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    color: var(--accent-color);
    font-size: var(--size-xsmall);
    text-align: center;
    margin-bottom: var(--space-3);
  }
  .fp-close {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 24px;
    cursor: pointer;
  }
  .fp-close:hover { color: var(--text-primary); }
  .fp-test-hint {
    font-size: var(--size-tiny);
    color: var(--text-muted);
    text-align: center;
    margin-top: var(--space-4);
    line-height: 1.5;
  }
`;
document.head.appendChild(fakePaymentStyles);


function detectCardBrand(number) {
  const clean = number.replace(/\s/g, '');
  if (clean.startsWith('4')) return 'Visa';
  if (clean.startsWith('5')) return 'Mastercard';
  if (clean.startsWith('3')) return 'Amex';
  return null;
}

function getCardBrandStyle(brand) {
  if (brand === 'Visa') return { bg: '#1a1f71', text: '#fff', label: 'VISA' };
  if (brand === 'Mastercard') return { bg: '#eb001b', text: '#fff', label: 'MC' };
  if (brand === 'Amex') return { bg: '#007bc1', text: '#fff', label: 'AMEX' };
  return null;
}

function formatCardNumber(value) {
  const digits = value.replace(/\D/g, '').substring(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function isValidMM(mm) {
  const n = parseInt(mm, 10);
  return mm.length === 2 && n >= 1 && n <= 12;
}

function isValidYY(yy) {
  if (yy.length !== 2) return false;
  const n = parseInt(yy, 10);
  const currentYear = new Date().getFullYear() % 100;
  return n >= currentYear;
}

function isValidCVV(cvv) {
  return cvv.length === 3 && /^\d{3}$/.test(cvv);
}

function isCardExpired(mm, yy) {
  const m = parseInt(mm, 10);
  const y = parseInt('20' + yy, 10);
  const now = new Date();
  return new Date(y, m - 1, 1) < new Date(now.getFullYear(), now.getMonth(), 1);
}

function validateCard(number, mm, yy, cvv) {
  const errors = { number: '', expiry: '', cvv: '' };
  const cleanNum = number.replace(/\s/g, '');
  const brand = detectCardBrand(cleanNum);

  if (cleanNum.length > 0 && cleanNum.length < 16) {
    errors.number = `Faltan ${16 - cleanNum.length} dígitos`;
  }
  if (cleanNum.length === 16 && !/^\d{16}$/.test(cleanNum)) {
    errors.number = 'Solo números';
  }

  if (mm.length === 2 && !isValidMM(mm)) {
    errors.expiry = 'Mes inválido (01-12)';
  }
  if (yy.length === 2 && !isValidYY(yy)) {
    errors.expiry = 'Año inválido';
  }
  if (mm.length === 2 && yy.length === 2 && !errors.expiry && isCardExpired(mm, yy)) {
    errors.expiry = 'Tarjeta vencida';
  }

  if (cvv.length > 0 && !isValidCVV(cvv)) {
    errors.cvv = '3 dígitos requeridos';
  }

  return {
    errors,
    brand,
    isReady: cleanNum.length === 16 && isValidMM(mm) && isValidYY(yy) && !isCardExpired(mm, yy) && isValidCVV(cvv)
  };
}


window.openFakePaymentModal = function() {
  if (document.getElementById('fp-overlay')) return;

  const pendingPlan = localStorage.getItem('contextia_pending_plan') || 'monthly';
  const pendingPrice = localStorage.getItem('contextia_pending_price') || '$9.99';
  const isAnnual = pendingPlan === 'annual';
  const pricePerMonth = isAnnual ? '$6.66' : '$9.99';

  const overlay = document.createElement('div');
  overlay.id = 'fp-overlay';
  overlay.className = 'fp-overlay';
  overlay.innerHTML = `
    <div class="fp-modal">
      <button class="fp-close" id="fp-close">&times;</button>
      <div class="fp-header">
        <div class="fp-title">Completá tu pago</div>
        <div class="fp-subtitle">Datos de tu tarjeta de crédito</div>
      </div>

      <div class="fp-plan-info">
        <div>
          <div class="fp-plan-name">${isAnnual ? 'Plan Anual' : 'Plan Mensual'}</div>
          <div style="font-size:var(--size-tiny);color:var(--text-muted);margin-top:4px">${pricePerMonth}/mes</div>
        </div>
        <div>
          <div class="fp-plan-price">${pendingPrice}</div>
          <div class="fp-plan-period">${isAnnual ? 'por año' : 'por mes'}</div>
        </div>
      </div>

      <div id="fp-result"></div>

      <div class="fp-card-section">
        <label class="fp-label">Número de tarjeta</label>
        <div class="fp-input-group">
          <input type="text" class="fp-input" id="fp-card-number" placeholder="0000 0000 0000 0000" maxlength="19" autocomplete="off" />
          <span class="fp-input-icon" id="fp-card-brand-icon"></span>
        </div>
        <div class="fp-input-error" id="fp-card-number-error"></div>
      </div>

      <div class="fp-row">
        <div class="fp-input-group">
          <label class="fp-label">Vencimiento</label>
          <input type="text" class="fp-input" id="fp-expiry" placeholder="MM/YY" maxlength="5" autocomplete="off" />
          <div class="fp-input-error" id="fp-expiry-error"></div>
        </div>
        <div class="fp-input-group">
          <label class="fp-label">Código de seguridad</label>
          <input type="text" class="fp-input" id="fp-cvv" placeholder="CVV" maxlength="3" autocomplete="off" />
          <div class="fp-input-error" id="fp-cvv-error"></div>
        </div>
      </div>

      <button class="fp-submit" id="fp-submit" disabled>Pagar ${pendingPrice}</button>
      <button class="fp-cancel" id="fp-cancel">Cancelar</button>

      <div class="fp-test-hint">
        Usá los datos de prueba de data.txt<br>
        Ej: Visa 4111 1111 1111 1111 · 12/28 · 123
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const cardInput = document.getElementById('fp-card-number');
  const expiryInput = document.getElementById('fp-expiry');
  const cvvInput = document.getElementById('fp-cvv');
  const submitBtn = document.getElementById('fp-submit');
  const resultDiv = document.getElementById('fp-result');
  const brandIcon = document.getElementById('fp-card-brand-icon');
  const cardNumberError = document.getElementById('fp-card-number-error');
  const expiryError = document.getElementById('fp-expiry-error');
  const cvvError = document.getElementById('fp-cvv-error');

  let expiryMM = '';
  let expiryYY = '';

  function updateBrandIcon(brand) {
    const style = getCardBrandStyle(brand);
    if (style) {
      brandIcon.innerHTML = `<span style="background:${style.bg};color:${style.text};padding:2px 6px;border-radius:3px;font-size:11px;font-weight:800">${style.label}</span>`;
      brandIcon.className = 'fp-input-icon';
    } else {
      brandIcon.innerHTML = '';
      brandIcon.className = 'fp-input-icon';
    }
  }

  function updateSubmitState() {
    const mm = expiryMM, yy = expiryYY;
    const cvv = cvvInput.value;
    const number = cardInput.value;
    const validation = validateCard(number, mm, yy, cvv);
    submitBtn.disabled = !validation.isReady;
  }

  cardInput.addEventListener('input', (e) => {
    const formatted = formatCardNumber(e.target.value);
    e.target.value = formatted;
    const brand = detectCardBrand(formatted);
    updateBrandIcon(brand);
    const validation = validateCard(formatted, expiryMM, expiryYY, cvvInput.value);
    cardInput.className = 'fp-input' + (formatted.length === 19 ? (validation.errors.number ? ' error' : ' valid') : '');
    cardNumberError.textContent = validation.errors.number;
    updateSubmitState();
  });

  expiryInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 2) {
      expiryMM = val.substring(0, 2);
      expiryYY = val.substring(2, 4);
      e.target.value = expiryMM + '/' + expiryYY;
    } else {
      expiryMM = val;
      expiryYY = '';
      e.target.value = val;
    }
    const validation = validateCard(cardInput.value, expiryMM, expiryYY, cvvInput.value);
    expiryInput.className = 'fp-input' + (expiryMM.length + expiryYY.length >= 4 ? (validation.errors.expiry ? ' error' : ' valid') : '');
    expiryError.textContent = validation.errors.expiry;
    updateSubmitState();
  });

  cvvInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 3);
    const validation = validateCard(cardInput.value, expiryMM, expiryYY, e.target.value);
    cvvInput.className = 'fp-input' + (e.target.value.length === 3 ? (validation.errors.cvv ? ' error' : ' valid') : '');
    cvvError.textContent = validation.errors.cvv;
    updateSubmitState();
  });

  document.getElementById('fp-close').onclick = () => overlay.remove();
  document.getElementById('fp-cancel').onclick = () => overlay.remove();

  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  submitBtn.onclick = async () => {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Procesando...';
    resultDiv.innerHTML = '';

    try {
      const token = localStorage.getItem('contextia_token');
      const res = await fetch(`${API_BASE}/payment/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          card_number: cardInput.value.replace(/\s/g, ''),
          expiry_mm: expiryMM,
          expiry_yy: expiryYY,
          cvv: cvvInput.value,
          plan_type: pendingPlan
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        resultDiv.innerHTML = `<div class="fp-result-error">${data.message || data.detail || 'Error en el procesamiento'}</div>`;
        submitBtn.disabled = false;
        submitBtn.textContent = `Pagar ${pendingPrice}`;
        return;
      }

      resultDiv.innerHTML = `<div class="fp-result-success">¡Suscripción activada exitosamente!</div>`;
      submitBtn.textContent = '¡Listo!';

      localStorage.setItem('contextia_contract', JSON.stringify({
        plan: data.plan,
        price: data.price,
        card_brand: data.card_brand,
        card_last4: data.card_last4,
        expires: data.expires,
        activated_at: new Date().toISOString()
      }));

      setTimeout(() => {
        overlay.remove();
        window.dispatchEvent(new Event('contextia:authchange'));
      }, 1200);

    } catch (err) {
      resultDiv.innerHTML = `<div class="fp-result-error">Error de conexión. Intentá de nuevo.</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = `Pagar ${pendingPrice}`;
    }
  };
};
