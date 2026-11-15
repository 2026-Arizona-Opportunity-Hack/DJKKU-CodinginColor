import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Real Python in the browser: this downloads Pyodide from jsDelivr, so it needs the network.
// Desktop only, so CI downloads Python once per run.
test.skip(({ isMobile }) => isMobile, 'one browser is enough for the runtime check')
test.setTimeout(120_000)

test('a code activity runs Python, explains errors and stops endless loops', async ({ page }) => {
  await page.goto('/learn/explore/a/act-loops-code')
  await expect(page.getByRole('heading', { level: 1, name: 'Try it: count with a loop' })).toBeVisible()

  const run = page.getByRole('button', { name: /^Run$|Loading Python|Running/ })
  await expect(run).toBeDisabled()
  await page.getByLabel('What will this program print before you change it?').fill('6')

  const editor = page.getByLabel('Your code (Python)')
  await editor.fill('print(1 + 1)')
  await run.click()
  await expect(page.locator('pre', { hasText: /^2\s*$/ })).toBeVisible({ timeout: 90_000 })

  await editor.fill('print(totl)')
  await page.getByRole('button', { name: 'Run' }).click()
  await expect(page.getByText(/On line 1: Python doesn't know the name "totl"/)).toBeVisible()

  await editor.fill('while True:\n    pass')
  await page.getByRole('button', { name: 'Run' }).click()
  await expect(page.getByRole('alert')).toContainText('more than 5 seconds', { timeout: 15_000 })

  // After a stopped run, Python starts again and the fix passes the check.
  await editor.fill('total = 0\nfor n in range(1, 11):\n    total = total + n\nprint(total)')
  await page.getByRole('button', { name: 'Run' }).click()
  await expect(page.getByText('1 of 1 checks pass.')).toBeVisible({ timeout: 90_000 })

  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
})
