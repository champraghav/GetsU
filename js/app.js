/* ============================================================
   GETSU — SHOP LOGIC
   Settings live in js/config.js, products in js/products.js.
   Pages are hash-routed so it works on plain GitHub Pages:
       #/        home          #/cart      review & edit the cart
       #/checkout  delivery details + payment choice
       #/order     pay / send / confirm   (with Cancel payment)
   ============================================================ */
(() => {
'use strict';

/* ---------- tiny helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const money = n => '₹' + Number(n).toLocaleString('en-IN');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const productById = id => PRODUCTS.find(p => p.id === Number(id));

const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: carry on */ } },
};

const MAX_QTY = CONFIG.maxQty || 20;
const CART_KEY = 'getsuCart';
const HISTORY_KEY = 'getsuOrders';
const WA_NUMBER = String(CONFIG.whatsappNumber || '').replace(/\D/g, '');
const razorpayOn = () => Boolean(CONFIG.razorpayKeyId);
const upiOn = () => Boolean(CONFIG.upiVpa);

const ICONS = {
    breakfast: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16l-1.5 6a2 2 0 0 1-2 1.5h-9a2 2 0 0 1-2-1.5z"/><path d="M4 12a8 8 0 0 1 16 0"/><line x1="9" y1="4" x2="8" y2="7"/><line x1="15" y1="4" x2="16" y2="7"/></svg>',
    snacks: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="8" rx="1.5"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="17" y1="8" x2="17" y2="16"/></svg>',
    chevron: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
};

/* ---------- analytics (all optional: the shop works if they fail to load) ---------- */
function ga(event, params) { try { if (typeof gtag === 'function') gtag('event', event, params || {}); } catch (e) { /* ignore */ } }

let database = null;
try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(FIREBASE_CONFIG);
        database = firebase.database();
    }
} catch (e) { console.warn('Firebase unavailable; anonymous order records will be skipped.', e); }

function fbPush(path, data) { if (!database) return null; try { return database.ref(path).push(data); } catch (e) { return null; } }
function fbUpdate(path, data) { if (!database) return; try { database.ref(path).update(data); } catch (e) { /* ignore */ } }

function userId() {
    let id = null;
    try { id = localStorage.getItem('getsuUserId'); } catch (e) { /* ignore */ }
    if (!id) {
        id = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        try { localStorage.setItem('getsuUserId', id); } catch (e) { /* ignore */ }
    }
    return id;
}

/* ============================================================
   CART
   Only { id, qty } is saved. Name, price and photo are always read
   from the catalogue, so a saved cart can never show a stale price
   or a discontinued product.
   ============================================================ */
let cart = loadCart();

function loadCart() {
    const raw = store.get(CART_KEY);
    if (!Array.isArray(raw)) return [];
    const out = [];
    raw.forEach(item => {
        const p = productById(item && item.id);
        if (!p) return;
        const qty = clamp(parseInt(item.qty, 10) || 1, 1, MAX_QTY);
        const have = out.find(x => x.id === p.id);
        if (have) have.qty = Math.min(MAX_QTY, have.qty + qty); else out.push({ id: p.id, qty });
    });
    return out;
}

const saveCart = () => store.set(CART_KEY, cart);
const cartLines = () => cart.map(i => ({ product: productById(i.id), qty: i.qty })).filter(l => l.product);

function totals(lines = cartLines()) {
    const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
    const tax = Math.round(subtotal * (CONFIG.taxRate || 0));
    return { subtotal, tax, total: subtotal + tax, count: lines.reduce((s, l) => s + l.qty, 0) };
}

function cartChanged() {
    saveCart();
    renderCartBadge();
    if (view === 'cart') keepFocus($('#cartBody'), renderCart);
}

function addToCart(id, qty = 1) {
    const p = productById(id);
    if (!p) return;
    const line = cart.find(i => i.id === p.id);
    if (line) {
        if (line.qty + qty > MAX_QTY) { toast(`Max ${MAX_QTY} per product. Email us for a bulk order.`); return false; }
        line.qty += qty;
    } else {
        cart.push({ id: p.id, qty });
    }
    ga('add_to_cart', { value: p.price * qty, currency: 'INR', items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: qty }] });
    fbPush('cart_events', { product_id: p.id, product_name: p.name, price: p.price, timestamp: new Date().toISOString(), user_id: userId() });
    cartChanged();
    return true;
}

function changeQty(id, delta) {
    const line = cart.find(i => i.id === Number(id));
    if (!line) return;
    const next = line.qty + delta;
    if (next > MAX_QTY) { toast(`Max ${MAX_QTY} per product. Email us for a bulk order.`); return; }
    if (next < 1) return;
    line.qty = next;
    cartChanged();
}

function removeFromCart(id) {
    cart = cart.filter(i => i.id !== Number(id));
    cartChanged();
}

function clearCart() { cart = []; cartChanged(); }

function renderCartBadge() {
    const t = totals();
    const badge = $('#cartCount');
    badge.textContent = t.count;
    badge.hidden = t.count === 0;
    $('#cartLink').setAttribute('aria-label', t.count ? `Cart, ${t.count} item${t.count === 1 ? '' : 's'}` : 'Cart, empty');

    // phone-only bar that keeps the cart in reach while browsing the shop
    const bar = $('#cartBar');
    const show = t.count > 0 && view === 'home';
    bar.hidden = !show;
    document.body.classList.toggle('has-cart-bar', show);
    if (show) {
        $('#cartBarCount').textContent = `${t.count} item${t.count === 1 ? '' : 's'} in your cart`;
        $('#cartBarTotal').textContent = money(t.total);
    }
}

/* Re-rendering replaces the buttons, so put keyboard focus back where it was. */
function keepFocus(root, render) {
    const a = document.activeElement;
    let sel = null;
    if (a && root.contains(a) && a.dataset && a.dataset.action) {
        sel = `[data-action="${a.dataset.action}"]` + (a.dataset.id ? `[data-id="${a.dataset.id}"]` : '');
    }
    render();
    if (sel) {
        const el = $(sel, root);
        if (el && !el.disabled) el.focus();
    }
}

/* ============================================================
   PRODUCT CARDS (home)
   ============================================================ */
function plateHTML(p, withLabel) {
    return `<span class="pc-plate" aria-hidden="true"><span class="pc-plate-icon">${ICONS[p.category] || ICONS.snacks}</span>` +
        (withLabel ? `<span class="pc-plate-label">GetsU · ${esc(CATEGORIES[p.category] || '')}</span>` : '') + '</span>';
}

function thumbHTML(p, withLabel) {
    if (p.image) {
        return `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" data-fallback="${esc(p.id)}">`;
    }
    return plateHTML(p, withLabel);
}

const bgStyle = p => (p.imageBg ? ` style="--media-bg:${esc(p.imageBg)}"` : '');

function macrosHTML(p) {
    const n = p.nutrition;
    if (!n) {
        return `<div class="pc-macros" id="macros-${p.id}"><div class="pc-macros-empty">
            <strong>Nutrition panel coming soon</strong>
            We're finalising the verified figures. The full declaration is printed on every pack.
        </div></div>`;
    }
    const tiles = [['kcal', 'Energy', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['sugar', 'Sugars', 'g'], ['fat', 'Fat', 'g'], ['fibre', 'Fibre', 'g']];
    return `<div class="pc-macros" id="macros-${p.id}">
        <div class="pc-macros-head"><strong>Nutrition</strong><span>Per ${esc(n.per)}</span></div>
        <div class="pc-macro-grid">${tiles.map(([k, label, unit], i) =>
            `<div class="pc-macro" style="--i:${i}"><b>${n[k]}<small>${unit}</small></b><span>${label}</span></div>`).join('')}</div>
        <p class="pc-macros-foot">Declared values · see the pack</p>
    </div>`;
}

function cardHTML(p) {
    return `<article class="pcard" data-id="${p.id}">
        <div class="pc-media"${bgStyle(p)}>
            ${thumbHTML(p, true)}
            ${macrosHTML(p)}
            <button type="button" class="pc-toggle" data-action="toggle-macros" aria-expanded="false" aria-controls="macros-${p.id}">Nutrition ${ICONS.chevron}</button>
        </div>
        <div class="pc-body">
            <p class="pc-eyebrow">${esc(CATEGORIES[p.category] || '')}${p.pack ? ' · ' + esc(p.pack) : ''}</p>
            <h3 class="pc-name-wrap"><button type="button" class="pc-name" data-action="open-product" data-id="${p.id}">${esc(p.name)}</button></h3>
            <ul class="pc-chips">${p.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
            <div class="pc-foot">
                <div class="pc-price">${money(p.price)}<small>plus tax at checkout</small></div>
                <button type="button" class="btn btn-primary pc-add" data-action="add" data-id="${p.id}" aria-label="Add ${esc(p.name)} to cart">Add to cart</button>
            </div>
        </div>
    </article>`;
}

function renderProducts() {
    $('#productGrid').innerHTML = PRODUCTS.map(cardHTML).join('');
}

/* A photo that fails to load falls back to the designed stand-in. */
document.addEventListener('error', e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;
    const p = productById(img.dataset.fallback);
    if (!p) return;
    const holder = document.createElement('span');
    holder.innerHTML = plateHTML(p, true);
    img.replaceWith(holder.firstChild);
}, true);

/* ============================================================
   PRODUCT DETAIL (pop-up)
   ============================================================ */
function nutritionPanelHTML(p) {
    const n = p.nutrition;
    if (!n) {
        return `<div class="nutri nutri-pending">
            <div class="nutri-head"><span>Nutrition</span><span>Coming soon</span></div>
            <div class="nutri-note"><p>We're finalising the verified nutrition panel for this product and will publish it here as soon as it's confirmed. The full declaration is printed on every pack — or ask us at <a href="mailto:${esc(CONFIG.businessEmail)}">${esc(CONFIG.businessEmail)}</a>.</p></div>
        </div>`;
    }
    const row = (label, val, sub) => `<div class="nutri-row${sub ? ' sub' : ''}"><span>${label}</span><strong>${val}</strong></div>`;
    return `<div class="nutri">
        <div class="nutri-head"><span>Nutrition</span><span>Per ${esc(n.per)}</span></div>
        ${row('Energy', n.kcal + ' kcal')}${row('Protein', n.protein + ' g')}${row('Carbohydrate', n.carbs + ' g')}
        ${row('of which sugars', n.sugar + ' g', true)}${row('Fat', n.fat + ' g')}${row('Fibre', n.fibre + ' g')}
    </div>`;
}

let detailQty = 1;

function openProduct(id) {
    const p = productById(id);
    if (!p) return;
    detailQty = 1;
    $('#productBody').innerHTML = `
        <div class="pd-head">
            <div class="pd-thumb"${bgStyle(p)}>${thumbHTML(p, false)}</div>
            <div>
                <p class="pc-eyebrow">${esc(CATEGORIES[p.category] || '')}${p.pack ? ' · ' + esc(p.pack) : ''}</p>
                <h2 class="display">${esc(p.name)}</h2>
                <div class="pd-price">${money(p.price)}</div>
            </div>
        </div>
        <p>${esc(p.desc)}</p>
        ${nutritionPanelHTML(p)}
        <div class="pd-block"><h3>Ingredients</h3><p>${esc(p.ingredients)}</p></div>
        <div class="pd-block"><h3>Allergens</h3><p><strong>Contains:</strong> ${esc(p.allergens)}. Packed in a facility that also handles milk and nuts. Always check the pack if you have an allergy.</p></div>
        <div class="pd-buy">
            <div class="stepper" role="group" aria-label="Quantity">
                <button type="button" data-action="detail-dec" aria-label="Decrease quantity">−</button>
                <output id="detailQty" aria-live="polite">1</output>
                <button type="button" data-action="detail-inc" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="btn btn-primary" data-action="detail-add" data-id="${p.id}">Add to cart · ${money(p.price)}</button>
        </div>`;
    openModal('productModal');
}

/* ============================================================
   VALIDATION
   ============================================================ */
const normalizePhone = v => {
    let d = String(v).replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    return d;
};

const VALIDATORS = {
    name: v => (v.trim().length >= 2 ? '' : 'Please enter your full name.'),
    phone: v => (/^[6-9]\d{9}$/.test(normalizePhone(v)) ? '' : 'Enter a valid 10-digit Indian mobile number.'),
    email: v => (!v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address, or leave it blank.'),
    address: v => (v.trim().length >= 6 ? '' : 'Please enter your house number, street and area.'),
    city: v => (v.trim().length >= 2 ? '' : 'Please enter your city.'),
    state: v => (v ? '' : 'Please choose your state.'),
    pincode: v => (/^[1-9]\d{5}$/.test(v.trim()) ? '' : 'Enter a valid 6-digit pincode.'),
};

const fieldInput = name => $(`#checkoutForm [name="${name}"]`);

function setFieldError(name, message) {
    const wrap = $(`.field[data-field="${name}"]`);
    const input = fieldInput(name);
    const err = $('#err-' + name);
    if (!wrap || !input || !err) return;
    wrap.classList.toggle('invalid', Boolean(message));
    err.hidden = !message;
    err.textContent = message || '';
    if (message) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', 'err-' + name);
    } else {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
    }
}

function validateField(name) {
    const input = fieldInput(name);
    const msg = VALIDATORS[name](input.value);
    setFieldError(name, msg);
    return !msg;
}

function validateForm() {
    let firstBad = null;
    Object.keys(VALIDATORS).forEach(name => {
        if (!validateField(name) && !firstBad) firstBad = fieldInput(name);
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
}

function readDetails() {
    const v = name => (fieldInput(name).value || '').trim();
    return {
        name: v('name'), phone: normalizePhone(fieldInput('phone').value), email: v('email'),
        address: v('address'), city: v('city'), state: v('state'), pincode: v('pincode'),
        landmark: v('landmark'), notes: v('notes'),
    };
}

/* ============================================================
   ORDERS
   The customer's details exist only in memory (`currentOrder`),
   long enough to build the message or open the payment window.
   They are never written to localStorage or to our database.
   ============================================================ */
const PAY_LABEL = { razorpay: 'Online (Razorpay)', upi: 'UPI', later: 'Pay after confirmation' };
let payMethod = null;
let currentOrder = null;

function statusOf(o) {
    if (o.cancelled) return 'cancelled';
    if (o.paid === 'verified') return 'paid';
    if (o.sent) return 'sent';
    return 'pending';
}
const canCancel = o => !o.cancelled && o.paid === 'none' && !o.sent;
const isBusy = o => o.payState === 'opening' || o.payState === 'open';

function strippedOrder(o) {
    return { id: o.id, date: o.date, items: o.items.map(i => ({ name: i.name, qty: i.qty, price: i.price })), subtotal: o.subtotal, tax: o.tax, total: o.total, method: o.method, status: statusOf(o) };
}

function readHistory() {
    const list = store.get(HISTORY_KEY);
    if (!Array.isArray(list)) return [];
    // older versions stored `sent` + `pending_payment`
    return list.map(o => (o.status === 'pending_payment' ? { ...o, status: o.sent ? 'sent' : 'pending' } : o));
}
const writeHistory = list => store.set(HISTORY_KEY, list.slice(-20));

function saveHistory(o) {
    const list = readHistory().filter(x => x.id !== o.id);
    list.push(strippedOrder(o));
    writeHistory(list);
}

function syncOrder(o, extraRemote) {
    const status = statusOf(o);
    const list = readHistory();
    const mine = list.find(x => x.id === o.id);
    if (mine) { mine.status = status; writeHistory(list); } else { saveHistory(o); }
    if (o.firebaseKey) fbUpdate('orders/' + o.firebaseKey, Object.assign({ status }, extraRemote || {}));
}

function buildOrder(details, lines, method) {
    const t = totals(lines);
    return {
        id: 'GU' + Date.now().toString().slice(-8),
        date: new Date().toISOString(),
        items: lines.map(l => ({ id: l.product.id, name: l.product.name, pack: l.product.pack, qty: l.qty, price: l.product.price })),
        subtotal: t.subtotal, tax: t.tax, total: t.total,
        method, customer: details,
        paid: 'none', sent: false, cancelled: false,
        paymentId: null, payState: 'idle', payError: '', cancelAsk: false, firebaseKey: null, rzp: null,
    };
}

function placeOrder(details, method) {
    const lines = cartLines();
    if (!lines.length) { location.hash = '#/cart'; return; }

    // starting a fresh order replaces any unfinished one
    if (currentOrder && canCancel(currentOrder)) cancelOrderQuietly(currentOrder);

    const order = buildOrder(details, lines, method);
    currentOrder = order;

    ga('begin_checkout', { value: order.total, currency: 'INR', items: order.items.map(i => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.qty })) });

    // Anonymous on purpose: this database's config sits in public code, so it holds
    // WHAT was ordered and for how much — never who ordered it.
    const ref = fbPush('orders', {
        order_id: order.id, date: order.date, method, status: 'pending',
        items_count: order.items.length, subtotal: order.subtotal, tax: order.tax, total: order.total,
        products: order.items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    });
    if (ref && ref.key) order.firebaseKey = ref.key;

    saveHistory(order);
    location.hash = '#/order';
    // Started from the button press itself, so the payment window opens at once.
    if (method === 'razorpay') startRazorpay();
}

function cancelOrderQuietly(o) {
    o.cancelled = true;
    try { if (o.rzp && o.rzp.close) o.rzp.close(); } catch (e) { /* ignore */ }
    syncOrder(o, { cancelled_at: new Date().toISOString() });
}

/* ---------- the message the customer sends us ---------- */
function orderText(o) {
    const c = o.customer;
    const lines = o.items.map(i => `${i.name} x${i.qty} — ${money(i.price * i.qty)}`).join('\n');
    let pay = 'Payment: ' + PAY_LABEL[o.method];
    if (o.paid === 'verified') pay = 'Payment: PAID online via Razorpay' + (o.paymentId ? ' (' + o.paymentId + ')' : '');
    return `GetsU Order ${o.id}\n\n${lines}\n\nSubtotal: ${money(o.subtotal)}\nTax: ${money(o.tax)}\nTotal: ${money(o.total)}\n${pay}\n\n` +
        `Deliver to:\n${c.name}\n${c.address}\n${c.city}, ${c.state} ${c.pincode}\nPhone: ${c.phone}` +
        (c.email ? `\nEmail: ${c.email}` : '') + (c.landmark ? `\nLandmark: ${c.landmark}` : '') + (c.notes ? `\n\nNotes: ${c.notes}` : '');
}
const waHref = o => (WA_NUMBER ? `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(orderText(o))}` : '');
const mailHref = o => `mailto:${CONFIG.businessEmail}?subject=${encodeURIComponent('GetsU Order ' + o.id)}&body=${encodeURIComponent(orderText(o))}`;

/* ---------- Razorpay (loaded only when someone actually reaches checkout) ---------- */
let rzpLoad = null;
function ensureRazorpay() {
    if (window.Razorpay) return Promise.resolve();
    if (!rzpLoad) {
        rzpLoad = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://checkout.razorpay.com/v1/checkout.js';
            s.async = true;
            s.onload = () => (window.Razorpay ? resolve() : reject(new Error('Razorpay missing')));
            s.onerror = () => { rzpLoad = null; reject(new Error('Razorpay failed to load')); };
            document.head.appendChild(s);
        });
    }
    return rzpLoad;
}

function setPayState(o, state, error) {
    o.payState = state;
    o.payError = error || '';
    if (view === 'order' && currentOrder === o) renderOrder();
}

async function startRazorpay() {
    const o = currentOrder;
    if (!o || o.cancelled || o.paid !== 'none' || isBusy(o)) return;
    setPayState(o, 'opening');
    try { await ensureRazorpay(); } catch (e) {
        setPayState(o, 'failed', 'We could not load the payment window. Please check your connection and try again.');
        return;
    }
    if (o.cancelled) return; // cancelled while the window was loading

    const c = o.customer;
    let rzp;
    try {
        rzp = new window.Razorpay({
            key: CONFIG.razorpayKeyId,
            amount: Math.round(o.total * 100),          // Razorpay works in paise
            currency: 'INR',
            name: CONFIG.brand,
            description: 'Order ' + o.id,
            image: new URL('logo.png', document.baseURI).href,
            prefill: { name: c.name, email: c.email || '', contact: c.phone },
            // Shows in your Razorpay dashboard, so you can see where to ship a paid order.
            notes: {
                order_id: o.id,
                customer: c.name,
                phone: c.phone,
                address: `${c.address}, ${c.city}, ${c.state} ${c.pincode}` + (c.landmark ? ` (${c.landmark})` : ''),
                items: o.items.map(i => `${i.name} x${i.qty}`).join('; ').slice(0, 250),
            },
            theme: { color: '#CC5500' },
            handler: response => markPaid(o, response && response.razorpay_payment_id),
            modal: {
                confirm_close: true,
                ondismiss: () => { if (o.paid === 'none' && !o.cancelled) setPayState(o, 'dismissed'); },
            },
        });
    } catch (e) {
        setPayState(o, 'failed', 'The payment window could not be started. Please try again.');
        return;
    }
    o.rzp = rzp;
    rzp.on('payment.failed', r => setPayState(o, 'failed', (r && r.error && r.error.description) || 'The payment did not go through.'));
    setPayState(o, 'open');
    rzp.open();
}

/* ---------- completing an order ---------- */
// IMPORTANT: this is a client-only site, so "paid" means "Razorpay's window told the
// browser the payment succeeded". There is no server to verify the signature.
// Always confirm the money in your Razorpay dashboard before you ship.
function markPaid(o, paymentId) {
    if (o.paid === 'verified') return;
    o.paid = 'verified';
    o.paymentId = paymentId || null;
    o.paidAt = new Date().toISOString();
    o.payState = 'idle';
    ga('purchase', { transaction_id: o.id, value: o.total, currency: 'INR', tax: o.tax, shipping: 0, items: o.items.map(i => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.qty })) });
    fbPush('payments', { order_id: o.id, method: 'razorpay', verified: true, razorpay_payment_id: paymentId || null, amount: o.total, timestamp: new Date().toISOString() });
    syncOrder(o, { payment_method: 'razorpay', razorpay_payment_id: paymentId || null, paid_at: new Date().toISOString() });
    finishCheckout();
    toast('Payment received — your bill is ready below.');
    showBill();
}

// The bill appears the moment payment succeeds: bring it into view and put
// keyboard / screen-reader focus on it.
function showBill() {
    requestAnimationFrame(() => {
        const t = $('#billTitle');
        if (!t) return;
        $('#bill').scrollIntoView({ behavior: 'auto', block: 'start' });
        t.focus({ preventScroll: true });
    });
}

function markSent(o) {
    if (o.sent) return;
    o.sent = true;
    syncOrder(o);
    finishCheckout();
}

// Once an order is paid or sent, the basket has done its job and the typed details go.
function finishCheckout(rerender = true) {
    clearCart();
    $('#checkoutForm').reset();
    if (rerender && view === 'order') renderOrder();
}

function cancelOrder(o) {
    if (!canCancel(o) || isBusy(o)) return;
    cancelOrderQuietly(o);
    currentOrder = null;
    ga('cancel_order', { transaction_id: o.id, value: o.total, currency: 'INR' });
    location.hash = '#/cart';
    toast('Payment cancelled. Your cart is exactly as you left it.');
}

/* ============================================================
   VIEWS
   ============================================================ */
let view = 'home';
let lastRouteWasInitial = true;
const VIEW_ORDER = { cart: 1, checkout: 2, order: 3 };

function summaryRowsHTML(t) {
    const pct = Math.round((CONFIG.taxRate || 0) * 1000) / 10;
    return `<div class="sum-row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
        <div class="sum-row"><span>Tax${pct ? ` (${pct}%)` : ''}</span><span>${money(t.tax)}</span></div>
        <div class="sum-row"><span>Shipping</span><span>Free</span></div>
        <div class="sum-row total"><span>Total</span><span>${money(t.total)}</span></div>`;
}

/* ---------- CART PAGE ---------- */
function renderCart() {
    const body = $('#cartBody');
    const lines = cartLines();
    if (!lines.length) {
        body.innerHTML = `<div class="empty"><h2 class="display">Your cart is empty</h2><p>Add a product and it will show up here.</p><a class="btn btn-primary" href="#products">Browse products</a></div>`;
        return;
    }
    const t = totals(lines);
    body.innerHTML = `<div class="cart-layout">
        <ul class="cart-list">${lines.map(({ product: p, qty }) => `
            <li class="cart-row">
                <div class="cart-img"${bgStyle(p)}>${thumbHTML(p, false)}</div>
                <div class="cart-info">
                    <div class="cart-name">${esc(p.name)}</div>
                    <div class="cart-meta">${p.pack ? esc(p.pack) + ' · ' : ''}${money(p.price)} each</div>
                </div>
                <div class="cart-qty">
                    <div class="stepper" role="group" aria-label="Quantity of ${esc(p.name)}">
                        <button type="button" data-action="qty-dec" data-id="${p.id}" aria-label="Decrease quantity of ${esc(p.name)}" ${qty <= 1 ? 'disabled' : ''}>−</button>
                        <output aria-live="polite">${qty}</output>
                        <button type="button" data-action="qty-inc" data-id="${p.id}" aria-label="Increase quantity of ${esc(p.name)}" ${qty >= MAX_QTY ? 'disabled' : ''}>+</button>
                    </div>
                    <button type="button" class="cart-remove" data-action="remove" data-id="${p.id}" aria-label="Remove ${esc(p.name)} from cart">Remove</button>
                </div>
                <div class="cart-total">${money(p.price * qty)}</div>
            </li>`).join('')}
        </ul>
        <aside class="panel summary" aria-label="Order summary">
            <h2 class="panel-title">Order summary</h2>
            ${summaryRowsHTML(t)}
            <div class="sum-actions">
                <a class="btn btn-primary btn-lg btn-block" href="#/checkout">Continue to delivery &amp; payment</a>
                <a class="btn btn-ghost-dark btn-block" href="#products">Add more products</a>
            </div>
            <p class="sum-note">Free delivery across India. Wrong or damaged? We replace it within 48 hours.</p>
        </aside>
    </div>`;
}

/* ---------- CHECKOUT PAGE ---------- */
function availableMethods() {
    const m = [];
    if (razorpayOn()) m.push('razorpay');
    if (upiOn()) m.push('upi');
    m.push('later');
    return m;
}

function methodInfo(m) {
    if (m === 'razorpay') return { title: 'Pay online now', desc: 'UPI, cards, netbanking and wallets — securely through Razorpay.' };
    if (m === 'upi') return { title: 'Pay by UPI now', desc: 'Scan a QR code or open your UPI app with the exact amount filled in.' };
    return {
        title: WA_NUMBER ? 'Send order on WhatsApp, pay after we confirm' : 'Send order by email, pay after we confirm',
        desc: 'We check stock and delivery first, then you pay by UPI or bank transfer.',
    };
}

function renderCheckout() {
    const methods = availableMethods();
    if (!methods.includes(payMethod)) payMethod = methods[0];
    $('#payOptions').innerHTML = methods.map(m => {
        const info = methodInfo(m);
        return `<label class="pay-opt"><input type="radio" name="payMethod" value="${m}"${m === payMethod ? ' checked' : ''}>
            <span class="pay-radio" aria-hidden="true"></span>
            <span><strong>${esc(info.title)}</strong><span class="pay-desc">${esc(info.desc)}</span></span></label>`;
    }).join('');

    const lines = cartLines();
    const t = totals(lines);
    $('#checkoutSummary').innerHTML = `
        <h2 class="panel-title">Order summary</h2>
        <div class="sum-lines">${lines.map(({ product: p, qty }) =>
            `<div class="sum-line"><span>${esc(p.name)} × ${qty}</span><span>${money(p.price * qty)}</span></div>`).join('')}</div>
        ${summaryRowsHTML(t)}
        <a class="sum-link" href="#/cart">← Edit cart</a>`;
    updatePlaceButton();
    if (razorpayOn()) ensureRazorpay().catch(() => {}); // warm up so the payment window opens instantly
}

function updatePlaceButton() {
    const btn = $('#placeOrderBtn');
    const note = $('#placeNote');
    const t = totals();
    if (payMethod === 'razorpay') {
        btn.textContent = `Pay ${money(t.total)} securely`;
        note.textContent = 'You can cancel the payment at any time before it goes through.';
    } else if (payMethod === 'upi') {
        btn.textContent = 'Continue to UPI payment';
        note.textContent = 'Next you will see a QR code and a UPI ID to pay.';
    } else {
        btn.textContent = 'Review & send order';
        note.textContent = `Next, your order opens ${WA_NUMBER ? 'in WhatsApp' : 'in your email app'} for you to send. It isn't placed until you press send.`;
    }
}

/* ---------- ORDER PAGE ---------- */
function orderCopy(o, st) {
    if (st === 'cancelled') return ['Order cancelled', 'No payment was taken. Your cart is still here if you want to change it and try again.'];
    if (st === 'paid') return ['Payment received — thank you', `Your order ${o.id} is confirmed and your bill is below. Print or save it now, and we'll message you the delivery details.`];
    if (st === 'sent') {
        return ['Almost there — press send', `If ${WA_NUMBER ? 'WhatsApp' : 'your email app'} opened, just press send. We reply within a day to confirm stock, delivery and payment.`];
    }
    if (o.method === 'razorpay') return ['Complete your payment', `Pay ${money(o.total)} to confirm your order. Nothing is placed until the payment succeeds.`];
    if (o.method === 'upi') return ['Pay by UPI', 'Scan the QR code with any UPI app, or pay to the UPI ID below. Scanning fills your order number into the payment note.'];
    return ['Send us your order', `Your order isn't with us yet. Tap below and ${WA_NUMBER ? 'WhatsApp' : 'your email app'} opens with everything written out — just press send. We'll confirm, then you pay.`];
}

function razorpayPanelHTML(o) {
    if (o.paid === 'verified') {
        return `<section class="panel no-print"><div class="notice ok" style="margin:0"><strong>Payment received</strong>${money(o.total)} paid${o.paymentId ? ' · reference ' + esc(o.paymentId) : ''}.</div></section>`;
    }
    const busy = isBusy(o);
    const retry = o.payState === 'dismissed' || o.payState === 'failed';
    let notice = '';
    if (o.payState === 'dismissed') notice = `<div class="notice"><strong>Payment not completed</strong>You closed the payment window before paying. Try again, or cancel below.</div>`;
    if (o.payState === 'failed') notice = `<div class="notice"><strong>The payment didn't go through</strong>${esc(o.payError)} No order has been placed.</div>`;
    return `<section class="panel">
        <h2 class="panel-title">Online payment</h2>
        <div class="pay-amount">${money(o.total)}</div>
        ${notice}
        <button type="button" class="btn btn-primary btn-lg btn-block" data-action="pay-razorpay" ${busy ? 'disabled' : ''}>
            ${busy ? '<span class="spinner" aria-hidden="true"></span> Payment window open…' : (retry ? 'Try payment again' : `Pay ${money(o.total)} securely`)}
        </button>
        ${busy ? '' : '<a class="btn btn-ghost-dark btn-block" href="#/checkout">Choose another way to pay</a>'}
    </section>`;
}

function upiPanelHTML(o) {
    const uri = `upi://pay?pa=${encodeURIComponent(CONFIG.upiVpa)}&pn=${encodeURIComponent(CONFIG.upiPayeeName || CONFIG.brand)}&am=${o.total}&cu=INR&tn=${encodeURIComponent('GetsU Order ' + o.id)}`;
    return `<section class="panel">
        <h2 class="panel-title">Pay by UPI</h2>
        <div class="qr-box">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(uri)}" alt="UPI QR code for ${money(o.total)}" width="190" height="190" data-qr>
            <div class="pay-amount">${money(o.total)}</div>
            <p>Scan with GPay, PhonePe, Paytm or any UPI app</p>
        </div>
        <a class="btn btn-ghost-dark btn-block" href="${esc(uri)}">Open my UPI app</a>
        <p class="upi-id">or pay this UPI ID: <button type="button" data-action="copy-upi" aria-label="Copy UPI ID">${esc(CONFIG.upiVpa)}</button></p>
    </section>`;
}

/* ---------- the bill, generated automatically when an online payment succeeds ---------- */
// This is a PAYMENT RECEIPT, not a GST tax invoice (that needs a GSTIN, HSN codes and a
// tax split the site doesn't hold). The page says so, and offers to arrange one.
function billHTML(o) {
    const c = o.customer;
    const when = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(o.paidAt || o.date));
    const pct = Math.round((CONFIG.taxRate || 0) * 1000) / 10;
    const seller = [
        `<strong>${esc(CONFIG.legalName || CONFIG.brand)}</strong>`,
        CONFIG.businessAddress && esc(CONFIG.businessAddress),
        CONFIG.gstin && 'GSTIN: ' + esc(CONFIG.gstin),
        CONFIG.fssaiLicence && 'FSSAI Licence No. ' + esc(CONFIG.fssaiLicence),
        esc(CONFIG.businessEmail),
        WA_NUMBER && 'WhatsApp +' + esc(WA_NUMBER),
    ].filter(Boolean).join('<br>');
    const buyer = [
        `<strong>${esc(c.name)}</strong>`,
        esc(c.address) + (c.landmark ? ' (' + esc(c.landmark) + ')' : ''),
        esc(c.city) + ', ' + esc(c.state) + ' ' + esc(c.pincode),
        'Phone: ' + esc(c.phone),
        c.email && esc(c.email),
    ].filter(Boolean).join('<br>');
    const rows = o.items.map(i => `<tr>
        <td>${esc(i.name)}${i.pack ? `<small>${esc(i.pack)}</small>` : ''}</td>
        <td class="num">${i.qty}</td><td class="num">${money(i.price)}</td><td class="num">${money(i.price * i.qty)}</td></tr>`).join('');
    return `<section class="panel bill" id="bill" aria-labelledby="billTitle">
        <div class="bill-inner">
            <div class="bill-head">
                <div><span class="logo display">Gets<b>U</b></span><div class="bill-tag">Made For You</div></div>
                <div class="bill-meta">
                    <h2 class="display bill-title" id="billTitle" tabindex="-1">Payment receipt</h2>
                    <div class="bill-line"><span>Bill no.</span><strong>${esc(o.id)}</strong></div>
                    <div class="bill-line"><span>Date</span><strong>${esc(when)}</strong></div>
                    <span class="bill-badge">Paid</span>
                </div>
            </div>
            <div class="bill-parties">
                <div><h3>Billed to</h3><p>${buyer}</p></div>
                <div><h3>Sold by</h3><p>${seller}</p></div>
            </div>
            <table class="bill-table">
                <caption class="sr-only">Items on this bill</caption>
                <thead><tr><th scope="col">Item</th><th scope="col" class="num">Qty</th><th scope="col" class="num">Rate</th><th scope="col" class="num">Amount</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="bill-totals">
                <div class="sum-row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
                <div class="sum-row"><span>Tax${pct ? ` (${pct}%)` : ''}</span><span>${money(o.tax)}</span></div>
                <div class="sum-row"><span>Shipping</span><span>Free</span></div>
                <div class="sum-row total"><span>Total paid</span><span>${money(o.total)}</span></div>
            </div>
            <p class="bill-pay"><strong>Paid online via Razorpay</strong><br>Payment ID: ${esc(o.paymentId || '—')}</p>
            <p class="bill-note">This is a payment receipt for your order. For a GST tax invoice, email us your GSTIN at ${esc(CONFIG.businessEmail)}.
            Your delivery details are not saved on this device, so this bill cannot be shown again once you leave this page — print or save it now.</p>
        </div>
        <div class="bill-actions no-print">
            <button type="button" class="btn btn-primary" data-action="print-bill">Print / Save as PDF</button>
            <a class="btn btn-ghost-dark" href="#products">Continue shopping</a>
        </div>
    </section>`;
}

function sendPanelHTML(o) {
    const wa = waHref(o);
    const heading = 'Send your order';
    let inner;
    if (o.sent) {
        inner = `<div class="notice ok"><strong>Message ready</strong>Press send in ${WA_NUMBER ? 'WhatsApp' : 'your email app'} if you haven't yet. If it didn't open, use the buttons below.</div>`;
    } else {
        inner = `<p style="margin-bottom:1rem">Your delivery details go to us only inside this message, which you send yourself.</p>`;
    }
    return `<section class="panel">
        <h2 class="panel-title">${heading}</h2>
        ${inner}
        ${wa ? `<a class="btn btn-primary btn-lg btn-block" href="${esc(wa)}" target="_blank" rel="noopener" data-action="mark-sent">Send on WhatsApp</a>` : ''}
        <a class="btn ${wa ? 'btn-ghost-dark' : 'btn-primary btn-lg'} btn-block" href="${esc(mailHref(o))}" data-action="mark-sent">Send by email</a>
        <button type="button" class="btn btn-ghost-dark btn-block" data-action="copy-order">Copy order details</button>
    </section>`;
}

function cancelZoneHTML(o) {
    const st = statusOf(o);
    if (st === 'cancelled') return `<a class="btn btn-primary btn-block" href="#/cart">Back to your cart</a>`;
    if (!canCancel(o)) {
        return `<div class="cancel-zone"><p>Need to change or cancel? Message us with your order number <strong>${esc(o.id)}</strong> at <a href="mailto:${esc(CONFIG.businessEmail)}">${esc(CONFIG.businessEmail)}</a>.</p></div>`;
    }
    const noun = o.method === 'later' ? 'order' : 'payment';
    if (o.cancelAsk) {
        return `<div class="cancel-zone cancel-confirm" role="group" aria-label="Confirm cancellation">
            <p>Cancel this ${noun}? No money will be taken and your cart will be kept.${o.method === 'upi' ? ' <strong>If you have already sent money by UPI, don\'t cancel — message us your order number.</strong>' : ''}</p>
            <button type="button" class="btn btn-danger" data-action="cancel-yes">Yes, cancel ${noun}</button>
            <button type="button" class="btn btn-ghost-dark" data-action="cancel-no">Keep my order</button>
        </div>`;
    }
    return `<div class="cancel-zone"><button type="button" class="btn btn-danger btn-block" data-action="cancel-ask" ${isBusy(o) ? 'disabled' : ''}>Cancel ${noun}</button></div>`;
}

function orderSummaryHTML(o) {
    const c = o.customer;
    return `<h2 class="panel-title">Order summary</h2>
        <div class="sum-lines">${o.items.map(i => `<div class="sum-line"><span>${esc(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}</div>
        ${summaryRowsHTML(o)}
        <div class="cancel-zone deliver-to">
            <p><strong>Deliver to</strong></p>
            <p>${esc(c.name)}<br>${esc(c.address)}<br>${esc(c.city)}, ${esc(c.state)} ${esc(c.pincode)}<br>Phone: ${esc(c.phone)}</p>
        </div>`;
}

function renderOrder() {
    const o = currentOrder;
    if (!o) return;
    const st = statusOf(o);
    const [heading, lead] = orderCopy(o, st);
    $('#orderTitle').textContent = heading;

    const paidOnline = o.paid === 'verified';
    let main = `<span class="order-id no-print">Order ${esc(o.id)}</span>`;
    if (st !== 'cancelled') {
        if (o.method === 'razorpay') main += razorpayPanelHTML(o);
        if (o.method === 'upi') main += upiPanelHTML(o);
        if (o.method === 'later') main += sendPanelHTML(o);
    }
    if (paidOnline) main += billHTML(o);
    main += `<div class="panel no-print">${cancelZoneHTML(o)}</div>`;

    keepFocus($('#orderBody'), () => {
        $('#orderBody').innerHTML = `<p class="order-lead">${lead}</p>
            <div class="order-layout${paidOnline ? ' bill-layout' : ''}"><div class="order-main">${main}</div>${paidOnline ? '' : `<aside class="panel summary" aria-label="Order summary">${orderSummaryHTML(o)}</aside>`}</div>`;
    });
}

/* ============================================================
   ROUTER
   ============================================================ */
const TITLES = { home: null, cart: 'Your cart', checkout: 'Place your order', order: 'Your order' };

function parseHash() {
    const h = location.hash;
    if (h === '#/cart') return { name: 'cart' };
    if (h === '#/checkout') return { name: 'checkout' };
    if (h === '#/order') return { name: 'order' };
    if (h === '' || h === '#' || h.startsWith('#/')) return { name: 'home' };
    return { name: 'home', anchor: decodeURIComponent(h.slice(1)) };
}

function redirect(hash) {
    history.replaceState(null, '', hash);
    route();
}

function route() {
    let { name, anchor } = parseHash();

    if (name === 'checkout' && !cart.length) return redirect('#/cart');
    if (name === 'order' && !currentOrder) return redirect(cart.length ? '#/cart' : '#/');

    // leaving the order page while the payment window is open: close it cleanly
    if (view === 'order' && name !== 'order' && currentOrder && isBusy(currentOrder)) {
        try { currentOrder.rzp && currentOrder.rzp.close && currentOrder.rzp.close(); } catch (e) { /* ignore */ }
        currentOrder.payState = 'dismissed';
    }

    const changed = name !== view;
    view = name;
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + name; });
    closeMenu();

    if (name === 'cart') renderCart();
    if (name === 'checkout') renderCheckout();
    if (name === 'order') renderOrder();

    const el = $('#view-' + name);
    document.title = el.dataset.title || document.title;

    // progress steps
    const stepsWrap = $('#stepsWrap');
    stepsWrap.hidden = name === 'home';
    if (name !== 'home') {
        $$('#steps li').forEach(li => {
            const n = Number(li.dataset.step);
            const cur = VIEW_ORDER[name];
            li.classList.toggle('done', n < cur);
            li.classList.toggle('current', n === cur);
            if (n === cur) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
        });
    }

    renderCartBadge();
    renderRecovery();

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (anchor && $('#' + CSS.escape(anchor))) {
        $('#' + CSS.escape(anchor)).scrollIntoView({ behavior: reduce || changed ? 'auto' : 'smooth', block: 'start' });
    } else if (changed || name !== 'home') {
        window.scrollTo(0, 0);
    }

    if (!lastRouteWasInitial && changed) {
        ga('page_view', { page_title: document.title, page_path: location.hash || '/' });
        if (name !== 'home') { const h1 = $('h1', el); if (h1) h1.focus({ preventScroll: true }); }
    }
    lastRouteWasInitial = false;
}

window.addEventListener('hashchange', route);

/* ============================================================
   UNFINISHED-ORDER BANNER
   ============================================================ */
function pendingFromHistory() {
    const dayMs = 3 * 24 * 3600 * 1000;
    return readHistory().filter(o => o.status === 'pending' && Date.now() - new Date(o.date).getTime() < dayMs).pop() || null;
}

function renderRecovery() {
    const banner = $('#recoveryBanner');
    const pend = pendingFromHistory();
    let dismissed = false;
    try { dismissed = Boolean(sessionStorage.getItem('getsuRecoveryDismissed')); } catch (e) { /* ignore */ }
    // a live order on screen is not "unfinished"
    const show = Boolean(pend) && !dismissed && view === 'home' && !(currentOrder && currentOrder.id === pend.id);
    banner.hidden = !show;
    if (show) $('#recoveryText').textContent = `You started an order for ${money(pend.total)} but didn't finish it.`;
}

function continuePending() {
    const pend = pendingFromHistory();
    if (!pend) return;
    if (!cart.length) {
        pend.items.forEach(line => {
            const p = PRODUCTS.find(x => x.name === line.name);
            if (p) cart.push({ id: p.id, qty: clamp(line.qty, 1, MAX_QTY) });
        });
        saveCart();
        renderCartBadge();
    }
    if (!cart.length) { toast('Those products are no longer available.'); return; }
    location.hash = '#/checkout';
}

/* ============================================================
   MODALS, MENU, TOAST
   ============================================================ */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';
let lastFocused = null;

function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    lastFocused = document.activeElement;
    m.hidden = false;
    document.body.classList.add('overlay-open');
    const first = $(FOCUSABLE, m);
    (first || m).focus();
}

function closeModalEl(m) {
    m.hidden = true;
    if (!$('.modal:not([hidden])')) document.body.classList.remove('overlay-open');
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    lastFocused = null;
}

function closeMenu() {
    $('#mainNav').classList.remove('open');
    $('#menuToggle').setAttribute('aria-expanded', 'false');
}

let toastTimer;
function toast(message, link) {
    const region = $('#toastRegion');
    region.innerHTML = '';
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span>${esc(message)}</span>` + (link ? `<a href="${esc(link.href)}">${esc(link.label)}</a>` : '');
    region.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 4500);
}

function copyText(text, done) {
    const fallback = () => {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { toast('Could not copy — please send by email instead.'); }
        document.body.removeChild(ta);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done).catch(fallback); else fallback();
}

/* ---------- policies ---------- */
const POLICIES = {
    shipping: { title: 'Shipping info', body: `
        <h3>Delivery timelines</h3><p>Orders are dispatched within 1–2 business days of confirmation. Delivery typically takes 3–6 business days depending on your location within India.</p>
        <h3>Shipping cost</h3><p>Shipping is free on all orders, with no minimum order value.</p>
        <h3>Tracking</h3><p>Once your order ships, we'll share tracking details on the mobile number you gave at checkout.</p>` },
    returns: { title: 'Returns & refunds', body: `
        <h3>Damaged or incorrect items</h3><p>Since GetsU sells food products, we don't accept returns once a package is opened. If your order arrives damaged, incorrect, or with a broken seal, contact us within 48 hours of delivery with photos and we'll send a replacement or refund at no cost to you.</p>
        <h3>How to request one</h3><p>Email <a href="mailto:${esc(CONFIG.businessEmail)}">${esc(CONFIG.businessEmail)}</a> with your order number and the issue. We aim to resolve every request within 3 business days.</p>
        <h3>Cancelling</h3><p>You can cancel a payment from the payment screen at any time before it goes through. After that, message us your order number and we'll cancel anything that hasn't shipped.</p>` },
    privacy: { title: 'Privacy policy', body: `
        <h3>What we collect</h3><p>When you order, we ask for your name, mobile number and delivery address, and your email if you choose to give it. We use these only to deliver your order and talk to you about it.</p>
        <h3>Where it goes</h3>
        <p><strong>If you send us your order,</strong> your details reach us only inside the WhatsApp or email message you send yourself. This website does not transmit them anywhere on its own, and does not save them on your device.</p>
        <p><strong>If you pay online,</strong> your name, mobile number and delivery address are passed to Razorpay together with your payment, so we can see where to ship it in our Razorpay account. Card and UPI credentials are entered on Razorpay's own form and are never seen by this site.</p>
        <h3>What stays on your device</h3><p>Your cart, and a short history of your own orders (order number, items and totals — no personal details), so you can look them up later.</p>
        <h3>Anonymous records</h3><p>We keep an anonymous record of what was ordered and for how much, with no name or contact detail, so we know what to make more of. We also use Google Analytics and anonymous usage counts (such as page views) with a random ID, to understand how the site is used. We do not sell your data or share it for marketing.</p>
        <h3>Your choices</h3><p>Because your details live in the message you sent or in Razorpay's records for your payment, email us and we'll delete what we hold. Clearing your browser data removes your cart and order history.</p>
        <h3>Contact</h3><p>Questions about your data? Email <a href="mailto:${esc(CONFIG.businessEmail)}">${esc(CONFIG.businessEmail)}</a>.</p>` },
    terms: { title: 'Terms of service', body: `
        <h3>Orders</h3><p>Adding to the cart and filling in checkout does not place an order. An order is placed when your online payment succeeds, or when you send us the order message and we confirm it by reply. All orders are subject to stock — if an item is unavailable we'll tell you, and refund anything you've paid for it in full.</p>
        <h3>Prices and tax</h3><p>Prices are in Indian Rupees (₹). Tax is added at checkout and shown in your total before you pay. Prices may change without notice.</p>
        <h3>Payment</h3><p>You can cancel a payment before it goes through. Online payments are processed by Razorpay.</p>
        <h3>Product information</h3><p>We describe our products as accurately as we can. Always check the ingredient list on the physical packaging if you have allergies or dietary restrictions.</p>
        <h3>Limitation</h3><p>GetsU is not liable for indirect or incidental damages arising from product use beyond the replacement or refund described in our Returns policy.</p>` },
};

function openPolicy(key) {
    const p = POLICIES[key];
    if (!p) return;
    $('#policyTitle').textContent = p.title;
    $('#policyBody').innerHTML = p.body;
    openModal('policyModal');
}

/* ---------- order history (no personal details are stored) ---------- */
const STATUS_LABEL = { pending: 'Not finished', sent: 'Sent — awaiting reply', paid: 'Paid', payment_reported: 'Payment being verified', cancelled: 'Cancelled' };

function openOrders() {
    const list = readHistory().slice().reverse();
    $('#ordersBody').innerHTML = !list.length
        ? '<p>No orders yet. Anything you order will show up here.</p>'
        : list.map(o => `<div class="order-row">
            <div class="order-row-top">
                <div><div class="order-row-id">${esc(o.id)}</div><div class="order-row-date">${new Date(o.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
                <span class="order-tag ${o.status === 'paid' ? 'paid' : ''} ${o.status === 'cancelled' ? 'cancelled' : ''}">${STATUS_LABEL[o.status] || o.status}</span>
            </div>
            <div class="order-row-items">${o.items.map(i => `${esc(i.name)} × ${i.qty}`).join('<br>')}</div>
            <div class="order-row-total"><span>Total</span><span>${money(o.total)}</span></div>
            ${o.status === 'pending' ? `<button type="button" class="btn btn-primary btn-block" data-action="finish-order" data-id="${esc(o.id)}">Finish this order</button>` : ''}
        </div>`).join('');
    openModal('ordersModal');
}

/* ---------- contact form ---------- */
let lastContactBody = '';
function submitContact(e) {
    e.preventDefault();
    const name = $('#ctName').value, email = $('#ctEmail').value, phone = $('#ctPhone').value, message = $('#ctMessage').value;
    lastContactBody = `Name: ${name}\nEmail: ${email}\nPhone: ${phone || '—'}\n\n${message}`;
    window.location.href = `mailto:${CONFIG.businessEmail}?subject=${encodeURIComponent('Message from ' + name + ' via GetsU site')}&body=${encodeURIComponent(lastContactBody)}`;
    $('#contactFallback').hidden = false;
    toast('Opening your email app — if nothing happened, use the copy button.');
}

/* ============================================================
   ONE CLICK HANDLER FOR EVERYTHING WITH data-action
   ============================================================ */
const ACTIONS = {
    add(el) {
        if (addToCart(el.dataset.id)) {
            const p = productById(el.dataset.id);
            toast(`${p.name} added to your cart.`, { href: '#/cart', label: 'View cart' });
            const original = el.textContent;
            el.textContent = 'Added ✓';
            setTimeout(() => { el.textContent = original; }, 1400);
        }
    },
    'toggle-macros'(el) {
        const card = el.closest('.pcard');
        const on = card.classList.toggle('show-macros');
        el.setAttribute('aria-expanded', String(on));
    },
    'open-product'(el) { openProduct(el.dataset.id); },
    'detail-inc'() { detailQty = Math.min(MAX_QTY, detailQty + 1); $('#detailQty').textContent = detailQty; },
    'detail-dec'() { detailQty = Math.max(1, detailQty - 1); $('#detailQty').textContent = detailQty; },
    'detail-add'(el) {
        if (addToCart(el.dataset.id, detailQty)) {
            const p = productById(el.dataset.id);
            closeModalEl($('#productModal'));
            toast(`${p.name} × ${detailQty} added to your cart.`, { href: '#/cart', label: 'View cart' });
        }
    },
    'qty-inc'(el) { changeQty(el.dataset.id, 1); },
    'qty-dec'(el) { changeQty(el.dataset.id, -1); },
    remove(el) { removeFromCart(el.dataset.id); },

    'pay-razorpay'() { startRazorpay(); },
    // The browser's own print dialog doubles as "Save as PDF". The page title becomes
    // the suggested file name, so the PDF arrives called GetsU-bill-GU12345678.
    'print-bill'() {
        const o = currentOrder;
        if (!o) return;
        const before = document.title;
        const restore = () => { document.title = before; window.removeEventListener('afterprint', restore); };
        document.title = 'GetsU-bill-' + o.id;
        window.addEventListener('afterprint', restore);
        window.print();
    },
    'copy-upi'() { copyText(CONFIG.upiVpa, () => toast('UPI ID copied — paste it in your UPI app.')); },
    'mark-sent'() { const o = currentOrder; if (o) setTimeout(() => markSent(o), 60); }, // after the link opens
    'copy-order'() {
        const o = currentOrder;
        if (o) copyText(orderText(o), () => { toast('Order copied — paste it to us on WhatsApp or email.'); markSent(o); });
    },
    'cancel-ask'() { if (currentOrder) { currentOrder.cancelAsk = true; renderOrder(); } },
    'cancel-no'() { if (currentOrder) { currentOrder.cancelAsk = false; renderOrder(); } },
    'cancel-yes'() { if (currentOrder) cancelOrder(currentOrder); },

    'recovery-continue'() { continuePending(); },
    'recovery-dismiss'() { try { sessionStorage.setItem('getsuRecoveryDismissed', '1'); } catch (e) { /* ignore */ } renderRecovery(); },
    'finish-order'() { closeModalEl($('#ordersModal')); continuePending(); },

    'toggle-menu'(el) {
        const open = $('#mainNav').classList.toggle('open');
        el.setAttribute('aria-expanded', String(open));
    },
    'skip-to-main'(el, e) { e.preventDefault(); const h = $('.view:not([hidden]) h1'); (h || $('#main')).focus(); },
    'open-modal'(el) { openModal(el.dataset.target); },
    'open-policy'(el) { openPolicy(el.dataset.key); },
    'open-orders'() { openOrders(); },
    'close-modal'(el) { closeModalEl(el.closest('.modal')); },
    'copy-contact'() { if (lastContactBody) copyText(lastContactBody, () => toast('Message copied — paste it to us on WhatsApp or email.')); },
};

document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (el && ACTIONS[el.dataset.action]) {
        // links that open another app (WhatsApp/email) must keep their default behaviour
        if (el.tagName !== 'A') e.preventDefault();
        ACTIONS[el.dataset.action](el, e);
        return;
    }
    // click on a modal's dark backdrop
    if (e.target.classList && e.target.classList.contains('modal')) closeModalEl(e.target);
    // click outside the open mobile menu
    if (!e.target.closest('#mainNav') && !e.target.closest('#menuToggle')) closeMenu();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const open = $$('.modal:not([hidden])');
        if (open.length) closeModalEl(open[open.length - 1]); else closeMenu();
        return;
    }
    if (e.key !== 'Tab') return;
    const modal = $('.modal:not([hidden])');
    if (!modal) return;
    const items = $$(FOCUSABLE, modal).filter(n => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/* payment choice, live field checking, form submit */
document.addEventListener('change', e => {
    if (e.target.name === 'payMethod') { payMethod = e.target.value; updatePlaceButton(); }
    if (e.target.closest && e.target.closest('#checkoutForm') && VALIDATORS[e.target.name] && e.target.tagName === 'SELECT') validateField(e.target.name);
});

document.addEventListener('input', e => {
    const name = e.target.name;
    if (e.target.closest && e.target.closest('#checkoutForm') && VALIDATORS[name]) {
        const wrap = e.target.closest('.field');
        if (wrap && wrap.classList.contains('invalid') && !VALIDATORS[name](e.target.value)) setFieldError(name, '');
    }
});

document.addEventListener('focusout', e => {
    const name = e.target.name;
    if (e.target.closest && e.target.closest('#checkoutForm') && VALIDATORS[name] && (e.target.value || e.target.closest('.field').classList.contains('invalid'))) validateField(name);
});

$('#checkoutForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!validateForm()) return;
    placeOrder(readDetails(), payMethod);
});

$('#contactForm').addEventListener('submit', submitContact);

/* a UPI QR that fails to load is hidden; the UPI ID and app link remain */
document.addEventListener('error', e => {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-qr')) e.target.classList.add('qr-failed');
}, true);

/* ============================================================
   START
   ============================================================ */
function injectStructuredData() {
    const store = {
        '@context': 'https://schema.org', '@type': 'Store', name: CONFIG.brand,
        description: 'Clean-label, high-protein foods made in India.', email: CONFIG.businessEmail,
        url: location.href.split('#')[0], areaServed: 'IN', currenciesAccepted: 'INR',
        hasOfferCatalog: {
            '@type': 'OfferCatalog', name: 'GetsU products',
            itemListElement: PRODUCTS.map(p => ({
                '@type': 'Offer', price: p.price, priceCurrency: 'INR', availability: 'https://schema.org/InStock',
                itemOffered: { '@type': 'Product', name: p.name, description: p.desc, sku: 'GU-' + String(p.id).padStart(2, '0') },
            })),
        },
    };
    const faq = {
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: $$('.faq-item').map(item => ({
            '@type': 'Question', name: $('summary', item).textContent.trim(),
            acceptedAnswer: { '@type': 'Answer', text: $('p', item).textContent.trim() },
        })),
    };
    [store, faq].forEach(obj => {
        const s = document.createElement('script');
        s.type = 'application/ld+json';
        s.textContent = JSON.stringify(obj);
        document.head.appendChild(s);
    });
}

/* Highlights the nav link for the section being read (home page only). */
function initScrollSpy() {
    const links = $$('#mainNav a[href^="#"]');
    const targets = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    if (!links.length || !targets.length) return;
    let ticking = false;

    function update() {
        ticking = false;
        let current = '';
        if (view === 'home') {
            // the section whose top has passed a line just under the sticky header
            const line = ($('.site-header').offsetHeight || 76) + window.innerHeight * 0.18;
            for (const t of targets) if (t.getBoundingClientRect().top <= line) current = t.id;
            // at the very bottom of the page the last section wins
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = targets[targets.length - 1].id;
        }
        links.forEach(a => {
            const on = a.getAttribute('href') === '#' + current;
            a.classList.toggle('active', on);
            if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        });
    }
    const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    window.addEventListener('hashchange', queue);
    update();
}

function init() {
    renderProducts();
    $('#fssaiLine').textContent = CONFIG.fssaiLicence ? 'FSSAI Licence No. ' + CONFIG.fssaiLicence : '';
    $$('#contactEmail, #footerEmail').forEach(a => { a.href = 'mailto:' + CONFIG.businessEmail; a.textContent = CONFIG.businessEmail; });
    if (WA_NUMBER) {
        const wa = $('#contactWhatsApp');
        wa.href = 'https://wa.me/' + WA_NUMBER;
        wa.hidden = false;
    }
    injectStructuredData();
    fbPush('page_views', { user_id: userId(), timestamp: new Date().toISOString(), page: location.pathname, referrer: document.referrer || 'direct' });
    renderCartBadge();
    route();
    initScrollSpy();
}

init();
})();
