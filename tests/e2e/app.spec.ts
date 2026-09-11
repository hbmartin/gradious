import { expect, test } from '@playwright/test'

const seeded = '/?m=r&v=1&s=8f3a2b1c'

test('opens the studio, edits method, and exports', async ({ page }) => {
  await page.goto(seeded)
  await expect(page.getByRole('img', { name: /gradient canvas/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Justin Jay Wang/i })).toBeVisible()
  await page.getByRole('button', { name: /Shape this gradient/i }).click()
  await page.getByRole('button', { name: 'Heightmap', exact: true }).click()
  await expect(page).toHaveURL(/m=h/)
  await page.getByRole('button', { name: 'More controls' }).click()
  await expect(page.getByRole('heading', { name: 'Shape the field' })).toBeVisible()
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Export gradient' })).toBeVisible()
  await expect(page.getByLabel('Generated code')).toHaveValue(/^<svg/)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download SVG' }).click()
  await expect((await download).suggestedFilename()).toMatch(/^gradient-heightmap-[0-9a-f]{8}\.svg$/)
})

test('keyboard shortcuts regenerate and show help', async ({ page }) => {
  await page.goto(seeded)
  const before = page.url()
  await page.keyboard.press('Space')
  await expect.poll(() => page.url()).not.toBe(before)
  await page.keyboard.press('?')
  await expect(page.getByRole('heading', { name: 'Shortcuts' })).toBeVisible()
})

test('malformed URLs recover visibly', async ({ page }) => {
  await page.goto('/?v=99&s=bad')
  await expect(page.getByRole('status')).toContainText('not available')
  await expect(page).toHaveURL(/v=1/)
})

test('ramp lock survives regeneration and unlocking releases it', async ({ page }) => {
  await page.goto(seeded)
  await page.getByRole('button', { name: /Shape this gradient/i }).click()
  await page.getByRole('button', { name: 'More controls' }).click()
  await page.getByLabel('Lock ramp when regenerating').check()
  const lockedOverride = new URL(page.url()).searchParams.get('o')
  await page.getByRole('button', { name: 'Close full controls' }).click()
  await page.getByRole('button', { name: 'Regenerate' }).click()
  expect(new URL(page.url()).searchParams.get('o')).toBe(lockedOverride)
  await page.getByRole('button', { name: 'More controls' }).click()
  await page.getByLabel('Lock ramp when regenerating').uncheck()
  await page.getByRole('button', { name: 'Close full controls' }).click()
  await page.getByRole('button', { name: 'Regenerate' }).click()
  expect(new URL(page.url()).searchParams.get('o')).toBeNull()
})

test('all snippet formats are available', async ({ page }) => {
  await page.goto(seeded)
  await page.keyboard.press('e')
  await page.getByRole('button', { name: 'React', exact: true }).click()
  await expect(page.getByLabel('Generated code')).toHaveValue(/export default function Gradient/)
  await page.getByRole('button', { name: 'CSS URI', exact: true }).click()
  await expect(page.getByLabel('Generated code')).toHaveValue(/^background-image:/)
  await page.getByLabel('Animated').check()
  await expect(page.getByLabel('Generated code')).toHaveValue(/%3Cstyle%3E/)
})

test('reduced motion forces a static effective mode', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(seeded)
  await page.getByRole('button', { name: /Shape this gradient/i }).click()
  await page.getByRole('button', { name: 'More controls' }).click()
  await expect(page.getByRole('button', { name: 'Ambient' })).toBeDisabled()
  await expect(page.getByText(/reduced-motion preference/i)).toBeVisible()
})

test('WebMCP tools register and use visible state actions', async ({ page }) => {
  await page.addInitScript(() => {
    const tools: Record<string, unknown> = {}
    Object.defineProperty(window, '__gradiousTools', { value: tools })
    Object.defineProperty(document, 'modelContext', { value: { registerTool(tool: { name: string }) { tools[tool.name] = tool } } })
  })
  await page.goto(seeded)
  const names = await page.evaluate(() => Object.keys((window as unknown as { __gradiousTools: Record<string, unknown> }).__gradiousTools))
  expect(names).toEqual(expect.arrayContaining(['get_gradient_state', 'regenerate_gradient', 'configure_gradient', 'export_gradient']))
  await page.evaluate(async () => {
    const tools = (window as unknown as { __gradiousTools: Record<string, { execute: (input: unknown) => Promise<unknown> }> }).__gradiousTools
    await tools.configure_gradient.execute({ method: 'heightmap', speed: 1.5 })
  })
  await expect(page).toHaveURL(/m=h/)
})

test('desktop interactive mode exposes draggable radial layers', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile')
  await page.goto('/?m=r&v=1&s=8f3a2b1c&mo=i')
  const handle = page.getByRole('button', { name: 'Move layer 1' })
  await expect(handle).toBeVisible()
  const bounds = await handle.boundingBox()
  if (!bounds) throw new Error('Layer handle has no bounds')
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 40, bounds.y + 30)
  await page.mouse.up()
  await expect.poll(() => new URL(page.url()).searchParams.has('o')).toBe(true)
})

test('mobile omits interactive controls and avoids horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile')
  await page.goto(seeded)
  await page.getByRole('button', { name: /Shape this gradient/i }).click()
  await page.getByRole('button', { name: 'More controls' }).click()
  await expect(page.getByRole('button', { name: 'Interactive' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('fixed seeds remain visually stable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile')
  await page.goto(seeded)
  await expect(page.locator('.app-shell')).toHaveScreenshot('radial-v1.png', { animations: 'disabled' })
  await page.goto('/?m=h&v=1&s=8f3a2b1c&mo=s')
  await expect(page.locator('.app-shell')).toHaveScreenshot('heightmap-v1.png', { animations: 'disabled' })
})
