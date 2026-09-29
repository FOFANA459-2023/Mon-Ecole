import { expect, PASSWORD, signIn, test, USERS } from "./fixtures";

test.describe("sign-in", () => {
  test("wrong password is refused without saying which part was wrong", async ({ page }) => {
    await signIn(page, USERS.director, "not-the-password", { expectSuccess: false });
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("director signs in, the session survives a reload, and signs out", async ({ page }) => {
    await signIn(page, USERS.director);
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();

    // The access token lives in memory only: a reload must restore the session from the refresh cookie.
    await page.reload();
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();

    await page.getByRole("button", { name: /Mamadou Camara|MC/ }).first().click();
    await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/login/);

    // Signed out means signed out: protected pages send you back to the login page.
    await page.goto("/students");
    await expect(page).toHaveURL(/\/login\?next=%2Fstudents/);
  });

  test("a deep link is opened after signing in", async ({ page }) => {
    await page.goto("/classes");
    await expect(page).toHaveURL(/\/login\?next=%2Fclasses/);
    await page.locator("#login").fill(USERS.director);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("form button[type=submit]").click();
    await expect(page).toHaveURL(/\/classes$/);
  });
});
