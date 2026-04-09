const { z } = require('zod');

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO date YYYY-MM-DD');

const score1to5 = z.number().int().min(1).max(5);
const rpe0to10 = z.number().min(0).max(10);

const WellnessSchema = z.object({
  team_id: z.number().int().positive(),
  session_id: z.number().int().positive().nullable().optional(),
  player_id: z.number().int().positive().optional(),
  date: isoDateSchema,
  fatiga: score1to5,
  sueno_calidad: score1to5,
  sueno_horas: z.number().min(0).max(24),
  estres: score1to5,
  motivacion: score1to5,
  dano_muscular: score1to5,
  molestias_zonas: z.array(z.string().trim().min(1)).optional().default([]),
  enfermedad: z.string().trim().max(100).nullable().optional(),
  sensacion_proximo: z.string().trim().max(100).nullable().optional(),
  entrenamiento_previo: z.boolean().nullable().optional(),
  otros_comentarios: z.string().trim().max(1000).nullable().optional(),
});

const RpeSubmissionSchema = z.object({
  team_id: z.number().int().positive(),
  session_id: z.number().int().positive(),
  player_id: z.number().int().positive().optional(),
  date: isoDateSchema,
  rpe: rpe0to10,
  comentarios: z.string().trim().max(1000).nullable().optional(),
});

module.exports = {
  WellnessSchema,
  RpeSubmissionSchema,
};
