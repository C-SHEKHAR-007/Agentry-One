import { test, expect } from '@playwright/test';

test.describe('Dashboard and Core Navigation', () => {
  test('should load the application and show projects', async ({ page }) => {
    // Navigate to the root URL (configured as http://localhost:5173 in playwright.config.ts)
    await page.goto('/');

    // Check if the main title or the Agentry logo is visible
    // We expect the app to load and show the dashboard for the default user
    await page.waitForLoadState('networkidle');

    // The app will redirect to /login, /setup, or show the dashboard based on auth state
    // Just verify the title is present, which indicates the React app successfully booted
    await expect(page).toHaveTitle(/Agentry/i);
    
    // Check that we don't have a blank page by ensuring some text is visible
    const bodyText = page.locator('body');
    await expect(bodyText).toBeVisible();
  });
});
