const { z, email } = require('./common');

const inviteMemberSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est requis.').max(150),
  email,
  role: z.enum(['admin', 'collaborateur'], { errorMap: () => ({ message: 'Rôle invalide.' }) }),
}).strip();

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'collaborateur'], { errorMap: () => ({ message: 'Rôle invalide.' }) }),
}).strip();

module.exports = { inviteMemberSchema, updateMemberRoleSchema };
