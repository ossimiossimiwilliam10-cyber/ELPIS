# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: elpis.spec.js >> ELPIS E2E Tests >> devrait charger la page d'accueil (Dashboard)
- Location: tests\elpis.spec.js:5:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h2').filter({ hasText: /Bonjour|Bon après-midi|Bonsoir/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('h2').filter({ hasText: /Bonjour|Bon après-midi|Bonsoir/i })

```

```yaml
- heading "ELPIS" [level=1]
- paragraph: Compagnon Intelligent
- navigation:
  - text: Quotidien
  - button "🏠 Accueil"
  - button "🎯 Session du Jour"
  - text: Scolarité
  - button "📚 Bibliothèque"
  - button "📅 Calendrier"
  - text: Système
  - button "📈 Statistiques"
  - button "⚙️ Configuration"
- text: "🔥 Streak : 0 Jour"
- button "☀️"
- button "🛑"
- text: Système en ligne
- main:
  - heading "Bienvenue sur ELPIS" [level=2]
  - paragraph: Configure tes objectifs et tes cours pour activer l'Orchestrateur.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('ELPIS E2E Tests', () => {
  4  |   
  5  |   test('devrait charger la page d\'accueil (Dashboard)', async ({ page }) => {
  6  |     await page.goto('/');
  7  |     
  8  |     // Le titre de l'application
  9  |     await expect(page).toHaveTitle(/ELPIS/i);
  10 |     
  11 |     // Le Dashboard devrait être visible par défaut (ou un message de bienvenue)
  12 |     const welcomeRegex = /Bonjour|Bon après-midi|Bonsoir/i;
> 13 |     await expect(page.locator('h2', { hasText: welcomeRegex })).toBeVisible();
     |                                                                 ^ Error: expect(locator).toBeVisible() failed
  14 |   });
  15 | 
  16 |   test('devrait naviguer vers la page des Cours', async ({ page }) => {
  17 |     await page.goto('/');
  18 |     
  19 |     // Cliquer sur le lien de la sidebar
  20 |     await page.click('nav a:has-text("Cours")');
  21 |     
  22 |     // Vérifier que la page des cours est chargée
  23 |     await expect(page.locator('h2', { hasText: 'Bibliothèque de Cours' })).toBeVisible();
  24 |   });
  25 | 
  26 |   test('devrait naviguer vers la page des Statistiques', async ({ page }) => {
  27 |     await page.goto('/');
  28 |     
  29 |     await page.click('nav a:has-text("Statistiques")');
  30 |     
  31 |     await expect(page.locator('h2', { hasText: 'Statistiques & Historique' })).toBeVisible();
  32 |   });
  33 | 
  34 |   test('devrait naviguer vers la page de Configuration', async ({ page }) => {
  35 |     await page.goto('/');
  36 |     
  37 |     await page.click('nav a:has-text("Configuration")');
  38 |     
  39 |     await expect(page.locator('h2', { hasText: 'Paramètres & Configuration' })).toBeVisible();
  40 |   });
  41 | 
  42 |   test('devrait pouvoir ajouter une licence depuis la page Cours', async ({ page }) => {
  43 |     await page.goto('/');
  44 |     await page.click('nav a:has-text("Cours")');
  45 | 
  46 |     // On clique sur le bouton "+ Licence"
  47 |     const addLicenceBtn = page.locator('button', { hasText: '+ Licence' });
  48 |     if (await addLicenceBtn.isVisible()) {
  49 |       await addLicenceBtn.click();
  50 |       
  51 |       // On vérifie l'apparition d'un onglet Licence X
  52 |       await expect(page.locator('.tabs-header button', { hasText: /Licence \d+/ })).toBeVisible();
  53 |     }
  54 |   });
  55 | 
  56 | });
  57 | 
```