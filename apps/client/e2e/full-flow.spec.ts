import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function register(page: import('@playwright/test').Page, email: string) {
  await page.goto('/register');
  await page.getByTestId('register-name').fill('E2E Owner');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('Password123!');
  await page.getByTestId('register-submit').click();
  await expect(page.getByTestId('onboard-name')).toBeVisible({ timeout: 15000 });
}

async function onboard(page: import('@playwright/test').Page) {
  await page.getByTestId('onboard-name').fill('E2E Salon');
  await page.getByTestId('onboard-phone').fill('+14155557000');
  await page.getByTestId('onboard-country').fill('US');
  await page.getByTestId('onboard-google-url').fill('https://g.page/r/e2e-example');
  await page.getByTestId('onboard-submit').click();
  await expect(page.getByTestId('wa-status')).toBeVisible({ timeout: 20000 });
}

test.describe('ReviewRelay E2E', () => {
  test('merchant flow: register → customer → CSV → request → simulator → landing → analytics', async ({
    page,
  }) => {
    const email = `e2e_${Date.now()}@example.com`;
    await register(page, email);
    await onboard(page);

    await page.getByTestId('goto-customers').click();
    await page.getByTestId('customer-name').fill('Casey Customer');
    await page.getByTestId('customer-phone').fill('+14155557001');
    await page.getByTestId('customer-add').click();
    await expect(page.getByTestId('customers-table')).toContainText('Casey Customer');

    // Valid CSV
    const good = path.join(__dirname, 'fixtures/good.csv');
    fs.mkdirSync(path.dirname(good), { recursive: true });
    fs.writeFileSync(good, 'name,phone,consent\nCSV User,+14155557002,yes\n');
    await page.getByTestId('csv-input').setInputFiles(good);
    await expect(page.getByTestId('customer-message')).toContainText(/Imported 1/i, {
      timeout: 15000,
    });

    // Invalid CSV
    const bad = path.join(__dirname, 'fixtures/bad.csv');
    fs.writeFileSync(bad, 'name,phone,consent\nBad,xx,yes\n');
    await page.getByTestId('csv-input').setInputFiles(bad);
    await expect(page.getByTestId('customer-message')).toContainText(/rejected/i, {
      timeout: 15000,
    });

    await page.goto('/requests');
    await page
      .getByTestId('request-customer')
      .selectOption({ label: 'Casey Customer (+14155557001)' });
    await page.getByTestId('request-preview').click();
    await expect(page.getByTestId('request-preview-result')).toContainText(/Ready|SIMULATED/i);
    await page.getByTestId('request-confirm').click();
    await expect(page.getByTestId('request-message')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('sim-deliver').click();
    await page.getByTestId('sim-rate-5').click();
    await expect(page.getByTestId('request-message')).toContainText(/Rating:\s*5/i, {
      timeout: 15000,
    });

    // Reveal landing via API (session cookies shared with page.request)
    const csrfRes = await page.request.get('/api/v1/auth/csrf');
    const { csrfToken } = await csrfRes.json();
    const list = await page.request.get('/api/v1/review-requests');
    const items = (await list.json()).items as { id: string; rating?: number }[];
    const rr = items.find((i) => i.rating === 5) || items[0];
    expect(rr).toBeTruthy();
    const reveal = await page.request.post('/api/v1/simulator/reveal-landing-token', {
      headers: { 'x-csrf-token': csrfToken },
      data: { reviewRequestId: rr!.id },
    });
    expect(reveal.ok()).toBeTruthy();
    const { token } = await reveal.json();
    expect(token).toBeTruthy();

    await page.goto(`/r/${token}`);
    await expect(page.getByTestId('landing-business')).toContainText('E2E Salon');
    await page.getByTestId('landing-draft').fill('Edited draft for Google');
    await page.getByTestId('landing-copy').click();
    await expect(page.getByTestId('landing-copy')).toContainText(/Copied|Copy/i);
    await page.getByTestId('landing-private').fill('Private note about wait times');
    await page
      .locator('form')
      .filter({ has: page.getByTestId('landing-private') })
      .locator('button[type="submit"]')
      .click();
    await expect(page.getByTestId('landing-private-ok')).toBeVisible({ timeout: 10000 });

    await page.goto('/analytics');
    await expect(page.getByTestId('analytics-grid')).toBeVisible();
    await expect(page.getByTestId('analytics-grid')).toContainText(/[1-9]/);
  });

  test('tenant isolation via UI sessions', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await register(pageA, `iso_a_${Date.now()}@example.com`);
    await onboard(pageA);
    await pageA.goto('/customers');
    await pageA.getByTestId('customer-name').fill('Secret A');
    await pageA.getByTestId('customer-phone').fill('+14155558001');
    await pageA.getByTestId('customer-add').click();
    await expect(pageA.getByTestId('customers-table')).toContainText('Secret A');

    await register(pageB, `iso_b_${Date.now()}@example.com`);
    await onboard(pageB);
    await pageB.goto('/customers');
    await expect(pageB.getByTestId('customers-table')).not.toContainText('Secret A');

    await ctxA.close();
    await ctxB.close();
  });

  test('expired landing token rejected', async ({ page }) => {
    await page.goto('/r/' + 'x'.repeat(43));
    await expect(page.getByTestId('landing-error')).toBeVisible();
  });

  test('disconnected WhatsApp shows actionable errors', async ({ page }) => {
    await register(page, `disc_${Date.now()}@example.com`);
    await onboard(page);
    await page.goto('/settings');
    await page.getByTestId('disconnect-wa').click();
    await expect(page.getByTestId('settings-message')).toContainText(/disconnected/i, {
      timeout: 15000,
    });
    await page.goto('/customers');
    await page.getByTestId('customer-name').fill('Need WA');
    await page.getByTestId('customer-phone').fill('+14155559001');
    await page.getByTestId('customer-add').click();
    await expect(page.getByTestId('customers-table')).toContainText('Need WA', { timeout: 15000 });
    await page.goto('/requests');
    await expect(page.getByTestId('request-customer')).toBeVisible();
    await page.getByTestId('request-customer').selectOption({ label: 'Need WA (+14155559001)' });
    await page.getByTestId('request-preview').click();
    await expect(page.getByTestId('request-preview-result')).toContainText(/WhatsApp/i, {
      timeout: 15000,
    });
  });
});
