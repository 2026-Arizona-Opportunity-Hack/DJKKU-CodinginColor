import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Demo mode: the app runs on sample data, so a fresh visitor can walk the public path.
test('landing, sign-in, guest lessons and one lesson', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Home \| Coding in Color Learn/)
  await expect(page.getByRole('heading', { level: 1, name: 'Coding in Color' })).toBeVisible()
  await expect(page.getByText(/Demo mode/).first()).toBeVisible()

  // sign-in renders both ways in
  await page.getByRole('link', { name: 'I have a login code' }).click()
  await expect(page).toHaveTitle(/Sign in/)
  await expect(page.getByRole('heading', { name: "I'm a student" })).toBeVisible()
  await expect(page.getByRole('heading', { name: "I'm a teacher, CIC staff or reviewer" })).toBeVisible()
  await expect(page.getByLabel('Your login code')).toBeVisible()

  // guest explore
  await page.goto('/')
  await page.getByRole('link', { name: 'Browse lessons' }).click()
  await expect(page).toHaveURL(/\/learn\/explore$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // open a lesson
  const lesson = page.locator('main a[href*="/learn/explore/a/"]').first()
  await expect(lesson).toBeVisible()
  await lesson.click()
  await expect(page).toHaveURL(/\/learn\/explore\/a\//)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('button').first()).toBeVisible()
})

test('every public page is keyboard reachable from the skip link and has no serious accessibility problems', async ({ page }) => {
  for (const path of ['/', '/sign-in', '/learn/explore']) {
    await page.goto(path)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  }
})

test('no page scrolls sideways on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone project only')
  for (const path of ['/', '/sign-in', '/learn/explore', '/learn', '/learn/class-sat/test/pre-basics']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(1)
  }
})
