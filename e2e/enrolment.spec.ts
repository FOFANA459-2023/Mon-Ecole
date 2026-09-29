import { expect, signIn, test, USERS } from "./fixtures";

test("the enrolment desk registers a new student end to end", async ({ page }) => {
  const lastName = `Testeur${Date.now().toString().slice(-6)}`;
  await signIn(page, USERS.secretary);
  await page.goto("/enrollments/new");
  await expect(page.getByRole("heading", { name: "Nouvelle inscription" })).toBeVisible();

  // Student
  await page.locator("#stu-last_name").fill(lastName);
  await page.locator("#stu-first_name").fill("Aminata");
  await page.locator("#stu-gender").click();
  await page.getByRole("option", { name: "Féminin" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  // Parents: continue without adding one (the wizard warns but allows it)
  await page.getByRole("button", { name: "Continuer" }).click();

  // Schooling: first class with free places in the current year
  await page.locator("#w-class").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Continuer" }).click();

  // Confirm
  await page.getByRole("button", { name: "Valider l'inscription" }).click();
  await expect(page.getByRole("heading", { name: "Inscription enregistrée" })).toBeVisible();

  // The new student is in the list.
  await page.goto(`/students?q=${lastName}`);
  await expect(page.getByRole("link", { name: new RegExp(lastName, "i") })).toBeVisible();
});
