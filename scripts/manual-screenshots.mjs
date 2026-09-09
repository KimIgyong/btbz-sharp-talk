import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const WEB = 'http://localhost:5173';
const WID = 'http://localhost:5175';
const API = 'http://localhost:3000/api/v1';
const OUT = path.resolve('out');
const V = { width: 1566, height: 785 };
const OLDPW = 'amb2026!@';
const NEWPW = 'SharpTalk#2026x';
const DEVPW = process.env.DEVPW || OLDPW;
const ONLY = (process.argv[2] || '').split(',').filter(Boolean); // phases: widget,admin,tenant

fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const L = {
  ko: { open: '고객 지원 열기', accept: '동의', msg: '메시지를 입력하세요…', send: '보내기', login: '로그인', pwUpdate: '비밀번호 수정',
        newTenant: '새 테넌트', users: '사용자 관리', tempBtn: '임시 비밀번호 발급', issue: '발급', qa: '예: 무료배송 기준이 얼마인가요?',
        qaTitle: '지식으로 답변하기', handoff: '상담원 연결', embed: '임베드 · SDK', publish: '게시', newDoc: '새 문서',
        q1: '배송은 얼마나 걸리나요?', q2: '교환은 어떻게 하나요?', q3: '무료배송 기준이 얼마인가요?', qa1: '무료배송 기준이 얼마인가요?' },
  en: { open: 'Open support', accept: 'Accept', msg: 'Type a message…', send: 'Send', login: 'Sign in', pwUpdate: 'Update password',
        newTenant: 'New tenant', users: 'Users', tempBtn: 'Issue temporary password', issue: 'Issue', qa: 'e.g. What is the free shipping threshold?',
        qaTitle: 'Ask the knowledge base', handoff: 'Agent handoff', embed: 'Embed & SDK', publish: 'Publish', newDoc: 'New document',
        q1: 'How long does shipping take?', q2: 'How do I exchange an item?', q3: 'What is the free shipping threshold?', qa1: 'What is the free shipping threshold?' },
};

async function shot(page, name, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 700);
  if (!opts.keepDialogs) await dismissAlerts(page).catch(() => {});
  const file = path.join(OUT, `${name}.jpg`);
  if (opts.locator) await opts.locator.screenshot({ path: file, type: 'jpeg', quality: 80 });
  else await page.screenshot({ path: file, type: 'jpeg', quality: 80, clip: opts.clip });
  log('shot', name);
}
async function ctx(browser, lang, { fresh = false } = {}) {
  const c = await browser.newContext({ viewport: V, locale: lang === 'ko' ? 'ko-KR' : 'en-US', deviceScaleFactor: 1 });
  await c.addInitScript(({ lang, fresh }) => {
    try {
      localStorage.setItem('ivy_lang', lang);
      localStorage.setItem('ivy:knowledge:guide-collapsed', '1');
      if (fresh) { localStorage.removeItem('ivy_session'); localStorage.removeItem('ivy_session_token'); localStorage.removeItem('ivy_consent'); }
    } catch {}
  }, { lang, fresh });
  return c;
}
async function safe(name, fn) { try { await fn(); } catch (e) { log('FAIL', name, e.message.split('\n')[0]); } }
async function api(pathname, { method = 'GET', token, body } = {}) {
  const r = await fetch(API + pathname, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}
async function loginToken(email, password, tenant_slug) {
  for (const pw of [password, NEWPW, OLDPW, DEVPW]) {
    const r = await api(tenant_slug ? '/auth/user/login' : '/auth/admin/login', { method: 'POST', body: tenant_slug ? { email, password: pw, tenant_slug } : { email, password: pw } });
    const t = r.data?.accessToken ?? r.data?.access_token;
    if (t) return t;
  }
  return null;
}

// ---------- widget ----------
async function widgetChat(page, lang, question, { shots = {} } = {}) {
  const t = L[lang];
  await page.goto(`${WID}/?shop=ivyusa.myshopify.com`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: t.open }).first().click();
  const accept = page.getByRole('button', { name: t.accept }).first();
  if (await accept.isVisible({ timeout: 6000 }).catch(() => false)) {
    if (shots.consent) {
      await page.evaluate(() => { document.querySelectorAll('*').forEach((el) => { const cs = getComputedStyle(el); if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) el.scrollTop = 0; }); });
      await shot(page, shots.consent);
    }
    await accept.click();
    await page.waitForTimeout(800);
  }
  if (shots.menu) { await page.waitForTimeout(1200); await shot(page, shots.menu); }
  const input = page.getByPlaceholder(t.msg).first();
  await input.fill(question);
  await page.getByRole('button', { name: t.send }).first().click();
  // wait for the AI bubble: the composer re-enables and a new non-user message appears
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => !document.querySelector('button[disabled][aria-busy]'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3500);
  if (shots.chat) await shot(page, shots.chat);
}

// ---------- console helpers ----------
async function login(page, lang, url, email, pw) {
  const t = L[lang];
  await page.goto(`${WEB}${url}`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pw);
  await page.getByRole('button', { name: t.login }).click();
  await page.waitForTimeout(1500);
}
async function forcedChange(page, lang, current, shotName) {
  const t = L[lang];
  const dlg = page.getByRole('dialog');
  await dlg.waitFor({ timeout: 8000 });
  if (shotName) await shot(page, shotName, { keepDialogs: true });
  const pws = dlg.locator('input[type="password"]');
  await pws.nth(0).fill(current); await pws.nth(1).fill(NEWPW); await pws.nth(2).fill(NEWPW);
  await page.getByRole('button', { name: t.pwUpdate }).click();
  await dlg.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
}
async function dismissAlerts(page) {
  for (let i = 0; i < 6; i++) {
    const dlg = page.getByRole('dialog').filter({ hasText: /상담 이관 알림|Chat escalation/ }).first();
    if (!(await dlg.isVisible().catch(() => false))) break;
    await dlg.getByRole('button', { name: /^(닫기|Close)$/ }).first().click().catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(400);
  }
}
async function goto(page, p) { await page.goto(`${WEB}${p}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900); await dismissAlerts(page); }

async function ensureDemoUser() {
  const token = await loginToken('dev@amoeba.group', OLDPW, 'ivyusa');
  if (!token) return log('demo user: no tenant token');
  const list = await api('/users?page=1&size=50', { token });
  const items = list.data?.items ?? list.data ?? [];
  if (Array.isArray(items) && items.some((u) => u.email === 'manual-demo@example.com')) return log('demo user exists');
  const r = await api('/users/invite', { method: 'POST', token, body: { email: 'manual-demo@example.com', rank: 'staff' } });
  log('invite demo user →', r.status, r.error?.code ?? '');
}
async function aggregateStats() {
  const token = await loginToken('dev@amoeba.group', OLDPW, 'ivyusa');
  if (!token) return;
  const d = new Date(); const today = d.toISOString().slice(0, 10);
  const y = new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
  for (const date of [y, today]) { const r = await api(`/analytics/questions/aggregate?date=${date}`, { method: 'POST', token }); log('aggregate', date, '→', r.status); }
}
async function ensureBoardDoc() {
  const token = await loginToken('dev@amoeba.group', OLDPW, 'ivyusa');
  if (!token) return;
  const list = await api('/board/documents?page=1&size=5', { token });
  const items = list.data?.items ?? [];
  if (items.length) return log('board docs exist', items.length);
  for (const body of [
    { category1: 'CounselInfo', title: '교환·반품 안내 (2026 개정)', content: '## 교환·반품\n\n수령 후 7일 이내 미사용 상품은 교환·반품이 가능합니다.\n\n- 단순 변심: 왕복 배송비 고객 부담\n- 상품 하자: 무료\n\n문의: 고객센터 채팅', tags: ['배송', '반품'], status: 'published' },
    { category1: 'CounselInfo', title: '배송 소요 기간 안내', content: '국내 배송은 결제 후 1~3영업일, 해외 배송은 7~14일이 소요됩니다. 도서산간은 1~2일 추가.', tags: ['배송'], status: 'draft' },
    { category1: 'ProductInfo', title: '하이드라 글로우 세럼 사용법', content: '세안 후 토너 다음 단계에서 2~3방울을 얼굴 전체에 펴 바릅니다. 아침·저녁 사용.', tags: ['사용법'], status: 'published' },
  ]) {
    const r = await api('/board/documents', { method: 'POST', token, body });
    log('board create →', r.status, r.error?.code ?? '', r.error?.message ?? '');
  }
}

async function tenantSet(browser, lang, { firstLogin }) {
  const t = L[lang];
  const c = await ctx(browser, lang); const page = await c.newPage();
  await safe('tenant-login', async () => { await goto(page, '/user/ivyusa'); await shot(page, `tenant-login.${lang}`); });
  await login(page, lang, '/user/ivyusa', 'dev@amoeba.group', firstLogin ? DEVPW : NEWPW);
  if (firstLogin) await safe('forced', () => forcedChange(page, lang, DEVPW, `forced-password.${lang}`));
  await safe('dashboard', async () => { await goto(page, '/dashboard'); await shot(page, `dashboard.${lang}`, { wait: 1500 }); });
  await safe('live-chat', async () => {
    await goto(page, '/live-chat'); await page.waitForTimeout(1500);
    const row = page.locator('[role="button"]').filter({ hasText: /세션 \d+|Session \d+/ }).filter({ hasText: /AI/ }).first();
    if (await row.count()) await row.click(); else await page.locator('main [role="button"]').first().click().catch(() => {});
    await shot(page, `live-chat.${lang}`, { wait: 1800 });
  });
  await safe('knowledge', async () => {
    await goto(page, '/knowledge');
    const input = page.getByPlaceholder(t.qa).first();
    await input.fill(t.qa1); await input.press('Enter');
    await page.waitForTimeout(6000);
    await shot(page, `knowledge.${lang}`);
    const card = page.locator('div').filter({ has: page.getByText(t.qaTitle, { exact: true }) }).filter({ has: page.getByPlaceholder(t.qa) }).last();
    await card.scrollIntoViewIfNeeded().catch(() => {});
    const box = await card.boundingBox().catch(() => null);
    if (box && box.height > 250) await shot(page, `knowledge-qa.${lang}`, { locator: card });
    else await shot(page, `knowledge-qa.${lang}`, { clip: { x: Math.round(V.width * 0.6), y: 0, width: Math.round(V.width * 0.4), height: V.height } });
  });
  await safe('knowledge-board', async () => { await goto(page, '/knowledge/board'); await shot(page, `knowledge-board.${lang}`, { wait: 1500 }); });
  await safe('ai-setting', async () => { await goto(page, '/ai-setting'); await shot(page, `ai-setting.${lang}`, { wait: 1500 }); });
  await safe('handoff', async () => {
    await goto(page, '/settings/basic');
    let h = page.getByRole('heading', { name: t.handoff, exact: true }).first();
    if (!(await h.count())) h = page.getByText(t.handoff, { exact: true }).last();
    await h.evaluate((el) => { el.scrollIntoView({ block: 'start' }); let sc = el.parentElement; while (sc && !((getComputedStyle(sc).overflowY === 'auto' || getComputedStyle(sc).overflowY === 'scroll') && sc.scrollHeight > sc.clientHeight)) sc = sc.parentElement; (sc || document.scrollingElement || window).scrollBy(0, -120); });
    await shot(page, `handoff-settings.${lang}`, { wait: 900 });
  });
  await safe('settings-stores', async () => { await goto(page, '/settings/platforms'); await shot(page, `settings-stores.${lang}`, { wait: 1500 }); });
  await safe('settings-widget', async () => { await goto(page, '/settings/widget'); await shot(page, `settings-widget.${lang}`, { wait: 1500 }); });
  await safe('settings-install', async () => {
    let h = page.getByRole('heading', { name: t.embed, exact: true }).first();
    if (!(await h.count())) h = page.getByText(t.embed, { exact: true }).last();
    await h.evaluate((el) => { el.scrollIntoView({ block: 'start' }); let sc = el.parentElement; while (sc && !((getComputedStyle(sc).overflowY === 'auto' || getComputedStyle(sc).overflowY === 'scroll') && sc.scrollHeight > sc.clientHeight)) sc = sc.parentElement; (sc || document.scrollingElement || window).scrollBy(0, -120); });
    await shot(page, `settings-install.${lang}`, { wait: 900 });
  });
  await safe('statistics', async () => { await goto(page, '/statistics'); await shot(page, `statistics.${lang}`, { wait: 2500 }); });
  await c.close();
}

async function adminSet(browser, lang, { firstLogin }) {
  const t = L[lang];
  const c = await ctx(browser, lang); const page = await c.newPage();
  await login(page, lang, '/admin/login', 'admin@amoeba.group', firstLogin ? OLDPW : NEWPW);
  if (firstLogin) await safe('forced-admin', () => forcedChange(page, lang, OLDPW, `forced-password.${lang}`));
  await safe('admin-tenants', async () => {
    await goto(page, '/admin/tenants'); await page.waitForTimeout(800);
    await page.getByRole('button', { name: t.newTenant }).first().click();
    await page.getByRole('dialog').waitFor({ timeout: 5000 });
    await shot(page, `admin-tenants.${lang}`, { keepDialogs: true }); await page.keyboard.press('Escape');
  });
  await safe('admin-temp-password', async () => {
    await goto(page, '/admin/tenants');
    await page.getByRole('button', { name: t.users }).first().click();
    await page.waitForTimeout(1500);
    const row = page.locator('tr').filter({ hasText: 'manual-demo@example.com' }).first();
    const btn = (await row.count()) ? row.locator(`button[title="${t.tempBtn}"]`).first() : page.locator(`button[title="${t.tempBtn}"]`).last();
    await btn.click();
    await page.getByRole('dialog').waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: t.issue, exact: true }).first().click();
    await page.waitForTimeout(1500);
    await shot(page, `admin-temp-password.${lang}`, { keepDialogs: true }); await page.keyboard.press('Escape');
  });
  await c.close();
}

const browser = await chromium.launch();
try {
  if (!ONLY.length || ONLY.includes('widget')) {
    let c = await ctx(browser, 'ko', { fresh: true }); let p = await c.newPage();
    await safe('widget-ko', () => widgetChat(p, 'ko', L.ko.q1, { shots: { consent: 'widget-consent.ko', menu: 'widget-menu.ko', chat: 'widget-chat.ko' } }));
    await c.close();
    c = await ctx(browser, 'en', { fresh: true }); p = await c.newPage();
    await safe('widget-en', () => widgetChat(p, 'en', L.en.q1, { shots: { chat: 'widget-chat.en' } }));
    await c.close();
    for (const q of [L.ko.q2, L.ko.q3, L.en.q2]) { // extra conversations for dashboard/live-chat/statistics
      c = await ctx(browser, q === L.en.q2 ? 'en' : 'ko', { fresh: true }); p = await c.newPage();
      await safe('widget-extra', () => widgetChat(p, q === L.en.q2 ? 'en' : 'ko', q)); await c.close();
    }
  }
  if (!ONLY.length || ONLY.includes('tenant-en')) await tenantSet(browser, 'en', { firstLogin: !ONLY.includes('nofirst') });
  if (!ONLY.length || ONLY.includes('prep')) { await safe('demo-user', ensureDemoUser); await safe('board-doc', ensureBoardDoc); await safe('aggregate', aggregateStats); }
  if (!ONLY.length || ONLY.includes('admin')) { await adminSet(browser, 'ko', { firstLogin: ONLY.includes('adminfirst') }); await adminSet(browser, 'en', { firstLogin: false }); }
  if (!ONLY.length || ONLY.includes('tenant-ko')) await tenantSet(browser, 'ko', { firstLogin: false });
} finally { await browser.close(); }
log('done', fs.readdirSync(OUT).length, 'files');
