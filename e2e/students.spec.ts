import { expect, signIn, test, USERS } from "./fixtures";

test.describe("students", () => {
  test("director finds a student and opens the file", async ({ page }) => {
    await signIn(page, USERS.director);
    await page.getByRole("navigation").first().getByRole("link", { name: "Élèves" }).click();
    await expect(page.getByRole("heading", { name: "Élèves" })).toBeVisible();

    const firstRow = page.getByRole("row").nth(1);
    const name = (await firstRow.getByRole("link").first().textContent())?.trim() ?? "";
    const lastName = name.split(" ")[0];
    await page.getByRole("textbox", { name: "Rechercher…" }).fill(lastName);
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(lastName)}`));
    await page.getByRole("link", { name }).first().click();
    await expect(page).toHaveURL(/\/students\/\d+$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(lastName, { ignoreCase: true });
  });

  test("global search jumps to a class", async ({ page }) => {
    await signIn(page, USERS.director);
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox").fill("ème");
    await page.getByRole("option").first().click();
    await expect(page).not.toHaveURL(/\/$/);
  });
});
