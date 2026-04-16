(() => {
  const state = {
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    products: [],
    cart: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const fmt = (n) => `$${Number(n).toFixed(2)}`;

  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const res = await fetch(path, { ...opts, headers });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error((data && data.error) || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------- auth UI ----------

  function renderAuthArea() {
    const el = $('#authArea');
    if (state.user) {
      el.innerHTML = `
        <span class="greeting">Hi, <strong>${escapeHtml(state.user.name)}</strong></span>
        <button class="ghost" id="logoutBtn">Log out</button>
      `;
      $('#logoutBtn').addEventListener('click', logout);
    } else {
      el.innerHTML = `<button class="primary" id="openAuthBtn">Login / Register</button>`;
      $('#openAuthBtn').addEventListener('click', () => openModal('login'));
    }
  }

  function openModal(tab) {
    $('#authModal').classList.remove('hidden');
    switchTab(tab || 'login');
    const firstInput = $(`#${tab === 'register' ? 'registerForm' : 'loginForm'} input`);
    if (firstInput) firstInput.focus();
  }
  function closeModal() {
    $('#authModal').classList.add('hidden');
    $$('.form-error').forEach((e) => (e.textContent = ''));
  }
  function switchTab(name) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    $$('.pane').forEach((p) => p.classList.remove('active'));
    $(`#${name}Form`).classList.add('active');
  }

  async function handleAuth(e, endpoint) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    const errEl = form.querySelector('.form-error');
    errEl.textContent = '';
    try {
      const data = await api(endpoint, { method: 'POST', body: JSON.stringify(body) });
      setSession(data.token, data.user);
      closeModal();
      await loadCart();
    } catch (err) {
      errEl.textContent = err.message;
    }
  }

  function setSession(token, user) {
    state.token = token;
    state.user = user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    renderAuthArea();
    renderProducts();
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    state.token = null;
    state.user = null;
    state.cart = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    renderAuthArea();
    renderProducts();
    renderCart();
  }

  // ---------- products ----------

  async function loadProducts() {
    try {
      state.products = await api('/products');
      renderProducts();
    } catch (err) {
      $('#productGrid').innerHTML = `<p class="muted">Failed to load products: ${escapeHtml(err.message)}</p>`;
    }
  }

  function renderProducts() {
    const grid = $('#productGrid');
    if (!state.products.length) {
      grid.innerHTML = '<p class="muted">No products available.</p>';
      return;
    }
    grid.innerHTML = state.products.map((p) => {
      const disabled = !state.user || p.stock <= 0;
      const stockClass = p.stock <= 3 ? 'stock low' : 'stock';
      const stockLabel = p.stock <= 0 ? 'Out of stock' : `${p.stock} in stock`;
      const btnLabel = !state.user ? 'Log in to buy' : (p.stock <= 0 ? 'Out of stock' : 'Add to cart');
      return `
        <article class="product-card">
          <h3>${escapeHtml(p.name)}</h3>
          <p class="desc">${escapeHtml(p.description)}</p>
          <div class="row">
            <span class="price">${fmt(p.price)}</span>
            <span class="${stockClass}">${stockLabel}</span>
          </div>
          <button class="primary add-btn" data-id="${p.id}" ${disabled ? 'disabled' : ''}>${btnLabel}</button>
        </article>
      `;
    }).join('');
    grid.querySelectorAll('.add-btn').forEach((btn) => {
      btn.addEventListener('click', () => addToCart(btn.dataset.id));
    });
  }

  // ---------- cart ----------

  async function loadCart() {
    if (!state.user) { state.cart = null; renderCart(); return; }
    try {
      state.cart = await api('/cart');
    } catch (err) {
      state.cart = null;
      console.error('Failed to load cart:', err);
    }
    renderCart();
  }

  async function addToCart(productId) {
    if (!state.user) { openModal('login'); return; }
    try {
      state.cart = await api('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      setCheckoutMsg('', '');
      renderCart();
    } catch (err) {
      setCheckoutMsg(err.message, 'error');
    }
  }

  async function updateQty(productId, quantity) {
    try {
      state.cart = await api(`/cart/items/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      });
      renderCart();
    } catch (err) {
      setCheckoutMsg(err.message, 'error');
    }
  }

  async function removeItem(productId) {
    try {
      state.cart = await api(`/cart/items/${productId}`, { method: 'DELETE' });
      renderCart();
    } catch (err) {
      setCheckoutMsg(err.message, 'error');
    }
  }

  async function checkout() {
    setCheckoutMsg('', '');
    try {
      const order = await api('/orders', { method: 'POST' });
      state.cart = null;
      await loadCart();
      await loadProducts();
      setCheckoutMsg(
        `Order placed! ID ${order.id.slice(0, 8)}… — Total ${fmt(order.total)}`,
        'success'
      );
    } catch (err) {
      setCheckoutMsg(err.message, 'error');
    }
  }

  function renderCart() {
    const body = $('#cartBody');
    const footer = $('#cartFooter');

    if (!state.user) {
      body.innerHTML = '<p class="muted">Log in to see your cart.</p>';
      footer.classList.add('hidden');
      return;
    }
    if (!state.cart || !state.cart.items || state.cart.items.length === 0) {
      body.innerHTML = '<p class="muted">Your cart is empty.</p>';
      footer.classList.add('hidden');
      return;
    }

    body.innerHTML = state.cart.items.map((item) => `
      <div class="cart-item">
        <div>
          <div class="name">${escapeHtml(item.name)}</div>
          <div class="sub">${fmt(item.price)} each</div>
          <div class="qty-row">
            <button data-act="dec" data-id="${item.productId}" ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
            <span class="qty">${item.quantity}</span>
            <button data-act="inc" data-id="${item.productId}">+</button>
            <button class="remove-btn" data-act="rm" data-id="${item.productId}">Remove</button>
          </div>
        </div>
        <strong>${fmt(item.subtotal)}</strong>
      </div>
    `).join('');

    $('#cartTotal').textContent = fmt(state.cart.total);
    footer.classList.remove('hidden');

    body.querySelectorAll('button[data-act]').forEach((btn) => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const item = state.cart.items.find((i) => i.productId === id);
      btn.addEventListener('click', () => {
        if (act === 'inc') updateQty(id, item.quantity + 1);
        else if (act === 'dec') updateQty(id, item.quantity - 1);
        else if (act === 'rm') removeItem(id);
      });
    });
  }

  function setCheckoutMsg(text, kind) {
    const el = $('#checkoutMsg');
    el.textContent = text;
    el.className = 'checkout-msg' + (kind ? ' ' + kind : '');
  }

  // ---------- utilities ----------

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ---------- bootstrap ----------

  function bindUI() {
    $('#closeModal').addEventListener('click', closeModal);
    $('#authModal').addEventListener('click', (e) => {
      if (e.target.id === 'authModal') closeModal();
    });
    $$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    $('#loginForm').addEventListener('submit', (e) => handleAuth(e, '/auth/login'));
    $('#registerForm').addEventListener('submit', (e) => handleAuth(e, '/auth/register'));
    $('#checkoutBtn').addEventListener('click', checkout);
  }

  async function init() {
    bindUI();
    renderAuthArea();
    await loadProducts();
    if (state.user) await loadCart(); else renderCart();
  }

  init();
})();
