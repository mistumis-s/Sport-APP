const { z } = require('zod');

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO date YYYY-MM-DD');

const MatchDayTypeSchema = z.enum([
  'MD-5',
  'MD-4',
  'MD-3',
  'MD-2',
  'MD-1',
  'MD(H)',
  'MD(A)',
  'MD+1',
  'MD+2',
  'MD+3',
]);

const ColorDaySchema = z.enum(['AMARILLO', 'NARANJA', 'ROJO', 'ROJO+']);

const SessionSchema = z.object({
  team_id: z.number().int().positive(),
  date: isoDateSchema,
  match_day_type: MatchDayTypeSchema,
  is_match: z.boolean().default(false),
  color_day: ColorDaySchema,
  duration_minutes: z.number().int().positive().max(300),
  week: z.number().int().positive().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  created_by: z.number().int().positive().nullable().optional(),
});

module.exports = {
  SessionSchema,
  MatchDayTypeSchema,
  ColorDaySchema,
};
