import { expect, expectNoSeriousA11yViolations, signIn, test, USERS } from "./fixtures";

test.describe("accessibility (WCAG 2.1 AA, serious and critical issues)", () => {
  test("login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#login")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  for (const [name, path] of [
    ["dashboard", "/"],
    ["students", "/students"],
    ["classes", "/classes"],
    ["enrolment wizard", "/enrollments/new"],
  ] as const) {
    test(name, async ({ page }) => {
      await signIn(page, USERS.director);
      await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoSeriousA11yViolations(page);
    });
  }
});
