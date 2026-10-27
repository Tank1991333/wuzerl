// Automatischer Durchlauf aller Abläufe von Wuzerl (PC + Handy)
// Aufruf: python3 -m http.server 8765 (im Repo-Ordner), dann: node tests/e2e.js [pc|iphone|klein]
// Screenshots und Exportdateien landen außerhalb des Repos (OUT, Standard: Temp-Ordner).
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const URL_ = process.env.URL || 'http://localhost:8765/';
const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'wuzerl-tests');
fs.mkdirSync(OUT, { recursive: true });
const iso = d => d.toISOString().slice(0, 10);
const addD = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

const results = []; const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log((cond ? 'OK   ' : 'FAIL ') + name + (cond ? '' : '  -> ' + info)); };

async function overflow(page) {
  return page.evaluate(() => {
    const W = document.documentElement.clientWidth, bad = [];
    document.querySelectorAll('#app *, #nav *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + el.className) + ' ' + Math.round(r.left) + '-' + Math.round(r.right));
    });
    return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) };
  });
}
const tap = async (page, sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(60); };
const act = (page, a, id) => tap(page, id == null ? `[data-a="${a}"]` : `[data-a="${a}"][data-id="${id}"]`);

let browser;
async function run(label, ctxOpts) {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...ctxOpts, acceptDownloads: true, locale: 'de-AT' });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  const errors = [], foreign = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!r.url().startsWith(URL_) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) foreign.push(r.url()); });
  await page.goto(URL_); await page.waitForSelector('.hero');
  const L = s => label + ': ' + s;
  const shot = async n => page.screenshot({ path: path.join(OUT, label + '-' + n + '.png'), fullPage: true });
  const chk = async n => { const o = await overflow(page); ok(L('kein Querscrollen ' + n), o.sw <= o.W && !o.bad.length, JSON.stringify(o)); };

  await shot('00-start'); await chk('Start');
  // Setup: Termin in 5 Wochen -> SSW 35 (Wehen-Timer sichtbar)
  await page.fill('#setupEt', addD(35)); await act(page, 'setup-et');
  ok(L('Geburtstermin setzen'), await page.locator('.hero .big').innerText().then(t => /^35\+/.test(t)));
  await shot('01-heute'); await chk('Heute');

  // Termine
  await act(page, 'tab', 'termine'); await chk('Termine'); await shot('02-termine');
  await act(page, 'appt-toggle'); await page.fill('#aTitle', 'Kontrolle Dr. Huber'); await page.fill('#aTime', '09:30');
  await page.fill('#aPlace', 'Wien'); await act(page, 'appt-add');
  ok(L('Termin eintragen'), await page.locator('text=Kontrolle Dr. Huber').count() > 0);
  await tap(page, '[data-a="task-done"]'); ok(L('Frist abhaken'), await page.locator('.check.on').count() > 0);
  await tap(page, '[data-a="task-who"]');
  await act(page, 'tfilter', 'P'); await act(page, 'tfilter', 'alle');
  const [dl] = await Promise.all([page.waitForEvent('download'), act(page, 'ics')]);
  const ics = fs.readFileSync(await dl.path(), 'utf8');
  ok(L('ICS-Export gültig'), /^BEGIN:VCALENDAR\r\n/.test(ics) && /END:VCALENDAR\r\n$/.test(ics) && ics.includes('Kontrolle Dr. Huber') && ics.split('BEGIN:VEVENT').length === ics.split('END:VEVENT').length);
  const longLines = ics.split('\r\n').filter(l => Buffer.byteLength(l) > 75);
  ok(L('ICS-Zeilen max. 75 Byte'), !longLines.length, longLines.length + ' zu lang');
  await chk('Termine mit Formular');

  // Listen
  await act(page, 'tab', 'listen'); await chk('Listen'); await shot('03-listen');
  await tap(page, '[data-a="item-done"]');
  await page.fill('#newItem', 'Stillkissen'); await act(page, 'new-who', 'x');
  ok(L('Text bleibt beim Wechsel der Zuständigkeit'), await page.inputValue('#newItem') === 'Stillkissen');
  if (await page.inputValue('#newItem') !== 'Stillkissen') await page.fill('#newItem', 'Stillkissen');
  await page.press('#newItem', 'Enter');
  ok(L('Eigener Punkt'), await page.locator('text=Stillkissen').count() > 0);
  await act(page, 'item-del'); await act(page, 'item-del');
  ok(L('Eigener Punkt löschen'), await page.locator('text=Stillkissen').count() === 0);
  await act(page, 'list-sel', 'namen'); await page.fill('#newName', 'Lena'); await act(page, 'name-add');
  await page.fill('#newName', 'lena'); await act(page, 'name-add');
  ok(L('Namen: kein Duplikat'), await page.locator('.row .title:has-text("Lena")').count() === 1);
  await tap(page, '[data-a="vote"]'); await chk('Namen');

  // Wehen-Timer
  await act(page, 'tab', 'heute'); await act(page, 'tab', 'wehen'); await chk('Wehen');
  await act(page, 'contr'); await page.waitForTimeout(1200);
  // Tipp über einen Sekundentakt hinweg (Finger liegt ~1,1 s am Button)
  const b = await page.locator('[data-a="contr"]').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(1100); await page.mouse.up();
  await page.waitForTimeout(100);
  ok(L('Wehe stoppen trotz Sekundentakt'), (await page.locator('[data-a="contr"]').innerText()).startsWith('Wehe beginnt'));
  await shot('04-wehen');

  // Kontakte
  await act(page, 'tab', 'heute'); await act(page, 'tab', 'kontakte'); await page.fill('#cName', 'Hebamme Anna'); await page.fill('#cPhone', '0660 123 45 67');
  await act(page, 'contact-add'); ok(L('Kontakt speichern'), await page.locator('a[href="tel:06601234567"]').count() === 1);
  ok(L('Kontaktformular danach leer'), await page.inputValue('#cName') === '');
  await chk('Kontakte'); await shot('05-kontakte');

  // Einstellungen: Geburt eintragen
  await act(page, 'tab', 'settings'); await chk('Einstellungen'); await shot('06-settings');
  await page.fill('#sBirth', addD(-40)); await page.fill('#sBw', '3400'); await page.fill('#sBl', '51,5');
  await page.fill('#sB', 'Mia');
  await act(page, 'me', 'P');
  ok(L('Ungespeicherte Einstellungen bleiben beim Personenwechsel'), await page.inputValue('#sB') === 'Mia');
  if (await page.inputValue('#sB') !== 'Mia') { await page.fill('#sBirth', addD(-40)); await page.fill('#sBw', '3400'); await page.fill('#sBl', '51,5'); await page.fill('#sB', 'Mia'); }
  await act(page, 'save-settings');
  ok(L('Einstellungen speichern'), (await page.locator('.brand').innerText()).startsWith('Mia'));
  await act(page, 'tab', 'heute'); ok(L('Babyalter'), (await page.locator('.hero .big').innerText()).includes('5'));
  await shot('07-heute-baby'); await chk('Heute Baby');

  // Baby
  await act(page, 'tab', 'baby'); await chk('Baby'); await shot('08-baby');
  await act(page, 'log', 'stillen_l'); await act(page, 'log', 'nass');
  await page.fill('#ml', '120'); await act(page, 'log', 'flasche');
  ok(L('Tracker Einträge'), await page.locator('.row .title:has-text("Fläschchen")').count() === 1);
  await act(page, 'sleep'); await act(page, 'offset', '15'); await act(page, 'sleep');
  const sleepTxt = await page.locator('.stats div:nth-child(4) b').innerText();
  ok(L('Schlaf nie negativ'), !sleepTxt.startsWith('-'), sleepTxt);
  await act(page, 'baby-seg', 'gesundheit'); await chk('Gesundheit');
  await page.fill('#hTemp', '38,4'); await act(page, 'offset', '15');
  ok(L('Temperatur bleibt beim Zeitpunkt-Wechsel'), await page.inputValue('#hTemp') === '38,4');
  if (await page.inputValue('#hTemp') !== '38,4') await page.fill('#hTemp', '38,4');
  await act(page, 'fieber-add'); ok(L('Fieber'), await page.locator('text=38,4 °C').count() === 1);
  await page.fill('#hMed', 'Paracetamol'); await page.fill('#hDose', '125 mg'); await act(page, 'medi-add');
  ok(L('Medikament'), await page.locator('text=Paracetamol, 125 mg').count() === 1);
  ok(L('Medikament-Formular danach leer'), await page.inputValue('#hMed') === '');
  await act(page, 'log-del'); await act(page, 'log-del');
  ok(L('Log löschen zweistufig'), await page.locator('text=Paracetamol, 125 mg').count() === 0);
  await shot('09-gesundheit');

  // Pass
  await act(page, 'tab', 'pass'); await chk('Pass'); await shot('10-pass');
  await page.fill('#pTitle', 'U2'); await act(page, 'pass-kind', 'Messung');
  ok(L('Titel bleibt beim Wechsel der Art'), await page.inputValue('#pTitle') === 'U2');
  await page.fill('#pTitle', 'U2'); await page.fill('#pW', '4200'); await page.fill('#pH', '55'); await act(page, 'pass-add');
  ok(L('Pass-Eintrag'), await page.locator('text=4200 g').count() === 1);
  await act(page, 'vacc');
  await act(page, 'pass-seg', 'wachstum'); ok(L('Wachstumskurve'), await page.locator('svg.chart polyline').count() === 1);
  await act(page, 'chart', 'groesse'); await chk('Wachstum'); await shot('11-wachstum');
  await act(page, 'pass-seg', 'tagebuch');
  await page.fill('#dText', 'Erstes Lächeln');
  const png = path.join(OUT, 'photo.png'); await page.screenshot({ path: png, clip: { x: 0, y: 0, width: 200, height: 150 } });
  await page.locator('#dText').blur(); await page.setInputFiles('#dPhoto', png); await page.waitForSelector('img.photo');
  ok(L('Tagebuchtext bleibt nach Foto-Auswahl'), await page.inputValue('#dText') === 'Erstes Lächeln');
  if (await page.inputValue('#dText') !== 'Erstes Lächeln') await page.fill('#dText', 'Erstes Lächeln');
  await act(page, 'diary-add'); ok(L('Tagebuch mit Foto'), await page.locator('.card img.photo').count() === 1);
  await chk('Tagebuch'); await shot('12-tagebuch');

  // Reload: Daten bleiben
  await page.reload(); await page.waitForSelector('.hero');
  ok(L('Daten nach Neuladen'), (await page.locator('.brand').innerText()).startsWith('Mia'));

  // Export / Import in zweitem Profil, inkl. Löschungen
  await act(page, 'tab', 'settings');
  const [ex] = await Promise.all([page.waitForEvent('download'), act(page, 'share')]);
  const expPath = path.join(OUT, label + '-export.json'); await ex.saveAs(expPath);
  const ctx2 = await browser.newContext({ ...ctxOpts, locale: 'de-AT' }); const p2 = await ctx2.newPage(); p2.setDefaultTimeout(8000);
  p2.on('pageerror', e => errors.push('B: ' + e.message));
  await p2.goto(URL_); await p2.waitForSelector('.hero'); await act(p2, 'tab', 'settings');
  await p2.setInputFiles('#importFile', expPath); await p2.waitForTimeout(300);
  ok(L('Import auf Gerät B'), (await p2.locator('.brand').innerText()).startsWith('Mia'));
  ok(L('Import: Gelöschtes bleibt gelöscht'), !(await p2.evaluate(() => document.body.innerText.includes('Paracetamol'))));
  // B löscht Kontakt, Rückweg zu A
  await act(p2, 'tab', 'heute'); await act(p2, 'tab', 'kontakte'); await act(p2, 'contact-del'); await act(p2, 'contact-del');
  await act(p2, 'tab', 'settings');
  const [ex2] = await Promise.all([p2.waitForEvent('download'), act(p2, 'share')]);
  const exp2 = path.join(OUT, label + '-export2.json'); await ex2.saveAs(exp2);
  await page.setInputFiles('#importFile', exp2); await page.waitForTimeout(300);
  await act(page, 'tab', 'heute'); await act(page, 'tab', 'kontakte'); ok(L('Löschung kommt beim Abgleich mit'), await page.locator('text=Hebamme Anna').count() === 0);
  await ctx2.close();

  // XSS über präparierte Importdatei
  const evil = { app: 'wuzerl', version: 1, data: { appts: { ax: { title: 'X', date: addD(3), who: '"><img src=x onerror="window.__xss=1">', _u: Date.now() } },
    logs: { lx: { type: 'flasche', at: Date.now(), ml: '<img src=x onerror="window.__xss=1">', _u: Date.now() } } } };
  const evilPath = path.join(OUT, 'evil.json'); fs.writeFileSync(evilPath, JSON.stringify(evil));
  await act(page, 'tab', 'settings'); await page.setInputFiles('#importFile', evilPath); await page.waitForTimeout(200);
  for (const t of ['heute', 'termine', 'baby']) { await act(page, 'tab', t); await page.waitForTimeout(150); }
  ok(L('Kein Skript aus Importdatei'), !(await page.evaluate(() => window.__xss)));

  // Kurzansicht
  await act(page, 'tab', 'settings'); await page.click('label[for=sKurz]'); await page.waitForTimeout(100);
  ok(L('Kurzansicht'), await page.locator('#nav').isHidden()); await chk('Kurzansicht'); await shot('13-kurz');
  await act(page, 'kurz-off');

  // Alles löschen
  await act(page, 'tab', 'settings'); await act(page, 'wipe'); await act(page, 'wipe');
  ok(L('Alles löschen'), await page.locator('#setupEt').count() === 0 ? (await act(page, 'tab', 'heute'), await page.locator('#setupEt').count() === 1) : true);

  ok(L('Keine JS-Fehler'), !errors.length, errors.join(' | '));
  ok(L('Keine fremden Netzwerkanfragen'), !foreign.length, foreign.join(' '));
  await browser.close();
}

(async () => {
  const which = process.argv[2] || 'all';
  const sets = { pc: { viewport: { width: 1280, height: 800 } }, iphone: devices['iPhone 13'], klein: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
  for (const [k, o] of Object.entries(sets)) if (which === 'all' || which === k) {
    const { defaultBrowserType, ...rest } = o; try { await run(k, rest); } catch (e) { ok(k + ': ABBRUCH', false, e.message.split('\n')[0]); await browser.close(); }
  }
  const fail = results.filter(r => !r.pass);
  console.log(`\n${results.length - fail.length}/${results.length} bestanden`);
  process.exitCode = fail.length ? 1 : 0;
  fail.forEach(r => console.log('FEHLER: ' + r.name + ' ' + r.info));
})().catch(e => { console.error(e); process.exit(1); });
