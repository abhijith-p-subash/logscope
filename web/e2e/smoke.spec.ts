import { expect, test } from "@playwright/test";

test("renders virtualized rows, opens the detail tree, and filters by search", async ({ page }) => {
  await page.goto("/");

  // Rows render from the watched fixture.
  await expect(page.locator(".row").first()).toBeVisible();
  expect(await page.locator(".row").count()).toBeGreaterThan(0);

  // Ribbon canvas and sidebar are present.
  await expect(page.locator(".ribbon canvas")).toBeVisible();
  await expect(page.locator(".side")).toBeVisible();

  // The error row renders with the error class.
  await expect(page.locator(".row.err").first()).toBeVisible();

  // Clicking a row opens the detail panel.
  await page.locator(".row").first().click();
  await expect(page.locator(".detail")).toBeVisible();

  // Searching narrows results; a nonsense query shows the empty state.
  await page.locator(".search input").fill("zzz-no-such-term");
  await expect(page.locator(".empty")).toBeVisible();

  // Clearing the search brings rows back.
  await page.locator(".search input").fill("");
  await expect(page.locator(".row").first()).toBeVisible();

  // Level pills filter: show only errors.
  await page.locator(".pill.error").click();
  await expect(page.locator(".row").first()).toBeVisible();
  await expect(page.locator(".row:not(.err)")).toHaveCount(0);
});
