/**
 * Tests d'intégration pour l'API Bridge ELPIS.
 * Teste les parseurs Zod et le format des réponses d'erreur.
 * Framework: Vitest
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod Schema Tests (validation pure — pas besoin de supertest)
// ---------------------------------------------------------------------------

const chatMessageSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(10000)
  })).min(1).max(50)
});

const forceTaskSchema = z.object({
  matiere: z.string().min(1).max(200).optional().default('all'),
  type: z.enum(['CM', 'TD', 'TP', 'ANNALE', 'all']).optional().default('all'),
  dureeMin: z.number().int().min(0).max(480).optional().default(0)
});

describe('Zod Validation — Chat Schema', () => {
  it('devrait accepter un message valide', () => {
    const result = chatMessageSchema.safeParse({
      messages: [{ role: 'user', content: 'Bonjour' }]
    });
    expect(result.success).toBe(true);
  });

  it('devrait rejeter un body vide', () => {
    const result = chatMessageSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('devrait rejeter messages non-array', () => {
    const result = chatMessageSchema.safeParse({ messages: 'not_an_array' });
    expect(result.success).toBe(false);
  });

  it('devrait rejeter un rôle invalide', () => {
    const result = chatMessageSchema.safeParse({
      messages: [{ role: 'invalid_role', content: 'test' }]
    });
    expect(result.success).toBe(false);
  });

  it('devrait rejeter un contenu vide', () => {
    const result = chatMessageSchema.safeParse({
      messages: [{ role: 'user', content: '' }]
    });
    expect(result.success).toBe(false);
  });

  it('devrait rejeter un message trop long', () => {
    const result = chatMessageSchema.safeParse({
      messages: [{ role: 'user', content: 'x'.repeat(10001) }]
    });
    expect(result.success).toBe(false);
  });

  it('devrait rejeter plus de 50 messages', () => {
    const messages = Array.from({ length: 51 }, (_, i) => ({
      role: 'user',
      content: `Message ${i}`
    }));
    const result = chatMessageSchema.safeParse({ messages });
    expect(result.success).toBe(false);
  });

  it('devrait accepter exactement 50 messages', () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      role: 'user',
      content: `Message ${i}`
    }));
    const result = chatMessageSchema.safeParse({ messages });
    expect(result.success).toBe(true);
  });

  it('devrait rejeter 0 messages (array vide)', () => {
    const result = chatMessageSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it('devrait accepter les rôles system et assistant', () => {
    const result = chatMessageSchema.safeParse({
      messages: [
        { role: 'system', content: 'Instructions' },
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Réponse' }
      ]
    });
    expect(result.success).toBe(true);
  });

  it('devrait produire des erreurs détaillées', () => {
    const result = chatMessageSchema.safeParse({ messages: [{ role: 'user', content: '' }] });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod v4: error.issues au lieu de error.errors
      const issues = result.error?.issues || result.error?.errors || [];
      expect(issues.length).toBeGreaterThan(0);
    }
  });
});

describe('Zod Validation — ForceTask Schema', () => {
  it('devrait accepter des valeurs par défaut (body vide)', () => {
    const result = forceTaskSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.matiere).toBe('all');
      expect(result.data.type).toBe('all');
      expect(result.data.dureeMin).toBe(0);
    }
  });

  it('devrait accepter des paramètres valides', () => {
    const result = forceTaskSchema.safeParse({
      matiere: 'Algèbre',
      type: 'TD',
      dureeMin: 30
    });
    expect(result.success).toBe(true);
  });

  it('devrait rejeter un type invalide', () => {
    const result = forceTaskSchema.safeParse({ type: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('devrait accepter tous les types valides', () => {
    for (const type of ['CM', 'TD', 'TP', 'ANNALE', 'all']) {
      const result = forceTaskSchema.safeParse({ type });
      expect(result.success).toBe(true);
    }
  });

  it('devrait rejeter dureeMin négative', () => {
    const result = forceTaskSchema.safeParse({ dureeMin: -5 });
    expect(result.success).toBe(false);
  });

  it('devrait rejeter dureeMin > 480', () => {
    const result = forceTaskSchema.safeParse({ dureeMin: 500 });
    expect(result.success).toBe(false);
  });

  it('devrait accepter dureeMin = 480 (limite)', () => {
    const result = forceTaskSchema.safeParse({ dureeMin: 480 });
    expect(result.success).toBe(true);
  });

  it('devrait rejeter un matiere trop long', () => {
    const result = forceTaskSchema.safeParse({ matiere: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });
});

describe('Zod Validation — Historique Schema', () => {
  // Import dynamique pour éviter les problèmes de module
  let historiqueSchema;

  beforeAll(async () => {
    const schemas = await import('../moteur/schemas.js');
    historiqueSchema = schemas.historiqueSchema;
  });

  it('devrait accepter un historique vide', () => {
    const result = historiqueSchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it('devrait accepter une entrée valide', () => {
    const result = historiqueSchema.safeParse([{
      type: 'CM',
      titre: 'Chapitre 1',
      matiere: 'Algèbre',
      timestamp: '2026-01-01T00:00:00.000Z',
      dureeMinutes: 30
    }]);
    expect(result.success).toBe(true);
  });

  it('devrait rejeter une entrée sans type', () => {
    const result = historiqueSchema.safeParse([{
      matiere: 'Algèbre',
      timestamp: '2026-01-01T00:00:00.000Z'
    }]);
    expect(result.success).toBe(false);
  });

  it('devrait rejeter une entrée sans timestamp', () => {
    const result = historiqueSchema.safeParse([{
      type: 'CM',
      matiere: 'Algèbre'
    }]);
    expect(result.success).toBe(false);
  });
});

describe('Error Response Format Standardization', () => {
  it('devrait définir les codes derreur standards', async () => {
    const errorHandler = await import('../middleware/errorHandler.js');
    expect(errorHandler.ERROR_STATUS).toBeDefined();
    expect(errorHandler.ERROR_STATUS.VALIDATION_ERROR).toBe(400);
    expect(errorHandler.ERROR_STATUS.NOT_FOUND).toBe(404);
    expect(errorHandler.ERROR_STATUS.RATE_LIMITED).toBe(429);
    expect(errorHandler.ERROR_STATUS.AI_SERVICE_ERROR).toBe(502);
    expect(errorHandler.ERROR_STATUS.INTERNAL_ERROR).toBe(500);
  });

  it('devrait exporter createApiError', async () => {
    const errorHandler = await import('../middleware/errorHandler.js');
    expect(typeof errorHandler.createApiError).toBe('function');
  });

  it('createApiError devrait créer une erreur avec code et status', async () => {
    const { createApiError } = await import('../middleware/errorHandler.js');
    const err = createApiError('Test error', 'VALIDATION_ERROR');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Test error');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.status).toBe(400);
  });
});
