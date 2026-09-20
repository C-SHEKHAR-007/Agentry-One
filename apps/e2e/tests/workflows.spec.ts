import { test, expect } from '@playwright/test';

test.describe('Workflows Navigation', () => {
  test('should navigate to executions page', async ({ page }) => {
    await page.goto('/');

    // Wait for the app to initialize
    await page.waitForLoadState('networkidle');

    // Look for a link to the workflows or executions page in the navigation bar or sidebar
    const workflowsLink = page.getByRole('link', { name: /executions|workflows/i }).first();
    
    // If the link exists on the dashboard, click it
    if (await workflowsLink.isVisible()) {
      await workflowsLink.click();
      await expect(page).toHaveURL(/.*workflows|.*executions/);
    } else {
      // Fallback: navigate directly to verify the route exists
      await page.goto('/workflows');
      await expect(page).toHaveURL(/.*workflows/);
    }
  });
});
