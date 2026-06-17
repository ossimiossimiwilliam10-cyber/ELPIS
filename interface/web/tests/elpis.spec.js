import { test, expect } from '@playwright/test';

test.describe('ELPIS E2E Tests', () => {

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
    await expect(page.locator('h2', { hasText: /Préférences Générales|Preferences Generales/ })).toBeVisible();
  });

  test('devrait afficher le streak dans la sidebar', async ({ page }) => {
    await page.goto('/');
    const streakEl = page.locator('.sidebar-footer').or(page.locator('text=Streak'));
    await expect(streakEl).toBeVisible({ timeout: 10000 });
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
    // Vérifie que la section "Statistiques de Progression" est présente
    const statsSection = page.locator('h2', { hasText: 'Statistiques de Progression' });
    await expect(statsSection).toBeVisible({ timeout: 10000 });
  });

});
