function getConfiguredAdminEmail() {
  const singular = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (singular) return singular;
  const legacy = String(process.env.ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (legacy.length === 1) return legacy[0];
  return null;
}

module.exports = { getConfiguredAdminEmail };
