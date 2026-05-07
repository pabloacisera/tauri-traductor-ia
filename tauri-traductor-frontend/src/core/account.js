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
    background: rgba(0,0,0,0.8);
    z-index: 8500;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }
  .account-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    width: min(420px, 95vw);
    padding: var(--space-6);
    font-family: var(--font-mono);
  }
  .account-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-6);
  }
  .account-avatar-large {
    width: 48px; height: 48px;
    border-radius: 50%;
    background: var(--bg-tertiary);
    border: 1px solid var(--accent-color);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 700;
    color: var(--accent-color);
  }
  .account-plan-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: var(--radius-full);
    font-size: var(--size-tiny);
    font-weight: 700;
    letter-spacing: 1px;
  }
  .account-plan-badge.free { background: #222; color: #888; border: 1px solid #333; }
  .account-plan-badge.pro { background: rgba(16,185,129,0.15); color: var(--accent-color); border: 1px solid var(--accent-color); }
  .account-stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border-color);
    font-size: var(--size-xsmall);
  }
  .account-stat-label { color: var(--text-muted); }
  .account-stat-value { color: var(--text-primary); font-weight: 600; }
  .account-usage-bar {
    background: #222;
    border-radius: var(--radius-full);
    height: 4px;
    margin-top: var(--space-1);
    overflow: hidden;
  }
  .account-usage-bar-fill {
    height: 100%;
    background: var(--accent-color);
    border-radius: var(--radius-full);
    transition: width 0.5s ease;
  }
  .account-action-btn {
    width: 100%;
    background: none;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: var(--size-xsmall);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
    margin-top: var(--space-2);
  }
  .account-action-btn:hover { border-color: var(--accent-color); color: var(--accent-color); }
  .account-action-btn.danger:hover { border-color: #e74c3c; color: #e74c3c; }
  .account-close-btn { background:none;border:none;color:var(--text-muted);font-size:22px;cursor:pointer; }

  /* ——— Pricing modal ——— */
  .pricing-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    z-index: 9000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }
  .pricing-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    width: min(500px, 95vw);
    padding: var(--space-8);
    font-family: var(--font-mono);
  }
  .pricing-title {
    color: var(--text-primary);
    font-size: var(--size-h1);
    font-weight: 700;
    text-align: center;
    margin-bottom: var(--space-2);
  }
  .pricing-subtitle {
    color: var(--text-muted);
    font-size: var(--size-xsmall);
    text-align: center;
    margin-bottom: var(--space-6);
  }
  .pricing-plans {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  .pricing-plan {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    text-align: center;
  }
  .pricing-plan.recommended {
    border-color: var(--accent-color);
    position: relative;
  }
  .pricing-plan.recommended::before {
    content: "Recomendado";
    position: absolute;
    top: -10px;
    left: 50%; transform: translateX(-50%);
    background: var(--accent-color);
    color: #000;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    white-space: nowrap;
  }
  .pricing-plan-name { font-size: var(--size-xsmall); color: var(--text-muted); margin-bottom: var(--space-1); }
  .pricing-plan-price {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--accent-color);
    margin-bottom: var(--space-1);
  }
  .pricing-plan-period { font-size: var(--size-tiny); color: var(--text-muted); margin-bottom: var(--space-3); }
  .pricing-plan-btn {
    width: 100%;
    background: var(--accent-color);
    color: #000;
    border: none;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--size-tiny);
    cursor: pointer;
    transition: opacity var(--transition-fast);
  }
  .pricing-plan-btn:hover { opacity: 0.85; }
  .pricing-features {
    list-style: none;
    margin-top: var(--space-4);
  }
  .pricing-features li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--size-xsmall);
    color: var(--text-secondary);
    padding: var(--space-1) 0;
  }
  .pricing-features li::before { content: "✓"; color: var(--accent-color); font-weight: 700; }
  .pricing-dismiss {
    background: none;
    border: none;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: var(--size-tiny);
    cursor: pointer;
    width: 100%;
    text-align: center;
    padding: var(--space-2);
    margin-top: var(--space-2);
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
      <div class="account-modal-header">
        <div>
          <div class="account-avatar-large" id="account-avatar">...</div>
        </div>
        <button class="account-close-btn" id="account-close-btn">&times;</button>
      </div>
      <div id="account-modal-body" style="display:flex;align-items:center;justify-content:center;min-height:100px">
        <div style="width:24px;height:24px;border:2px solid #333;border-top-color:var(--accent-color);border-radius:50%;animation:spin 0.8s linear infinite"></div>
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
    
    document.getElementById('account-avatar').textContent = initial;
    
    document.getElementById('account-modal-body').innerHTML = `
      <div style="margin-bottom:var(--space-2)">
        <span style="font-size:var(--size-small);color:var(--text-primary)">${email}</span>
        <span class="account-plan-badge ${isPro ? 'pro' : 'free'}" style="margin-left:var(--space-2)">
          ${isPro ? 'PRO' : 'FREE'}
        </span>
      </div>
      
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
        <div class="account-stat-row">
          <span class="account-stat-label">Plan vence</span>
          <span class="account-stat-value">${new Date(user.subscription_end).toLocaleDateString('es-AR')}</span>
        </div>
      ` : ''}
      
      <div style="margin-top:var(--space-4)">
        <button class="account-action-btn" id="account-view-history">
          Ver historial completo
        </button>
        ${!isPro ? `
          <button class="account-action-btn" id="account-upgrade-btn" style="border-color:var(--accent-color);color:var(--accent-color)">
            Actualizar a Pro
          </button>
        ` : ''}
        <button class="account-action-btn danger" id="account-logout-btn">
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
