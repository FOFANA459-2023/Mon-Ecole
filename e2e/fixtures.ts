import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test as base } from "@playwright/test";

export const PASSWORD = process.env.E2E_PASSWORD ?? "";

/** Demo accounts created by the backend's `seed_demo` command (Groupe Scolaire Horizon). */
export const USERS = {
  director: "directeur@monecole.test",
  secretary: "secretariat@monecole.test",
  accountant: "comptable@monecole.test",
  teacher: "enseignant@monecole.test",
} as const;

/** Sign in through the login form and wait for the dashboard (pass `expectSuccess: false` for failures). */
export async function signIn(page: Page, login: string, password = PASSWORD, { expectSuccess = true } = {}) {
  await page.goto("/login");
  // The interface follows the account's language (French for the demo school), so use field ids.
  await page.locator("#login").fill(login);
  await page.locator("#password").fill(password);
  await page.locator("form button[type=submit]").click();
  if (expectSuccess) await expect(page.getByRole("heading", { level: 1, name: /Bonjour/ })).toBeVisible();
}

export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

export const test = base.extend({});
export { expect };

test.beforeAll(() => {
  if (!PASSWORD) throw new Error("Set E2E_PASSWORD to the password used with `manage.py seed_demo --password`.");
});
