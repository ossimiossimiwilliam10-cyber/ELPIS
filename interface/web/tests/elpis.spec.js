import { test, expect } from '@playwright/test';

test.describe('ELPIS E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('elpisDisclaimerShown', 'true');
    });

    await page.route('/api/**', async route => {
      const url = route.request().url();
      if (url.includes('/config')) {
        await route.fulfill({ json: { targetGrade: 15, currentStreak: 5, fixedCommitments: [] } });
      } else if (url.includes('/orchestrateur')) {
        await route.fulfill({ json: { statistiques: { percent: 50, total: 10, done: 5 }, tachesDuJour: [] } });
      } else {
        await route.fulfill({ json: {} });
      }
    });
  });

  test('devrait charger le Dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ELPIS/i);
    const welcomeRegex = /Bonjour|Bon après-midi|Bonsoir/i;
    await expect(page.locator('h2', { hasText: welcomeRegex })).toBeVisible();
  });

  test('devrait naviguer vers la Bibliothèque de Cours', async ({ page }) => {
    await page.goto('/');
    await page.click('nav button:has-text("Bibliothèque")');
    await expect(page.locator('h2', { hasText: 'Bibliothèque de Cours' })).toBeVisible();
  });

  test('devrait naviguer vers les Statistiques', async ({ page }) => {
    await page.goto('/');
    await page.click('nav button:has-text("Statistiques")');
    await expect(page.locator('h2', { hasText: /Statistiques/ })).toBeVisible();
  });

  test('devrait naviguer vers la Configuration', async ({ page }) => {
    await page.goto('/');
    await page.click('nav button:has-text("Configuration")');
    await expect(page.locator('h2', { hasText: /Objectifs de Réussite|Objectifs/ })).toBeVisible();
  });

  test('devrait afficher le streak dans la sidebar', async ({ page }) => {
    await page.goto('/');
    const streakEl = page.locator('.sidebar-footer').or(page.locator('text=Streak'));
    await expect(streakEl.first()).toBeVisible({ timeout: 10000 });
  });

  test('devrait pouvoir naviguer vers Session du Jour', async ({ page }) => {
    await page.goto('/');
    await page.click('nav button:has-text("Session du Jour")');
    await expect(page.locator('h2', { hasText: 'Session du Jour' })).toBeVisible();
    // La page d'entraînement devrait se charger (même vide)
    await expect(page.locator('.entrainement-page').or(page.locator('text=Tout est fait'))).toBeVisible({ timeout: 10000 });
  });

  test('devrait pouvoir ajouter une licence depuis la page Cours', async ({ page }) => {
    await page.goto('/');
    await page.click('nav button:has-text("Bibliothèque")');
    const addLicenceBtn = page.locator('button', { hasText: '+ Licence' });
    if (await addLicenceBtn.isVisible()) {
      await addLicenceBtn.click();
      await expect(page.locator('.licence-tabs button', { hasText: /Licence \d+/ })).toBeVisible();
    }
  });

  test('devrait rester fonctionnel après navigation multiple (stress test)', async ({ page }) => {
    await page.goto('/');
    // Naviguer rapidement entre les onglets
    await page.click('nav button:has-text("Bibliothèque")');
    await page.waitForTimeout(300);
    await page.click('nav button:has-text("Statistiques")');
    await page.waitForTimeout(300);
    await page.click('nav button:has-text("Session du Jour")');
    await page.waitForTimeout(300);
    await page.click('nav button:has-text("Accueil")');
    // Le dashboard devrait toujours être visible
    await expect(page.locator('h2', { hasText: /Bonjour|Bon après-midi|Bonsoir/i })).toBeVisible({ timeout: 10000 });
  });

  test('devrait afficher la barre de progression sur le dashboard', async ({ page }) => {
    await page.goto('/');
    // Debug: Attendre 2 secondes et afficher le contenu HTML du body
    await page.waitForTimeout(2000);
    const html = await page.content();
    // Vérifie que la section "Statistiques de Progression" est présente
    const statsSection = page.locator('h2', { hasText: 'Statistiques de Progression' });
    await expect(statsSection).toBeVisible({ timeout: 10000 });
  });

  test('devrait afficher l\'interface des Heures de sommeil', async ({ page }) => {
    await page.goto('/');
    await page.click('nav button:has-text("Configuration")');
    // Vérifie la présence des champs Heure de Coucher et Réveil
    await expect(page.locator('label', { hasText: 'Heure de Coucher (24h)' })).toBeVisible();
    await expect(page.locator('label', { hasText: 'Heure de Réveil (24h)' })).toBeVisible();
  });

  test('devrait afficher la section Engagements dans Préparation Hebdo', async ({ page }) => {
    await page.goto('/');
    await page.click('nav button:has-text("Préparation Hebdo")');
    await expect(page.locator('h3', { hasText: /Engagements de la Semaine/i })).toBeVisible();
    await expect(page.locator('button', { hasText: '+ Ajouter un Engagement' })).toBeVisible();
  });

  test('devrait vérifier la présence des boutons d\'ajout manuel TD/TP dans la Bibliothèque', async ({ page }) => {
    await page.goto('/');
    await page.click('nav button:has-text("Bibliothèque")');
    // On ajoute une licence, semestre, UE, matière pour voir les boutons
    const addLicenceBtn = page.locator('button', { hasText: '+ Licence' });
    if (await addLicenceBtn.isVisible()) {
      await addLicenceBtn.click();
      await page.click('button:has-text("+ Semestre")');
      await page.click('button:has-text("+ UE")');
      await page.click('button:has-text("+ Matière")');
      // Vérifie que le bouton "+ Manuel" est visible pour les TD et TP
      const btnManuel = page.locator('button:has-text("+ Manuel")').first();
      await expect(btnManuel).toBeVisible();
    }
  });

  test('devrait simuler un engagement fixe et vérifier la stabilité', async ({ page }) => {
    await page.route('/api/config', async route => {
      await route.fulfill({ json: {
        targetGrade: 15,
        currentStreak: 5,
        fixedCommitments: [{ day: 'Tous les jours', start: '08:00', end: '12:00' }]
      }});
    });
    await page.goto('/');
    await expect(page.locator('h2', { hasText: /Bonjour|Bon après-midi|Bonsoir/i })).toBeVisible();
    await page.click('nav button:has-text("Préparation Hebdo")');
    await expect(page.locator('input[type="time"]').first()).toBeVisible();
  });

});
