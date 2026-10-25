import { expect, test } from '@playwright/test';

const PAGES = [
  ['/', 'Short jobs stay fast'],
  ['/lab/', 'Switch each mechanism'],
  ['/llm/', 'Under FCFS, chats freeze'],
  ['/gpu/', 'One big job'],
  ['/results/', 'Feedback queues remove'],
  ['/method/', 'Three levels, two mechanisms'],
] as const;

for (const [path, heading] of PAGES) {
  test(`${path} loads without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`${path} has no horizontal scroll at 375 px`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('Run works on /llm and the chats stream', async ({ page }) => {
  await page.goto('/llm/');
  await page.getByRole('button', { name: 'Run' }).first().click();
  await expect(page.getByText('Live meters')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('list', { name: 'KV-cache slots' }).first()).toBeVisible();
  await page.waitForTimeout(1500);
  const busy = await page.locator('[role="listitem"][title*="#"]').count();
  expect(busy).toBeGreaterThan(0);
});

test('Run works on /gpu', async ({ page }) => {
  await page.goto('/gpu/');
  await page.getByRole('button', { name: 'Run' }).first().click();
  await expect(page.getByRole('list', { name: '64 GPUs' }).first()).toBeVisible({ timeout: 10_000 });
});

test('/lab renders four Gantt charts', async ({ page }) => {
  await page.goto('/lab/');
  await expect(page.getByRole('img', { name: /schedule$/ })).toHaveCount(4, { timeout: 10_000 });
});

test('/results charts have a table view', async ({ page }) => {
  await page.goto('/results/');
  await page.getByRole('button', { name: 'View as table' }).first().click();
  await expect(page.getByRole('table').first()).toBeVisible();
});

test('unknown routes show the 404 page', async ({ page }) => {
  await page.goto('/nope/');
  await expect(page.getByText('This page was never scheduled.')).toBeVisible();
});
