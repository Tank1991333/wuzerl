// Nachgebautes Firebase (Anmeldung, Token, Firestore mit den Wuzerl-Regeln aus dem README) für die Tests.
// Fängt alle Anfragen an *.googleapis.com im Browser-Kontext ab, es geht nichts ins Netz.
const ADMIN = 'ahg4hJgbbcflgWxyerVdW7O0vvO2';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');

function createFake() {
  const S = { users: {}, freigaben: {}, anfragen: {}, offline: false, calls: [] };
  const jwt = u => b64({ alg: 'none' }) + '.' + b64({ user_id: u.uid, email: u.email, email_verified: !!u.verified }) + '.x';
  const byUid = uid => Object.values(S.users).find(u => u.uid === uid);
  const fromJwt = h => { try { return JSON.parse(Buffer.from((h || '').replace('Bearer ', '').split('.')[1], 'base64url')); } catch { return null; } };
  const sess = u => ({ idToken: jwt(u), refreshToken: 'rt-' + u.uid, localId: u.uid, email: u.email, expiresIn: '3600' });
  const err = (route, status, message) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { message, code: status } }) });
  const json = (route, o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  const doc = (coll, uid, d) => ({ name: `projects/ballonflugbuch/databases/(default)/documents/${coll}/${uid}`, fields: { email: { stringValue: d.email }, zeit: { integerValue: String(d.zeit) } } });

  S.addUser = (email, pw, o = {}) => (S.users[email] = { uid: o.uid || 'u' + Object.keys(S.users).length + 'x' + Math.random().toString(36).slice(2, 8), email, pw, verified: o.verified !== false });
  S.session = u => sess(u);

  S.install = async ctx => ctx.route(/googleapis\.com/, async route => {
    const req = route.request(), url = new URL(req.url()), body = req.postData() || '';
    S.calls.push(req.method() + ' ' + url.host + url.pathname);
    if (S.offline) return route.abort('internetdisconnected');
    if (url.host === 'identitytoolkit.googleapis.com') {
      const b = JSON.parse(body || '{}'), op = url.pathname.split(':').pop();
      if (op === 'signUp') { if (S.users[b.email]) return err(route, 400, 'EMAIL_EXISTS'); return json(route, sess(S.addUser(b.email, b.password, { verified: false }))); }
      if (op === 'signInWithPassword') { const u = S.users[b.email]; if (!u || u.pw !== b.password) return err(route, 400, 'INVALID_LOGIN_CREDENTIALS'); return json(route, sess(u)); }
      if (op === 'sendOobCode') return json(route, { email: b.email || 'x' });
      return err(route, 400, 'UNKNOWN');
    }
    if (url.host === 'securetoken.googleapis.com') {
      const rt = new URLSearchParams(body).get('refresh_token') || '', u = byUid(rt.replace(/^rt-/, ''));
      if (!u || u.disabled) return err(route, 400, u ? 'USER_DISABLED' : 'INVALID_REFRESH_TOKEN');
      const s = sess(u); return json(route, { id_token: s.idToken, refresh_token: s.refreshToken, user_id: u.uid, expires_in: '3600' });
    }
    if (url.host === 'firestore.googleapis.com') {
      const auth = fromJwt(req.headers()['authorization']), [coll, id] = url.pathname.split('/documents/')[1].split('/');
      if (!auth) return err(route, 403, 'PERMISSION_DENIED');
      const admin = auth.user_id === ADMIN, m = req.method(), store = coll === 'wuzerl_freigaben' ? S.freigaben : coll === 'wuzerl_anfragen' ? S.anfragen : null;
      if (!store) return err(route, 403, 'PERMISSION_DENIED');
      if (!id) return admin && m === 'GET' ? json(route, { documents: Object.entries(store).map(([k, d]) => doc(coll, k, d)) }) : err(route, 403, 'PERMISSION_DENIED');
      const own = auth.user_id === id;
      if (m === 'GET') { if (!own && !admin) return err(route, 403, 'PERMISSION_DENIED'); return store[id] ? json(route, doc(coll, id, store[id])) : err(route, 404, 'NOT_FOUND'); }
      if (m === 'PATCH') {
        const f = JSON.parse(body).fields || {}, d = { email: f.email && f.email.stringValue, zeit: Number(f.zeit && f.zeit.integerValue) };
        const keysOk = Object.keys(f).every(k => ['email', 'zeit'].includes(k));
        if (coll === 'wuzerl_anfragen' && !(own && auth.email_verified && keysOk && d.email === auth.email)) return err(route, 403, 'PERMISSION_DENIED');
        if (coll === 'wuzerl_freigaben' && !admin) return err(route, 403, 'PERMISSION_DENIED');
        store[id] = d; return json(route, doc(coll, id, d));
      }
      if (m === 'DELETE') { if (!(admin || (own && coll === 'wuzerl_anfragen'))) return err(route, 403, 'PERMISSION_DENIED'); delete store[id]; return json(route, {}); }
    }
    return err(route, 400, 'UNKNOWN');
  });

  // Gerät gilt als angemeldet und freigeschaltet (für die normalen Abläufe)
  S.loginInit = async (ctx, u) => ctx.addInitScript(([a, z]) => {
    if (!localStorage.getItem('unserbaby:auth')) { localStorage.setItem('unserbaby:auth', a); localStorage.setItem('unserbaby:zugang', z); }
  }, [JSON.stringify({ uid: u.uid, email: u.email, rt: 'rt-' + u.uid }), u.uid]);
  return S;
}
module.exports = { createFake, ADMIN };
