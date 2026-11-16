'use strict';

const mongoose = require('mongoose');

// Verrou distribué minimal (collection `joblocks`) : empêche qu'un même job
// tourne deux fois en parallèle quand l'API est lancée en plusieurs instances,
// ou quand le cron interne et un déclencheur externe se chevauchent.
// Le verrou expire tout seul (ttl) pour ne jamais rester bloqué après un crash.
async function withJobLock(name, ttlMs, fn) {
  const col = mongoose.connection.collection('joblocks');
  const now = new Date();
  const until = new Date(now.getTime() + ttlMs);
  let acquired = false;
  try {
    const res = await col.findOneAndUpdate(
      { _id: name, $or: [{ lockedUntil: { $lt: now } }, { lockedUntil: null }] },
      { $set: { lockedUntil: until, lockedAt: now } },
      { upsert: true, returnDocument: 'after' }
    );
    acquired = Boolean(res && (res.value || res._id || res.lockedUntil));
  } catch (err) {
    // E11000 : le verrou existe et n'est pas expiré => un autre processus le tient.
    if (err && err.code === 11000) return { skipped: true };
    throw err;
  }
  if (!acquired) return { skipped: true };
  try {
    const value = await fn();
    return { skipped: false, value };
  } finally {
    try { await col.updateOne({ _id: name }, { $set: { lockedUntil: null } }); } catch { /* le TTL prendra le relais */ }
  }
}

module.exports = { withJobLock };
