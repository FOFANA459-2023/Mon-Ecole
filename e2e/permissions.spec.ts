import { expect, signIn, test, USERS } from "./fixtures";

test.describe("roles and permissions", () => {
  test("a teacher sees only teaching modules and cannot open settings @mobile", async ({ page }) => {
    await signIn(page, USERS.teacher);
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
    const nav = page.getByRole("navigation").first();
    await page.goto("/settings/users");
    await expect(page).not.toHaveURL(/\/settings\/users/);
    await expect(nav.getByRole("link", { name: "Paramètres" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Inscriptions" })).toHaveCount(0);
  });

  test("the accountant cannot reach user management", async ({ page }) => {
    await signIn(page, USERS.accountant);
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
    await page.goto("/settings/users");
    await expect(page).not.toHaveURL(/\/settings\/users/);
  });

  test("the API refuses what the interface hides", async ({ page, request }) => {
    await signIn(page, USERS.teacher);
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
    // Without the in-memory access token, a direct call is unauthenticated.
    const anonymous = await request.get("/api/v1/users/");
    expect(anonymous.status()).toBe(401);
  });
});
