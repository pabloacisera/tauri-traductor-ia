// [ADDED MVP-v1] Módulo de cuenta y suscripción
const API_BASE = 'http://localhost:8000';

const accountStyles = document.createElement('style');
accountStyles.innerHTML = `
  /* ——— Profile dropdown ——— */
  .profile-btn {
    background: none;
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    border-radius: var(--radius-full);
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    font-weight: 700;
    font-size: var(--size-xsmall);
    transition: all var(--transition-fast);
    position: relative;
  }
  .profile-btn:hover { border-color: var(--accent-color); }
  .profile-btn .plan-badge-dot {
    position: absolute;
    bottom: -2px; right: -2px;
    width: 10px; height: 10px;
    border-radius: 50%;
    background: #888;
    border: 2px solid var(--bg-primary);
  }
  .profile-btn .plan-badge-dot.pro { background: var(--accent-color); }

  /* ——— Pro upgrade button ——— */
  .upgrade-pro-btn {
    background: linear-gradient(135deg, var(--accent-color), #059669);
    color: #000;
    border: none;
    border-radius: var(--radius-full);
    padding: 5px 12px;
    font-size: var(--size-tiny);
    font-weight: 700;
    font-family: var(--font-mono);
    cursor: pointer;
    letter-spacing: 0.5px;
    transition: opacity var(--transition-fast);
  }
  .upgrade-pro-btn:hover { opacity: 0.85; }

  /* ——— Account modal ——— */
  .account-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    z-index: 8500;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
  }
  .account-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    width: min(500px, 95vw);
    padding: var(--space-8);
    font-family: var(--font-mono);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    position: relative;
    overflow: hidden;
  }
  .account-modal-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: var(--space-8);
    gap: var(--space-4);
  }
  .account-avatar-large {
    width: 64px; height: 64px;
    border-radius: 50%;
    background: var(--bg-tertiary);
    border: 2px solid var(--accent-color);
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; font-weight: 700;
    color: var(--accent-color);
    box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
  }
  .account-info-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .account-email-display {
    font-size: var(--size-base);
    color: var(--text-primary);
    font-weight: 600;
  }
  .account-plan-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: var(--size-tiny);
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .account-plan-badge.free { background: #222; color: #888; border: 1px solid #333; }
  .account-plan-badge.pro { background: rgba(16,185,129,0.15); color: var(--accent-color); border: 1px solid var(--accent-color); }
  
  .account-stats-container {
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    margin-bottom: var(--space-6);
    border: 1px solid var(--border-color);
  }
  .account-stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2) 0;
    font-size: var(--size-xsmall);
  }
  .account-stat-label { color: var(--text-muted); }
  .account-stat-value { color: var(--text-primary); font-weight: 600; }
  .account-usage-bar {
    background: #111;
    border-radius: var(--radius-full);
    height: 6px;
    margin: var(--space-2) 0 var(--space-1) 0;
    overflow: hidden;
  }
  .account-usage-bar-fill {
    height: 100%;
    background: var(--accent-color);
    border-radius: var(--radius-full);
    transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .account-actions-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-3);
    position: relative;
  }
  .account-action-btn {
    width: 100%;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: var(--size-xsmall);
    cursor: pointer;
    text-align: center;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }
  .account-action-btn:hover { 
    border-color: var(--accent-color); 
    color: var(--accent-color);
    background: rgba(16, 185, 129, 0.05);
  }
  .account-action-btn.pro-btn {
    background: var(--accent-color);
    color: #000;
    font-weight: 700;
    border: none;
  }
  .account-action-btn.pro-btn:hover {
    background: var(--accent-hover);
    color: #000;
  }
  .account-action-btn.danger:hover { 
    border-color: #ef4444; 
    color: #ef4444; 
    background: rgba(239, 68, 68, 0.05);
  }
  .account-close-btn { 
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    background:none; border:none; color:var(--text-muted); font-size:24px; cursor:pointer; 
    transition: color var(--transition-fast);
  }
  .account-close-btn:hover { color: var(--text-primary); }

  /* ——— Pricing modal ——— */
  .pricing-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    z-index: 9000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
  }
  .pricing-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    width: min(960px, 96vw);
    padding: 56px 64px;
    font-family: var(--font-mono);
    position: relative;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    min-height: 600px;          /* ← altura mínima */
    max-height: 90vh;
  }
  .pricing-title {
    color: var(--text-primary);
    font-size: 2rem;
    font-weight: 800;
    text-align: center;
    margin-bottom: var(--space-2);
    letter-spacing: -0.025em;
  }
  .pricing-subtitle {
    color: var(--text-muted);
    font-size: var(--size-small);
    text-align: center;
    margin-bottom: var(--space-8);
  }
  .pricing-plans {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
    margin-bottom: var(--space-8);
  }
  .pricing-plan {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 40px 36px;
    text-align: center;
    display: flex;
    flex-direction: column;
    transition: transform var(--transition-normal);
  }
  .pricing-plan:hover { transform: translateY(-4px); }
  .pricing-plan.recommended {
    border-color: var(--accent-color);
    background: rgba(16, 185, 129, 0.03);
    position: relative;
    transform: scale(1.05);
  }
  .pricing-plan.recommended:hover { transform: scale(1.05) translateY(-4px); }
  .pricing-plan.recommended::before {
    content: "RECOMENDADO";
    position: absolute;
    top: -12px;
    left: 50%; transform: translateX(-50%);
    background: var(--accent-color);
    color: #000;
    font-size: 10px;
    font-weight: 800;
    padding: 4px 12px;
    border-radius: var(--radius-full);
    white-space: nowrap;
    letter-spacing: 0.05em;
  }
  .pricing-plan-name { font-size: var(--size-tiny); color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: var(--space-4); }
  .pricing-plan-price {
    font-size: 3rem;
    font-weight: 800;
    color: var(--accent-color);
    margin-bottom: var(--space-1);
  }
  .pricing-plan-period { font-size: var(--size-xsmall); color: var(--text-muted); margin-bottom: var(--space-6); }
  .pricing-plan-btn {
    width: 100%;
    background: var(--accent-color);
    color: #000;
    border: none;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-weight: 800;
    font-size: var(--size-small);
    cursor: pointer;
    transition: all var(--transition-fast);
    margin-top: auto;
  }
  .pricing-plan-btn:hover { background: var(--accent-hover); }
  .pricing-features {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-3) var(--space-6);
    margin-top: var(--space-4);
    list-style: none;
  }
  .pricing-features li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--size-xsmall);
    color: var(--text-secondary);
  }
  .pricing-features li::before { content: "✓"; color: var(--accent-color); font-weight: 800; }
  .pricing-dismiss {
    background: none;
    border: none;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: var(--size-tiny);
    cursor: pointer;
    width: 100%;
    text-align: center;
    padding: var(--space-4);
    margin-top: var(--space-4);
    transition: color var(--transition-fast);
  }
  .pricing-dismiss:hover { color: var(--text-primary); }

  /* ——— Welcome-to-Pro modal (post-registro) ——— */
  .welcome-pro-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    z-index: 9100;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }
  .welcome-pro-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--accent-color);
    border-radius: var(--radius-lg);
    width: min(420px, 95vw);
    padding: var(--space-8);
    font-family: var(--font-mono);
    text-align: center;
  }
  .welcome-pro-icon {
    font-size: 3rem;
    margin-bottom: var(--space-4);
  }
  .welcome-pro-title {
    font-size: var(--size-h1);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }
  .welcome-pro-desc {
    font-size: var(--size-xsmall);
    color: var(--text-muted);
    margin-bottom: var(--space-6);
    line-height: 1.6;
  }
  .welcome-pro-cta {
    width: 100%;
    background: linear-gradient(135deg, var(--accent-color), #059669);
    color: #000;
    border: none;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--size-small);
    cursor: pointer;
    margin-bottom: var(--space-2);
  }
  .welcome-pro-skip {
    background: none;
    border: none;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: var(--size-tiny);
    cursor: pointer;
    padding: var(--space-1);
  }
  .welcome-pro-skip:hover { color: var(--text-secondary); }
`;
document.head.appendChild(accountStyles);

// ——— Abrir modal de cuenta ———
window.openAccountModal = async function() {
  const token = localStorage.getItem('contextia_token');
  if (!token) { window.openAuthModal(); return; }
  
  if (document.getElementById('account-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'account-overlay';
  overlay.className = 'account-overlay';
  overlay.innerHTML = `
    <div class="account-modal">
      <button class="account-close-btn" id="account-close-btn">&times;</button>
      <div id="account-modal-body" style="width:100%">
        <div style="display:flex;align-items:center;justify-content:center;min-height:300px">
          <div style="width:32px;height:32px;border:3px solid #333;border-top-color:var(--accent-color);border-radius:50%;animation:spin 0.8s linear infinite"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.getElementById('account-close-btn').onclick = () => overlay.remove();
  
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const user = await res.json();
    
    const email = user.email || 'Usuario';
    const initial = email.charAt(0).toUpperCase();
    const isPro = user.plan && user.plan !== 'free' && user.plan !== 'anonymous';
    const limit = user.translations_limit === -1 ? '∞' : user.translations_limit;
    const used = user.daily_translations || 0;
    const usedPercent = user.translations_limit === -1 ? 0 : Math.min(100, (used / user.translations_limit) * 100);
    
    document.getElementById('account-modal-body').innerHTML = `
      <div class="account-modal-header">
        <div class="account-avatar-large" id="account-avatar">${initial}</div>
        <div class="account-info-main">
          <span class="account-email-display">${email}</span>
          <div>
            <span class="account-plan-badge ${isPro ? 'pro' : 'free'}">
              ${isPro ? 'PRO' : 'FREE'}
            </span>
          </div>
        </div>
      </div>
      
      <div class="account-stats-container">
        <div class="account-stat-row">
          <span class="account-stat-label">Traducciones hoy</span>
          <span class="account-stat-value">${used} / ${limit}</span>
        </div>
        ${user.translations_limit !== -1 ? `
          <div class="account-usage-bar">
            <div class="account-usage-bar-fill" style="width:${usedPercent}%"></div>
          </div>
        ` : ''}
        
        ${user.subscription_end ? `
          <div class="account-stat-row" style="margin-top:var(--space-2)">
            <span class="account-stat-label">Plan vence</span>
            <span class="account-stat-value">${new Date(user.subscription_end).toLocaleDateString('es-AR')}</span>
          </div>
        ` : ''}
      </div>
      
      <div class="account-actions-grid">
        <button class="account-action-btn" id="account-view-history">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Ver historial completo
        </button>
        ${!isPro ? `
          <button class="account-action-btn pro-btn" id="account-upgrade-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            Actualizar a Pro
          </button>
        ` : ''}
        <button class="account-action-btn danger" id="account-logout-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Cerrar sesión
        </button>
      </div>
    `;
    
    document.getElementById('account-view-history').onclick = () => {
      overlay.remove();
      if (window.openHistoryPanel) window.openHistoryPanel();
    };
    
    const upgradeBtn = document.getElementById('account-upgrade-btn');
    if (upgradeBtn) {
      upgradeBtn.onclick = () => {
        overlay.remove();
        openPricingModal();
      };
    }
    
    document.getElementById('account-logout-btn').onclick = async () => {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch(e) {}
      localStorage.removeItem('contextia_token');
      localStorage.removeItem('contextia_user_id');
      localStorage.removeItem('contextia_user_email');
      overlay.remove();
      window.dispatchEvent(new Event('contextia:authchange'));
    };
    
  } catch(err) {
    document.getElementById('account-modal-body').innerHTML =
      '<p style="color:var(--text-muted);font-size:var(--size-xsmall)">Error al cargar datos de cuenta.</p>';
  }
};

// ——— Modal de precios ———
window.openPricingModal = function() {
  if (document.getElementById('pricing-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'pricing-overlay';
  overlay.className = 'pricing-overlay';
  overlay.innerHTML = `
    <div class="pricing-modal">
      <div class="pricing-title">Elegí tu plan</div>
      <div class="pricing-subtitle">Pasá de 15 traducciones/día a uso completamente ilimitado</div>
      
      <div class="pricing-plans">
        <div class="pricing-plan">
          <div class="pricing-plan-name">MENSUAL</div>
          <div class="pricing-plan-price">$9.99</div>
          <div class="pricing-plan-period">por mes</div>
          <button class="pricing-plan-btn" id="btn-monthly">Suscribirme</button>
        </div>
        <div class="pricing-plan recommended">
          <div class="pricing-plan-name">ANUAL</div>
          <div class="pricing-plan-price">$79.99</div>
          <div class="pricing-plan-period">$6.66/mes · ahorrás 33%</div>
          <button class="pricing-plan-btn" id="btn-annual">Suscribirme</button>
        </div>
      </div>
      
      <ul class="pricing-features">
        <li>Traducciones ilimitadas</li>
        <li>Análisis lingüístico ilimitado</li>
        <li>Sistema de ejercicios y práctica</li>
        <li>Historial completo de traducciones</li>
        <li>Acceso anticipado a nuevas funciones</li>
      </ul>
      
      <button class="pricing-dismiss" id="pricing-dismiss">Ahora no</button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.getElementById('pricing-dismiss').onclick = () => overlay.remove();
  
  // Por ahora ambos botones muestran "próximamente" (Stripe a integrar después)
  ['btn-monthly', 'btn-annual'].forEach((id, i) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.onclick = () => {
        btn.textContent = 'Próximamente';
        btn.disabled = true;
        // TODO: Integrar Stripe Checkout aquí
        // window.location.href = STRIPE_CHECKOUT_URL
      };
    }
  });
};

// ——— Modal de bienvenida post-registro ———
window.showWelcomeProModal = function() {
  // No mostrar si ya fue visto
  if (localStorage.getItem('contextia_welcome_seen')) return;
  
  const overlay = document.createElement('div');
  overlay.className = 'welcome-pro-overlay';
  overlay.innerHTML = `
    <div class="welcome-pro-modal">
      <div class="welcome-pro-icon">!</div>
      <div class="welcome-pro-title">¡Bienvenido a ContextIA!</div>
      <div class="welcome-pro-desc">
        Empezás con <strong>15 traducciones diarias gratuitas</strong>.<br>
        Actualizá a Pro para acceso ilimitado a traducciones, análisis lingüístico, ejercicios e historial completo.
      </div>
      <button class="welcome-pro-cta" id="welcome-pro-cta">Conocé el plan Pro</button>
      <button class="welcome-pro-skip" id="welcome-pro-skip">Ahora no</button>
    </div>
  `;
  document.body.appendChild(overlay);
  localStorage.setItem('contextia_welcome_seen', '1');
  
  document.getElementById('welcome-pro-cta').onclick = () => {
    overlay.remove();
    openPricingModal();
  };
  document.getElementById('welcome-pro-skip').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
};

// ——— Escuchar cambio de auth ———
window.addEventListener('contextia:authchange', () => {
  // Guardar plan al hacer login/logout para que renderSessionHeader() lo use
  const token = localStorage.getItem('contextia_token');
  if (token) {
    fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      if (data.plan) localStorage.setItem('contextia_plan', data.plan);
    }).catch(() => {});
  } else {
    localStorage.removeItem('contextia_plan');
  }
});

// ——— Trigger modal bienvenida post-registro ———
// auth.js despacha 'contextia:authchange' al registrarse. Si el usuario se
// acaba de registrar (no tenía token antes), mostramos el modal.
(function() {
  const hadToken = !!localStorage.getItem('contextia_token');
  window.addEventListener('contextia:authchange', function onFirstAuth() {
    const hasToken = !!localStorage.getItem('contextia_token');
    if (!hadToken && hasToken) {
      setTimeout(() => window.showWelcomeProModal(), 500);
    }
    window.removeEventListener('contextia:authchange', onFirstAuth);
  });
})();
