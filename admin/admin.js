// ══════════════════════════════════
//  ADMIN DASHBOARD JS — All Modules
// ══════════════════════════════════

// ── State ──
let resources = [], demos = [], testimonials = [];
let filters = { resources: 'all', demos: 'all', testimonials: 'all' };
let editingResource = null, editingTestimonial = null;
let deleteCallback = null;

// ── Auth ──
(function initAuth() {
    const loginScreen = document.getElementById('login-screen');
    if (sessionStorage.getItem('admin_auth') === 'true') {
        loginScreen.classList.add('hidden');
        return;
    }
    // Block dashboard until authenticated
    document.getElementById('login-btn').addEventListener('click', async () => {
        const pw = document.getElementById('login-password').value;
        const errEl = document.getElementById('login-error');
        errEl.style.display = 'none';
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pw })
            });
            if (res.ok) {
                sessionStorage.setItem('admin_auth', 'true');
                loginScreen.classList.add('hidden');
            } else {
                errEl.style.display = 'block';
                document.getElementById('login-password').value = '';
                document.getElementById('login-password').focus();
            }
        } catch { errEl.style.display = 'block'; }
    });
    // Enter key submits
    document.getElementById('login-password').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('login-btn').click();
    });
})();

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
    loadAll();
    bindNav();
    bindModals();
    bindForms();
    bindFilters();
    bindSearch();
    bindSidebar();
});

// ══════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════
function bindNav() {
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const view = item.dataset.view;
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${view}`).classList.add('active');
            // Refresh data for the view
            if (view === 'dashboard') loadStats();
            if (view === 'demos') loadDemos();

            // Auto-retract sidebar on mobile
            if (window.innerWidth <= 900) {
                document.getElementById('sidebar').classList.remove('open');
            }
        });
    });
}

function bindSidebar() {
    document.querySelectorAll('.sidebar-toggle').forEach(btn => {
        btn.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    });
}

// ══════════════════════════════════
//  DATA LOADING
// ══════════════════════════════════
async function loadAll() {
    await Promise.all([loadResources(), loadDemos(), loadTestimonials()]);
    loadStats();
}

async function loadResources() {
    try { resources = await (await fetch('/api/resources')).json(); } catch { resources = []; }
    renderResources();
    updateResourceStats();
}

async function loadDemos() {
    try { demos = await (await fetch('/api/demos')).json(); } catch { demos = []; }
    renderDemos();
    updateDemoStats();
}

async function loadTestimonials() {
    try { testimonials = await (await fetch('/api/testimonials')).json(); } catch { testimonials = []; }
    renderTestimonials();
}

let demoChart = null, resourceChart = null;

async function loadStats() {
    let stats;
    try { stats = await (await fetch('/api/stats')).json(); } catch { return; }

    // Summary pills
    const dsr = el('ds-resources'); if (dsr) dsr.textContent = stats.resources.total;
    const dsd = el('ds-demos'); if (dsd) dsd.textContent = stats.demos.total;
    const dst = el('ds-testimonials'); if (dst) dst.textContent = stats.testimonials.total;

    // Demo Status Donut
    const demoCtx = el('chart-demos');
    if (demoCtx) {
        if (demoChart) demoChart.destroy();
        demoChart = new Chart(demoCtx, {
            type: 'doughnut',
            data: {
                labels: ['New', 'Contacted', 'Closed'],
                datasets: [{
                    data: [stats.demos.new, stats.demos.contacted, stats.demos.closed],
                    backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'],
                    borderWidth: 0, hoverOffset: 8
                }]
            },
            options: {
                cutout: '65%', responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { family: 'Inter', size: 12 } } },
                    tooltip: { backgroundColor: '#0f172a', cornerRadius: 10, padding: 10, titleFont: { family: 'Outfit' }, bodyFont: { family: 'Inter' } }
                }
            }
        });
    }

    // Resource Types Bar
    const resCtx = el('chart-resources');
    if (resCtx) {
        if (resourceChart) resourceChart.destroy();
        resourceChart = new Chart(resCtx, {
            type: 'bar',
            data: {
                labels: ['Case Studies', 'Blog Posts', 'Testimonials'],
                datasets: [{
                    data: [stats.resources.caseStudies, stats.resources.blogs, stats.testimonials.visible],
                    backgroundColor: ['rgba(239,68,68,.7)', 'rgba(59,130,246,.7)', 'rgba(245,158,11,.7)'],
                    borderRadius: 8, barThickness: 36
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                scales: {
                    x: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(0,0,0,.04)' } },
                    y: { ticks: { font: { family: 'Inter', size: 12, weight: 500 } }, grid: { display: false } }
                },
                plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f172a', cornerRadius: 10, padding: 10, bodyFont: { family: 'Inter' } } }
            }
        });
    }

    renderTimeline();
}

function renderTimeline() {
    const events = [];
    resources.forEach(r => events.push({ type: 'resource', icon: r.type === 'case-study' ? 'ph-trend-up' : 'ph-pencil-line', label: 'New ' + (r.type === 'case-study' ? 'case study' : 'blog post') + ': <strong>' + esc(r.title) + '</strong>', date: r.createdAt }));
    demos.forEach(d => events.push({ type: 'demo', icon: 'ph-envelope-simple', label: 'Demo request from <strong>' + esc(d.name) + '</strong> (' + esc(d.email) + ')', date: d.submittedAt }));
    testimonials.forEach(t => events.push({ type: 'testimonial', icon: 'ph-star', label: 'Testimonial by <strong>' + esc(t.name) + '</strong>', date: t.createdAt }));
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    const top10 = events.slice(0, 10);

    const container = el('activity-timeline');
    if (!container) return;
    if (!top10.length) { container.innerHTML = '<div class="timeline-empty"><i class="ph-duotone ph-clock-countdown" style="font-size:2.5rem;color:#cbd5e1"></i><p>Activities will appear here as data flows in.</p></div>'; return; }

    container.innerHTML = top10.map(e => '<div class="timeline-item"><div class="timeline-dot ' + e.type + '"></div><div class="timeline-body"><div>' + e.label + '</div><div class="timeline-meta">' + timeAgo(e.date) + '</div></div></div>').join('');
}

function timeAgo(iso) {
    const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (secs < 60) return 'Just now';
    if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
    if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
    if (secs < 604800) return Math.floor(secs / 86400) + 'd ago';
    return fmtDate(iso);
}

// ══════════════════════════════════
//  RESOURCES
// ══════════════════════════════════
function updateResourceStats() { /* stat cards removed */ }

function renderResources() {
    const q = (el('search-resources')?.value || '').toLowerCase();
    let items = [...resources];
    if (filters.resources !== 'all') items = items.filter(r => r.type === filters.resources);
    if (q) items = items.filter(r => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const tbody = el('resources-tbody');
    el('res-empty').style.display = items.length ? 'none' : 'block';
    tbody.innerHTML = items.map(r => `
    <tr>
      <td><div class="row-thumb">${r.imageUrl ? `<img src="${r.imageUrl}" alt="">` : '<i class="ph-duotone ph-image"></i>'}</div></td>
      <td><div class="row-title">${esc(r.title)}</div><div class="row-desc">${esc(r.description)}</div></td>
      <td><span class="type-badge ${r.type}">${r.type === 'case-study' ? 'Case Study' : 'Blog'}</span></td>
      <td class="row-date">${fmtDate(r.createdAt)}</td>
      <td><div class="row-actions"><button class="btn-ghost edit" onclick="editResource('${r.id}')"><i class="ph ph-pencil-simple"></i></button><button class="btn-ghost delete" onclick="confirmDel('${r.id}','${esc(r.title).replace(/'/g, "\\'")}','resource')"><i class="ph ph-trash"></i></button></div></td>
    </tr>`).join('');
}

function editResource(id) {
    editingResource = id;
    const r = resources.find(x => x.id === id);
    if (!r) return;
    el('res-modal-title').textContent = 'Edit Resource';
    el('res-type').value = r.type;
    el('res-title').value = r.title;
    el('res-desc').value = r.description;
    el('res-content').value = r.content || '';
    el('res-link').value = r.link || '';
    if (r.imageUrl) { el('res-preview').src = r.imageUrl; el('res-preview').style.display = 'block'; el('res-upload-ph').style.display = 'none'; }
    openModal('resource-modal-overlay');
}

// ══════════════════════════════════
//  DEMO REQUESTS
// ══════════════════════════════════
function updateDemoStats() { /* stat cards removed */ }

function renderDemos() {
    const q = (el('search-demos')?.value || '').toLowerCase();
    let items = [...demos];
    if (filters.demos !== 'all') items = items.filter(d => d.status === filters.demos);
    if (q) items = items.filter(d => d.name.toLowerCase().includes(q) || d.email.toLowerCase().includes(q) || (d.company || '').toLowerCase().includes(q));
    items.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    el('demo-empty').style.display = items.length ? 'none' : 'block';
    el('demos-tbody').innerHTML = items.map(d => `
    <tr>
      <td><strong>${esc(d.name)}</strong></td><td>${esc(d.email)}</td>
      <td>${esc(d.company)}</td><td>${esc(d.adSpend)}</td>
      <td>${statusBadge(d.status)}</td>
      <td class="row-date">${fmtDate(d.submittedAt)}</td>
      <td><div class="row-actions"><button class="btn-ghost edit" onclick="openDemoDetail('${d.id}')"><i class="ph ph-eye"></i></button><button class="btn-ghost delete" onclick="confirmDel('${d.id}','${esc(d.name).replace(/'/g, "\\'")}','demo')"><i class="ph ph-trash"></i></button></div></td>
    </tr>`).join('');
}

function openDemoDetail(id) {
    const d = demos.find(x => x.id === id);
    if (!d) return;
    el('demo-detail-id').value = d.id;
    el('demo-detail-name').value = d.name;
    el('demo-detail-email').value = d.email;
    el('demo-detail-company').value = d.company || '';
    el('demo-detail-spend').value = d.adSpend || '';
    el('demo-detail-status').value = d.status;
    el('demo-detail-notes').value = d.notes || '';
    openModal('demo-modal-overlay');
}

// ══════════════════════════════════
//  TESTIMONIALS
// ══════════════════════════════════
function renderTestimonials() {
    const q = (el('search-testimonials')?.value || '').toLowerCase();
    let items = [...testimonials];
    if (filters.testimonials === 'visible') items = items.filter(t => t.visible);
    if (filters.testimonials === 'hidden') items = items.filter(t => !t.visible);
    if (q) items = items.filter(t => t.quote.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));

    el('test-empty').style.display = items.length ? 'none' : 'block';
    el('testimonials-tbody').innerHTML = items.map(t => `
    <tr>
      <td><div class="row-thumb" style="background:var(--primary-soft);color:var(--primary);font-weight:700;font-size:.75rem">${esc(t.initials)}</div></td>
      <td><div class="row-desc" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">"${esc(t.quote)}"</div></td>
      <td><div class="row-title" style="font-size:.85rem">${esc(t.name)}</div><div class="row-desc">${esc(t.role)}</div></td>
      <td>${'⭐'.repeat(t.rating)}</td>
      <td>${t.visible ? '<span class="type-badge case-study">Yes</span>' : '<span class="type-badge" style="background:#f1f5f9;color:#94a3b8">No</span>'}</td>
      <td><div class="row-actions"><button class="btn-ghost edit" onclick="editTestimonial('${t.id}')"><i class="ph ph-pencil-simple"></i></button><button class="btn-ghost delete" onclick="confirmDel('${t.id}','${esc(t.name).replace(/'/g, "\\'")}','testimonial')"><i class="ph ph-trash"></i></button></div></td>
    </tr>`).join('');
}

function editTestimonial(id) {
    editingTestimonial = id;
    const t = testimonials.find(x => x.id === id);
    if (!t) return;
    el('test-modal-title').textContent = 'Edit Testimonial';
    el('test-quote').value = t.quote;
    el('test-name').value = t.name;
    el('test-role').value = t.role || '';
    el('test-initials').value = t.initials || '';
    el('test-rating').value = t.rating;
    el('test-visible').checked = t.visible;
    openModal('testimonial-modal-overlay');
}

// ══════════════════════════════════
//  FORMS
// ══════════════════════════════════
function bindForms() {
    // Resource form
    el('resource-form').addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData();
        fd.append('type', el('res-type').value);
        fd.append('title', el('res-title').value);
        fd.append('description', el('res-desc').value);
        fd.append('content', el('res-content').value);
        fd.append('link', el('res-link').value || '');
        const img = el('res-image');
        if (img.files[0]) fd.append('image', img.files[0]);

        const url = editingResource ? `/api/resources/${editingResource}` : '/api/resources';
        const method = editingResource ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, { method, body: fd });
            if (!res.ok) throw new Error((await res.json()).error);
            toast(editingResource ? 'Resource updated!' : 'Resource created!');
            closeModal('resource-modal-overlay');
            editingResource = null;
            loadResources();
            loadStats();
        } catch (err) { toast(err.message, 'error'); }
    });

    // Testimonial form
    el('testimonial-form').addEventListener('submit', async e => {
        e.preventDefault();
        const data = {
            quote: el('test-quote').value,
            name: el('test-name').value,
            role: el('test-role').value,
            initials: el('test-initials').value || el('test-name').value.split(' ').map(w => w[0]).join('').toUpperCase(),
            rating: parseInt(el('test-rating').value),
            visible: el('test-visible').checked
        };
        const url = editingTestimonial ? `/api/testimonials/${editingTestimonial}` : '/api/testimonials';
        const method = editingTestimonial ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (!res.ok) throw new Error((await res.json()).error);
            toast(editingTestimonial ? 'Testimonial updated!' : 'Testimonial created!');
            closeModal('testimonial-modal-overlay');
            editingTestimonial = null;
            loadTestimonials();
            loadStats();
        } catch (err) { toast(err.message, 'error'); }
    });

    // Demo detail form
    el('demo-form').addEventListener('submit', async e => {
        e.preventDefault();
        const id = el('demo-detail-id').value;
        const data = { status: el('demo-detail-status').value, notes: el('demo-detail-notes').value };
        try {
            const res = await fetch(`/api/demos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (!res.ok) throw new Error('Update failed');
            toast('Demo request updated!');
            closeModal('demo-modal-overlay');
            loadDemos();
            loadStats();
        } catch (err) { toast(err.message, 'error'); }
    });
}

// ══════════════════════════════════
//  MODALS
// ══════════════════════════════════
function bindModals() {
    el('btn-add-resource').addEventListener('click', () => {
        editingResource = null;
        el('resource-form').reset();
        el('res-modal-title').textContent = 'Add Resource';
        el('res-preview').style.display = 'none';
        el('res-upload-ph').style.display = '';
        openModal('resource-modal-overlay');
    });

    el('btn-add-testimonial').addEventListener('click', () => {
        editingTestimonial = null;
        el('testimonial-form').reset();
        el('test-modal-title').textContent = 'Add Testimonial';
        el('test-visible').checked = true;
        openModal('testimonial-modal-overlay');
    });

    // Image upload
    el('res-upload-area').addEventListener('click', () => el('res-image').click());
    el('res-image').addEventListener('change', () => {
        const file = el('res-image').files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => { el('res-preview').src = e.target.result; el('res-preview').style.display = 'block'; el('res-upload-ph').style.display = 'none'; };
        reader.readAsDataURL(file);
    });

    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
    });
}

function openModal(id) { el(id).classList.add('open'); }
function closeModal(id) { el(id).classList.remove('open'); }

// ══════════════════════════════════
//  DELETE
// ══════════════════════════════════
function confirmDel(id, name, type) {
    el('delete-name').textContent = name;
    const endpoints = { resource: '/api/resources', demo: '/api/demos', testimonial: '/api/testimonials' };
    deleteCallback = async () => {
        try {
            await fetch(`${endpoints[type]}/${id}`, { method: 'DELETE' });
            toast('Deleted!');
            closeModal('delete-overlay');
            loadAll();
        } catch { toast('Delete failed', 'error'); }
    };
    openModal('delete-overlay');
}

el('delete-confirm').addEventListener('click', () => { if (deleteCallback) deleteCallback(); });

// ══════════════════════════════════
//  FILTERS & SEARCH
// ══════════════════════════════════
function bindFilters() {
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const mod = chip.dataset.module;
            chip.closest('.filter-group').querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filters[mod] = chip.dataset.filter;
            if (mod === 'resources') renderResources();
            if (mod === 'demos') renderDemos();
            if (mod === 'testimonials') renderTestimonials();
        });
    });
}

function bindSearch() {
    el('search-resources')?.addEventListener('input', renderResources);
    el('search-demos')?.addEventListener('input', renderDemos);
    el('search-testimonials')?.addEventListener('input', renderTestimonials);
}

// ══════════════════════════════════
//  HELPERS
// ══════════════════════════════════
function el(id) { return document.getElementById(id); }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function statusBadge(s) {
    const map = { new: ['🔴 New', 'rgba(239,68,68,.1)', '#ef4444'], contacted: ['🟡 Contacted', 'rgba(251,191,36,.1)', '#f59e0b'], closed: ['🟢 Closed', 'rgba(34,197,94,.1)', '#16a34a'] };
    const [label, bg, color] = map[s] || map.new;
    return `<span class="type-badge" style="background:${bg};color:${color}">${label}</span>`;
}
function toast(msg, type = 'success') {
    const t = el('toast'); t.textContent = msg; t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}
