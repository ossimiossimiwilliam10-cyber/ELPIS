import { test, expect } from '@playwright/test';

test.describe('ELPIS E2E Tests', () => {
  
  test('devrait charger la page d\'accueil (Dashboard)', async ({ page }) => {
    await page.goto('/');
    
    // Le titre de l'application
    await expect(page).toHaveTitle(/ELPIS/i);
    
    // Le Dashboard devrait être visible par défaut (ou un message de bienvenue)
    const welcomeRegex = /Bonjour|Bon après-midi|Bonsoir/i;
    await expect(page.locator('h2', { hasText: welcomeRegex })).toBeVisible();
  });

  test('devrait naviguer vers la page des Cours', async ({ page }) => {
    await page.goto('/');
    
    // Cliquer sur le lien de la sidebar
    await page.click('nav a:has-text("Cours")');
    
    // Vérifier que la page des cours est chargée
    await expect(page.locator('h2', { hasText: 'Bibliothèque de Cours' })).toBeVisible();
  });

  test('devrait naviguer vers la page des Statistiques', async ({ page }) => {
    await page.goto('/');
    
    await page.click('nav a:has-text("Statistiques")');
    
    await expect(page.locator('h2', { hasText: 'Statistiques & Historique' })).toBeVisible();
  });

  test('devrait naviguer vers la page de Configuration', async ({ page }) => {
    await page.goto('/');
    
    await page.click('nav a:has-text("Configuration")');
    
    await expect(page.locator('h2', { hasText: 'Paramètres & Configuration' })).toBeVisible();
  });

  test('devrait pouvoir ajouter une licence depuis la page Cours', async ({ page }) => {
    await page.goto('/');
    await page.click('nav a:has-text("Cours")');

    // On clique sur le bouton "+ Licence"
    const addLicenceBtn = page.locator('button', { hasText: '+ Licence' });
    if (await addLicenceBtn.isVisible()) {
      await addLicenceBtn.click();
      
      // On vérifie l'apparition d'un onglet Licence X
      await expect(page.locator('.tabs-header button', { hasText: /Licence \d+/ })).toBeVisible();
    }
  });

});
