// Usage : node scripts/generateAdminPasswordHash.js "VotreMotDePasse"
// Affiche le hash bcrypt à coller dans ADMIN_PASSWORD_HASH sur Render.
// Voir docs/ADMIN_ACCESS.md.
const bcrypt = require('bcryptjs');

const motDePasse = process.argv[2];
if (!motDePasse) {
  console.error('Usage : node scripts/generateAdminPasswordHash.js "VotreMotDePasse"');
  process.exit(1);
}

const hash = bcrypt.hashSync(motDePasse, 12);
console.log('\nHash à coller dans ADMIN_PASSWORD_HASH sur Render :\n');
console.log(hash);
console.log('');
