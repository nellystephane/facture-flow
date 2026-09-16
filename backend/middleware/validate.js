// Middleware générique de validation d'entrée (Zod). Utilisé sur les routes
// de création/modification pour rejeter des données mal formées AVANT
// qu'elles n'atteignent la base de données, avec un message clair en
// français plutôt qu'une erreur MongoDB cryptique ou un enregistrement
// silencieusement incomplet.
module.exports = function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const erreurs = result.error.issues.map((i) => ({
        champ: i.path.join('.') || undefined,
        message: i.message,
      }));
      const premiere = erreurs[0];
      const message = premiere?.champ ? `${premiere.champ} : ${premiere.message}` : premiere?.message || 'Données invalides.';
      return res.status(400).json({ message, code: 'VALIDATION_ERROR', erreurs });
    }
    // On remplace req.body par la version validée : les champs inconnus sont
    // retirés (voir .strict()/.strip() par schéma) et les types sont
    // normalisés (ex: trim() sur les chaînes, coercion de nombres).
    req.body = result.data;
    next();
  };
};
