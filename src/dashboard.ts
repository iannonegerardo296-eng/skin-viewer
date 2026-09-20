export {};

interface User {
  id: number;
  username: string;
  email: string | null;
  role: 'admin' | 'user';
  active: boolean;
  createdAt: string;
}

interface CatalogItem {
  id: number;
  name: string;
  slug: string;
  source: string;
  sourceUrl: string;
  creator: string;
  imageUrl: string;
  model: string;
  tags: string[];
  popularity: number;
}

interface Overview {
  users: number;
  admins: number;
  catalog: number;
  events: number;
  sources: Array<{ source: string; count: number }>;
  recent: ActivityItem[];
}

interface ActivityItem {
  action: string;
  detail: string;
  createdAt: string;
  username: string;
}

const $ = <T extends Element>(selector: string): T | null => document.querySelector(selector) as T | null;
const $$ = <T extends Element>(selector: string): T[] => Array.from(document.querySelectorAll(selector)) as T[];
const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento UI mancante: #${id}`);
  return element as T;
};

let currentUser: User | null = null;
let activeRoute = 'overview';
let catalogItems: CatalogItem[] = [];
let catalogQuery = '';
let catalogSource = 'all';

const authView = byId<HTMLElement>('authView');
const appShell = byId<HTMLElement>('appShell');
const authMessage = byId<HTMLDivElement>('authMessage');
const loginForm = byId<HTMLFormElement>('loginForm');
const registerForm = byId<HTMLFormElement>('registerForm');

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function initials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function formatDate(value: string): string {
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function relativeDate(value: string): string {
  if (!value) return 'data non disponibile';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'ora';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min fa`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h fa`;
  return formatDate(value);
}

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    signal: options.signal || AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json() as T & { error?: string }
    : {} as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Errore ${response.status}`);
  return payload;
}

function setAuthMessage(message: string, success = false): void {
  authMessage.textContent = message;
  authMessage.classList.toggle('success', success);
}

function showToast(title: string, message: string, error = false): void {
  let stack = document.getElementById('toastStack') as HTMLDivElement | null;
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toastStack';
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const toast = document.createElement('div');
  toast.className = `toast${error ? ' error' : ''}`;
  toast.innerHTML = `<span class="toast-icon">${error ? '!' : '✓'}</span><div><b>${escapeHtml(title)}</b><p>${escapeHtml(message)}</p></div>`;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  window.setTimeout(() => {
    toast.classList.remove('show');
    window.setTimeout(() => toast.remove(), 260);
  }, 4200);
}

function setLoading(button: HTMLButtonElement, loading: boolean, label: string): void {
  button.disabled = loading;
  button.setAttribute('aria-busy', String(loading));
  button.dataset.originalLabel ||= button.innerHTML;
  button.innerHTML = loading ? `<span class="button-spinner"></span>${label}` : button.dataset.originalLabel;
}

function setUser(user: User): void {
  currentUser = user;
  const name = escapeHtml(user.username);
  const avatar = initials(user.username);
  $$<HTMLElement>('#sidebarUsername, #headerUsername, #greetingName, #profileUsername').forEach((element) => {
    element.textContent = user.username;
  });
  $$<HTMLElement>('#sidebarAvatar, #headerAvatar, #profileAvatar').forEach((element) => {
    element.textContent = avatar;
  });
  byId<HTMLElement>('sidebarRole').textContent = user.role === 'admin' ? 'Administrator' : 'Reviewer';
  byId<HTMLElement>('profileEmail').textContent = user.email || 'Nessuna email collegata';
  byId<HTMLElement>('profileRole').textContent = user.role === 'admin' ? 'Administrator' : 'Reviewer';
  byId<HTMLElement>('headerUsername').setAttribute('aria-label', name);
  $$('.admin-only').forEach((element) => element.classList.toggle('hidden-admin', user.role !== 'admin'));
}

function switchAuthMode(mode: 'login' | 'register'): void {
  const isLogin = mode === 'login';
  $$('.auth-tab').forEach((tab) => tab.classList.toggle('active', tab.getAttribute('data-auth-mode') === mode));
  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
  byId<HTMLElement>('authEyebrow').textContent = isLogin ? 'WELCOME BACK' : 'NEW OPERATOR';
  byId<HTMLElement>('authTitle').textContent = isLogin ? 'Accedi al workspace' : 'Crea un account';
  byId<HTMLElement>('authSubtitle').textContent = isLogin ? 'Continua da dove avevi lasciato la tua libreria.' : 'Un account per entrare nel tuo workspace locale.';
  setAuthMessage('');
}

async function submitAuth(form: HTMLFormElement, endpoint: string, buttonLabel: string): Promise<void> {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!button) return;
  setLoading(button, true, 'Attendi…');
  setAuthMessage('');
  try {
    const data = Object.fromEntries(new FormData(form).entries());
    const result = await api<{ user: User }>(endpoint, { method: 'POST', body: JSON.stringify(data) });
    setUser(result.user);
    authView.hidden = true;
    appShell.hidden = false;
    await bootWorkspace();
    showToast(endpoint.includes('register') ? 'Account creato' : 'Accesso riuscito', `Benvenuto, ${result.user.username}.`);
  } catch (error) {
    setAuthMessage(error instanceof Error ? error.message : 'Operazione non riuscita');
  } finally {
    setLoading(button, false, buttonLabel);
  }
}

function routeTitle(route: string): string {
  const titles: Record<string, string> = { overview: 'Overview', catalog: 'Catalogo skin', review: 'Revisore 3D', accounts: 'Account', 'create-account': 'Crea account', activity: 'Activity log', account: 'Il mio account' };
  return titles[route] || 'Overview';
}

function navigate(route: string): void {
  if (route === 'review') {
    window.location.href = 'review.html';
    return;
  }
  if ((route === 'accounts' || route === 'create-account') && currentUser?.role !== 'admin') {
    showToast('Accesso negato', 'Questa sezione è disponibile solo per gli admin.', true);
    return;
  }
  activeRoute = route;
  byId<HTMLElement>('pageTitle').textContent = routeTitle(route);
  $$('.nav-item[data-route]').forEach((item) => item.classList.toggle('active', (item as HTMLElement).dataset.route === route));
  $$<HTMLElement>('.dashboard-page').forEach((page) => {
    page.hidden = page.dataset.page !== route;
    if (!page.hidden) {
      page.classList.remove('page-enter');
      void page.offsetWidth;
      page.classList.add('page-enter');
    }
  });
  if (route === 'catalog') loadCatalog();
  if (route === 'accounts' || route === 'create-account') loadAccounts();
  if (route === 'activity') loadActivity();
  if (window.innerWidth <= 650) byId<HTMLElement>('sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderSources(sources: Overview['sources']): void {
  const target = byId<HTMLDivElement>('sourceList');
  if (!sources.length) { target.innerHTML = '<div class="empty-state">Nessuna fonte presente.</div>'; return; }
  target.innerHTML = sources.map((item) => `<div class="source-row"><span class="source-swatch"></span><div><b>${escapeHtml(item.source)}</b><small>Skin attribuite e tracciabili</small></div><strong>${item.count.toString().padStart(2, '0')}</strong></div>`).join('');
}

function activityMarkup(item: ActivityItem): string {
  const labels: Record<string, string> = { login: 'Accesso effettuato', register: 'Nuovo account registrato', catalog_sync: 'Catalogo sincronizzato', catalog_upload: 'Skin caricata nel catalogo', password_change: 'Password aggiornata', user_update: 'Account aggiornato' };
  return `<div class="activity-row"><span class="activity-mark"></span><div><b>${escapeHtml(labels[item.action] || item.action)}</b><small>${escapeHtml(item.username)}${item.detail ? ` · ${escapeHtml(item.detail)}` : ''}</small></div><span class="activity-time">${relativeDate(item.createdAt)}</span></div>`;
}

function renderActivity(items: ActivityItem[], target: HTMLElement): void {
  target.innerHTML = items.length ? items.map(activityMarkup).join('') : '<div class="empty-state">Nessuna attività registrata.</div>';
}

async function loadOverview(): Promise<void> {
  try {
    const overview = await api<Overview>('/api/admin/overview');
    (Object.keys({ users: 0, admins: 0, catalog: 0, events: 0 }) as Array<keyof Overview>).forEach((key) => {
      const element = $(`[data-metric="${key}"]`);
      if (element) element.textContent = String(overview[key]);
    });
    renderSources(overview.sources);
    renderActivity(overview.recent, byId('recentActivity'));
  } catch (error) {
    if (currentUser?.role !== 'admin') return;
    showToast('Overview non disponibile', error instanceof Error ? error.message : 'Errore di caricamento', true);
  }
}

function catalogCard(item: CatalogItem): string {
  const tags = item.tags.slice(0, 3).map((tag) => `<span class="catalog-tag">${escapeHtml(tag)}</span>`).join('');
  return `<article class="catalog-card">
    <div class="catalog-image"><img loading="lazy" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" onerror="this.style.opacity='.15'">
      <span class="catalog-source">${escapeHtml(item.source)}</span><span class="catalog-model">${escapeHtml(item.model)}</span>
    </div>
    <div class="catalog-body"><h3>${escapeHtml(item.name)}</h3><div class="catalog-creator">by ${escapeHtml(item.creator)}</div><div class="catalog-tags">${tags}</div><div class="catalog-footer"><span class="catalog-popularity">${item.popularity.toLocaleString('it-IT')} segnali</span><span class="catalog-links">${item.sourceUrl ? `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">Fonte ↗</a>` : ''}<a href="${escapeHtml(item.imageUrl.startsWith('https://mineskin.eu/body/') ? item.imageUrl.replace('/body/', '/download/').replace(/\/\d+\.png$/, '') : item.imageUrl)}" target="_blank" rel="noreferrer">PNG ↗</a></span></div></div>
  </article>`;
}

function renderCatalog(): void {
  const target = byId<HTMLDivElement>('catalogGrid');
  const filtered = catalogItems.filter((item) => {
    const haystack = [item.name, item.creator, item.source, ...item.tags].join(' ').toLowerCase();
    return (!catalogQuery || haystack.includes(catalogQuery.toLowerCase())) && (catalogSource === 'all' || item.source === catalogSource);
  });
  byId<HTMLElement>('catalogCount').textContent = `${filtered.length} risultati`;
  target.innerHTML = filtered.length ? filtered.map(catalogCard).join('') : '<div class="empty-state">Nessuna skin corrisponde alla ricerca.</div>';
}

async function loadCatalog(): Promise<void> {
  const target = byId<HTMLDivElement>('catalogGrid');
  if (!catalogItems.length) target.innerHTML = '<div class="loading-grid">Caricamento catalogo…</div>';
  try {
    const result = await api<{ items: CatalogItem[] }>('/api/catalog');
    catalogItems = result.items;
    renderCatalog();
  } catch (error) {
    target.innerHTML = `<div class="empty-state">${escapeHtml(error instanceof Error ? error.message : 'Catalogo non disponibile')}</div>`;
  }
}

async function loadAccounts(): Promise<void> {
  try {
    const result = await api<{ users: User[] }>('/api/admin/users');
    byId<HTMLElement>('accountCount').textContent = `${result.users.length} account`;
    byId<HTMLTableSectionElement>('accountsTable').innerHTML = result.users.map((user) => `<tr>
      <td><div class="account-cell"><span class="avatar small">${escapeHtml(initials(user.username))}</span><b>${escapeHtml(user.username)}</b></div></td>
      <td>${escapeHtml(user.email || '—')}</td>
      <td><select class="role-select" data-user-role="${user.id}" ${user.id === currentUser?.id ? 'disabled' : ''}><option value="user" ${user.role === 'user' ? 'selected' : ''}>Reviewer</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option></select></td>
      <td><span class="status-pill ${user.active ? 'active' : 'inactive'}">${user.active ? 'Attivo' : 'Disattivo'}</span></td>
      <td>${formatDate(user.createdAt)}</td>
      <td><button class="table-action ${user.active ? 'danger' : ''}" data-toggle-user="${user.id}" ${user.id === currentUser?.id ? 'disabled' : ''}>${user.active ? 'Disattiva' : 'Riattiva'}</button></td>
    </tr>`).join('');
    $$<HTMLSelectElement>('[data-user-role]').forEach((select) => select.addEventListener('change', async () => {
      try { await api(`/api/admin/users/${(select as HTMLSelectElement).dataset.userRole}`, { method: 'PATCH', body: JSON.stringify({ role: select.value }) }); showToast('Ruolo aggiornato', 'La modifica è stata salvata.'); }
      catch (error) { showToast('Errore', error instanceof Error ? error.message : 'Modifica non salvata', true); }
    }));
    $$<HTMLButtonElement>('[data-toggle-user]').forEach((button) => button.addEventListener('click', async () => {
      const user = result.users.find((entry) => entry.id === Number((button as HTMLButtonElement).dataset.toggleUser));
      if (!user) return;
      try { await api(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ active: !user.active }) }); await loadAccounts(); showToast('Account aggiornato', 'Lo stato dell’account è stato salvato.'); }
      catch (error) { showToast('Errore', error instanceof Error ? error.message : 'Modifica non salvata', true); }
    }));
  } catch (error) { showToast('Account non disponibili', error instanceof Error ? error.message : 'Errore di caricamento', true); }
}

async function loadActivity(): Promise<void> {
  try { const result = await api<{ activity: ActivityItem[] }>('/api/admin/activity'); renderActivity(result.activity, byId('fullActivity')); }
  catch (error) { showToast('Activity log non disponibile', error instanceof Error ? error.message : 'Errore di caricamento', true); }
}

async function bootWorkspace(): Promise<void> {
  if (!currentUser) return;
  setUser(currentUser);
  if (currentUser.role === 'admin') await loadOverview();
  else {
    document.querySelector<HTMLElement>('[data-metric="users"]')?.closest('.metric-card')?.remove();
    document.querySelector<HTMLElement>('[data-metric="admins"]')?.closest('.metric-card')?.remove();
    document.getElementById('signalBanner')?.remove();
  }
  navigate(activeRoute);
}

function wireInteractions(): void {
  $$<HTMLElement>('.auth-tab').forEach((tab) => tab.addEventListener('click', () => switchAuthMode((tab.dataset.authMode || 'login') as 'login' | 'register')));
  loginForm.addEventListener('submit', (event) => { event.preventDefault(); void submitAuth(loginForm, '/api/auth/login', 'Entra nel centro'); });
  registerForm.addEventListener('submit', (event) => { event.preventDefault(); void submitAuth(registerForm, '/api/auth/register', 'Crea il mio account'); });
  $$<HTMLElement>('[data-route]').forEach((item) => item.addEventListener('click', () => navigate(item.dataset.route || 'overview')));
  byId('logoutButton').addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined); window.location.reload(); });
  byId('themeButton').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('skin-checker-theme', next);
  });
  byId('profileTrigger').addEventListener('click', () => navigate('account'));
  byId('catalogSearch').addEventListener('input', (event) => { catalogQuery = (event.target as HTMLInputElement).value; renderCatalog(); });
  byId('catalogSource').addEventListener('change', (event) => { catalogSource = (event.target as HTMLSelectElement).value; renderCatalog(); });
  byId('syncCatalog').addEventListener('click', async () => {
    const button = byId<HTMLButtonElement>('syncCatalog'); setLoading(button, true, 'Sincronizzo…');
    try { const result = await api<{ items: CatalogItem[] }>('/api/admin/catalog/sync', { method: 'POST' }); catalogItems = result.items; renderCatalog(); showToast('Catalogo sincronizzato', 'Le fonti curate sono state aggiornate.'); }
    catch (error) { showToast('Sincronizzazione fallita', error instanceof Error ? error.message : 'Errore', true); }
    finally { setLoading(button, false, 'Sincronizza catalogo'); }
  });
  byId('passwordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const feedback = byId<HTMLDivElement>('passwordMessage');
    try { await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) }); feedback.textContent = 'Password aggiornata.'; feedback.className = 'form-feedback success'; form.reset(); }
    catch (error) { feedback.textContent = error instanceof Error ? error.message : 'Operazione non riuscita'; feedback.className = 'form-feedback'; }
  });
  byId<HTMLFormElement>('createAccountForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const message = byId<HTMLDivElement>('createAccountMessage');
    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!submitButton) return;
    message.textContent = '';
    setLoading(submitButton, true, 'Creo…');
    try {
      const result = await api<{ user: User }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      form.reset();
      message.textContent = `Account "${result.user.username}" creato correttamente.`;
      message.className = 'form-feedback success';
      showToast('Account creato', `${result.user.username} è stato aggiunto al workspace.`);
      await loadAccounts();
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Impossibile creare l’account';
      message.className = 'form-feedback';
    } finally {
      setLoading(submitButton, false, 'Crea account');
    }
  });
  const menuButton = document.createElement('button'); menuButton.className = 'mobile-menu'; menuButton.setAttribute('aria-label', 'Apri menu'); menuButton.textContent = '☰';
  $('.workspace-header')?.prepend(menuButton); menuButton.addEventListener('click', () => byId('sidebar').classList.toggle('open'));

  wireUploadModal();
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Impossibile leggere il file'));
    reader.readAsDataURL(file);
  });
}

function wireUploadModal(): void {
  const overlay = byId<HTMLDivElement>('uploadCatalogOverlay');
  const form = byId<HTMLFormElement>('uploadCatalogForm');
  const fileInput = byId<HTMLInputElement>('uploadFile');
  const preview = byId<HTMLImageElement>('uploadPreview');
  const message = byId<HTMLDivElement>('uploadCatalogMessage');

  const openModal = () => {
    form.reset();
    preview.classList.remove('show');
    message.textContent = '';
    overlay.hidden = false;
    overlay.classList.add('is-open');
  };
  const closeModal = () => {
    overlay.classList.remove('is-open');
    overlay.hidden = true;
  };

  byId('openUploadCatalog').addEventListener('click', openModal);
  byId('uploadCatalogCancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(); });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) { preview.classList.remove('show'); return; }
    fileToDataUrl(file).then((dataUrl) => { preview.src = dataUrl; preview.classList.add('show'); }).catch(() => preview.classList.remove('show'));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!submitButton) return;
    message.textContent = '';
    const file = fileInput.files?.[0];
    if (!file) { message.textContent = 'Seleziona un file PNG.'; return; }
    if (file.type !== 'image/png') { message.textContent = 'Il file deve essere un PNG.'; return; }
    setLoading(submitButton, true, 'Carico…');
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const name = byId<HTMLInputElement>('uploadName').value.trim();
      const model = byId<HTMLSelectElement>('uploadModel').value;
      const tags = byId<HTMLInputElement>('uploadTags').value.split(',').map((tag) => tag.trim()).filter(Boolean);
      const result = await api<{ items: CatalogItem[] }>('/api/admin/catalog/upload', { method: 'POST', body: JSON.stringify({ name, model, tags, imageDataUrl }) });
      catalogItems = result.items;
      renderCatalog();
      closeModal();
      showToast('Skin caricata', `"${name}" è ora nel catalogo.`);
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Caricamento non riuscito';
    } finally {
      setLoading(submitButton, false, 'Carica nel catalogo');
    }
  });
}

async function boot(): Promise<void> {
  wireInteractions();
  try {
    const result = await api<{ user: User }>('/api/me');
    setUser(result.user); authView.hidden = true; appShell.hidden = false; await bootWorkspace();
  } catch {
    authView.hidden = false; appShell.hidden = true;
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void boot(), { once: true });
else void boot();
