const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Session = require('../models/Session');

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const USER_REFRESH_COOKIE = 'oryxa_refresh';
const ADMIN_REFRESH_COOKIE = 'oryxa_admin_refresh';

function randomToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Sur deux domaines différents (ex. xxx.github.io + xxx.onrender.com) le cookie
// de session est « tiers » : Safari/iOS et de plus en plus de navigateurs le
// bloquent, et la connexion échoue. La vraie solution est un domaine propre
// partagé (app.oryxa.bj + api.oryxa.bj) : définir alors
//   COOKIE_SAMESITE=lax  et  COOKIE_DOMAIN=.oryxa.bj
// Sans ces variables, le comportement précédent est conservé.
function baseCookieOptions() {
  const production = process.env.NODE_ENV === 'production';
  const configured = String(process.env.COOKIE_SAMESITE || '').toLowerCase();
  const sameSite = ['lax', 'strict', 'none'].includes(configured) ? configured : (production ? 'none' : 'lax');
  const options = {
    httpOnly: true,
    secure: production || sameSite === 'none',
    sameSite,
    path: '/',
  };
  if (process.env.COOKIE_DOMAIN) options.domain = process.env.COOKIE_DOMAIN;
  return options;
}

function cookieOptions(maxAge) {
  return { ...baseCookieOptions(), maxAge };
}

function clearCookieOptions() {
  return baseCookieOptions();
}

async function createSession({ type, userId = null, adminEmail = null, req }) {
  const raw = randomToken();
  const now = new Date();
  const session = await Session.create({
    type,
    user: userId,
    adminEmail: adminEmail ? adminEmail.toLowerCase() : null,
    tokenHash: hashToken(raw),
    expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
    createdIp: req.ip || '',
    lastIp: req.ip || '',
    userAgent: String(req.get('user-agent') || '').slice(0, 1000),
    lastSeenAt: now,
  });
  return { session, raw };
}

function signAccessToken(payload, secret) {
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TTL });
}

function setRefreshCookie(res, type, raw) {
  res.cookie(type === 'admin' ? ADMIN_REFRESH_COOKIE : USER_REFRESH_COOKIE, raw, cookieOptions(REFRESH_TTL_MS));
}

function clearRefreshCookie(res, type) {
  res.clearCookie(type === 'admin' ? ADMIN_REFRESH_COOKIE : USER_REFRESH_COOKIE, clearCookieOptions());
}

function getRefreshToken(req, type) {
  return req.cookies?.[type === 'admin' ? ADMIN_REFRESH_COOKIE : USER_REFRESH_COOKIE] || null;
}

async function revokeSession(session, replacement = null) {
  if (!session) return;
  session.revokedAt = new Date();
  if (replacement) session.replacedBy = replacement._id;
  await session.save();
}

async function revokeAllForUser(userId) {
  await Session.updateMany({ type: 'user', user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

async function revokeAllForAdmin(adminEmail) {
  await Session.updateMany({ type: 'admin', adminEmail: adminEmail.toLowerCase(), revokedAt: null }, { $set: { revokedAt: new Date() } });
}

module.exports = {
  ACCESS_TTL,
  REFRESH_TTL_MS,
  USER_REFRESH_COOKIE,
  ADMIN_REFRESH_COOKIE,
  hashToken,
  createSession,
  signAccessToken,
  setRefreshCookie,
  clearRefreshCookie,
  getRefreshToken,
  revokeSession,
  revokeAllForUser,
  revokeAllForAdmin,
};
