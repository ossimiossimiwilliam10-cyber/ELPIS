const { z } = require('zod');

// Schéma de validation pour la configuration
const configSchema = z.object({
  profil: z.object({
    fatigueChronique: z.boolean().optional(),
    chronobiologie: z.enum(["morning_lark", "night_owl", "neutral"]).optional()
  }).optional(),
  deepseek: z.object({
    model: z.string().optional()
  }).optional(),
  targetGrade: z.number().optional(),
  restDays: z.array(z.string()).optional(),
  maxStudyHoursPerDay: z.number().optional(),
  maxSubjectsPerDay: z.number().optional(),
  fixedCommitments: z.array(z.object({
    day: z.string(),
    start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format HH:MM attendu"),
    end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format HH:MM attendu"),
    matiereLinked: z.string().optional()
  })).optional(),
  defaultDurationAnki: z.number().optional(),
  defaultDurationRevCM: z.number().optional(),
  defaultDurationTD: z.number().optional(),
  defaultDurationTP_Etape1: z.number().optional(),
  defaultDurationTP_Etape2: z.number().optional(),
  defaultDurationTP_Etape3: z.number().optional(),
  defaultDurationTP_Etape4: z.number().optional(),
  defaultDurationAnnales: z.number().optional(),
  defaultDurationNewCM: z.number().optional(),
  maxNewCMPerSubjectPerDay: z.number().optional(),
  maxNewCMPerSemesterPerDay: z.number().optional(),
  studyStartDate: z.string().optional(),
  dernierePratiqueAnki: z.string().optional()
}).catchall(z.any());

// Schéma de validation pour un élément d'historique
const historiqueEntrySchema = z.object({
  type: z.string(),
  titre: z.string().optional(),
  matiere: z.string(),
  action: z.string().optional(),
  timestamp: z.string(),
  dureeMinutes: z.number().optional()
}).catchall(z.any());

const historiqueSchema = z.array(historiqueEntrySchema);

// Schémas de validation pour les cours
const cmSchema = z.object({
  titre: z.string(),
  derniereRevision: z.string().optional(),
  prochaineRevisionDate: z.string().optional(),
  jActuel: z.number().optional(),
  tempsMoyen: z.number().optional(),
  fichePdfPath: z.string().optional()
}).catchall(z.any());

const exSchema = z.object({
  titre: z.string(),
  dernierePratique: z.string().optional(),
  dateTP: z.string().optional(),
  nombrePratiques: z.number().optional(),
  tempsMoyen: z.number().optional(),
  tempsMoyenEtapes: z.array(z.number().nullable()).optional(),
  pdfPath: z.string().optional(),
  page: z.number().optional(),
  difficulte: z.string().optional()
}).catchall(z.any());

const matiereSchema = z.object({
  nom: z.string(),
  coef: z.number().optional(),
  ects: z.number().optional(),
  dateExamen: z.string().optional(),
  listeCM: z.array(cmSchema).optional(),
  listeTD: z.array(exSchema).optional(),
  listeTP: z.array(exSchema).optional(),
  listeAnnales: z.array(exSchema).optional()
}).catchall(z.any());

const ueSchema = z.object({
  nom: z.string(),
  matieres: z.array(matiereSchema).optional()
}).catchall(z.any());

const semestreSchema = z.object({
  nom: z.string(),
  archived: z.boolean().optional(),
  dateFin: z.string().optional(),
  ues: z.array(ueSchema).optional()
}).catchall(z.any());

const licenceSchema = z.object({
  nom: z.string(),
  archived: z.boolean().optional(),
  semestres: z.array(semestreSchema).optional()
}).catchall(z.any());

const coursSchema = z.object({
  licences: z.array(licenceSchema)
}).catchall(z.any());

module.exports = {
  configSchema,
  coursSchema,
  historiqueSchema
};
