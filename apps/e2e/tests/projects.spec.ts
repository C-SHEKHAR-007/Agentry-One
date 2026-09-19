import { test, expect } from '@playwright/test';

test.describe('Projects Flow', () => {
  test('should create a new project and view it', async ({ page }) => {
    await page.goto('/projects');
    
    // Check we're on the projects page
    await expect(page).toHaveTitle(/Agentry/i);
    
    // Wait for the "New Project" button
    const newProjectBtn = page.getByRole('button', { name: /new project/i });
    if (await newProjectBtn.isVisible()) {
      await newProjectBtn.click();
      
      // Fill the project name
      const input = page.getByPlaceholder('Project name');
      await expect(input).toBeVisible();
      
      const projectName = `E2E Test Project ${Date.now()}`;
      await input.fill(projectName);
      
      // Submit
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Wait for it to appear in the list or a success toast
      await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 });
    }
  });
});
