const { z } = require('zod');

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO date YYYY-MM-DD');

const RpeSchema = z.object({
  team_id: z.number().int().positive(),
  session_id: z.number().int().positive().nullable().optional(),
  player_id: z.number().int().positive().optional(),
  date: isoDateSchema,
  rpe: z.number().min(0).max(10),
  comentarios: z.string().trim().max(1000).nullable().optional(),
});

module.exports = {
  RpeSchema,
};
