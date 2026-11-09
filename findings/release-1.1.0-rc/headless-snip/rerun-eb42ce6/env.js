async page => ({ chromium: page.context().browser().version(), userAgent: await page.evaluate(() => navigator.userAgent),
  viewport: page.viewportSize(), focus: await page.evaluate(() => document.hasFocus()), date: new Date().toISOString() })
