// Pagination standard pour toutes les listes de l'app (clients, factures,
// devis, paiements). Toutes les routes paginées renvoient la même forme —
// { items, page, limit, total, totalPages } — jamais un tableau brut, pour
// que le frontend n'ait qu'un seul format à gérer partout.
function paginationParams(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function paginatedResponse(items, total, page, limit) {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { paginationParams, paginatedResponse };
