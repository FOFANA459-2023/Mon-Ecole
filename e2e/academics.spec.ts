import type { APIRequestContext, Page } from "@playwright/test";

import { expect, PASSWORD, signIn, test, USERS } from "./fixtures";

/**
 * Journey #2 (build plan §12): the teacher takes the register on a phone and marks an assessment, the
 * director publishes the marks and prints the report cards — one student's, then the class in the background.
 *
 * Mrs Condé (enseignant@) teaches French in 7ème A and leads that class in the demo school.
 */
const CLASS = "7ème A";
const SUBJECT = "Français";
const RUN = Date.now().toString().slice(-6);

type Session = { token: string; school: number };

async function apiSession(request: APIRequestContext, login: string): Promise<Session> {
  const response = await request.post("/api/v1/auth/login/", { data: { login, password: PASSWORD } });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return { token: body.access, school: body.user.memberships[0].school.id };
}

function headers(session: Session) {
  return { Authorization: `Bearer ${session.token}`, "X-School-ID": String(session.school) };
}

/** The French gradebook of 7ème A this term, open again if an earlier run left it submitted or published. */
async function openGradebook(request: APIRequestContext): Promise<{ id: number; term: number; classId: number }> {
  const director = await apiSession(request, USERS.director);
  const years = await (await request.get("/api/v1/academic-years/", { headers: headers(director) })).json();
  const year = years.find((y: { is_current: boolean }) => y.is_current);
  const today = new Date().toISOString().slice(0, 10);
  const term =
    year.terms.find((t: { start_date: string; end_date: string }) => t.start_date <= today && today <= t.end_date) ??
    year.terms[0];
  const list = await request.get("/api/v1/gradebooks/", {
    headers: headers(director),
    params: { term: term.id, search: SUBJECT, page_size: 100 },
  });
  const book = (await list.json()).results.find(
    (g: { class_name: string; subject_name: string }) => g.class_name === CLASS && g.subject_name === SUBJECT,
  );
  expect(book, `${SUBJECT} — ${CLASS} gradebook`).toBeTruthy();
  const step = book.status === "published" ? "reopen" : book.status === "submitted" ? "send-back" : null;
  if (step) {
    const reset = await request.post(`/api/v1/gradebooks/${book.id}/${step}/`, {
      headers: headers(director),
      data: { reason: "End-to-end test run" },
    });
    expect(reset.ok()).toBeTruthy();
  }
  return { id: book.id, term: term.id, classId: book.class_group };
}

async function save(page: Page, name: RegExp) {
  await page.getByRole("button", { name }).click();
}

test.describe.serial("academics journey", () => {
  let gradebook: { id: number; term: number; classId: number };

  test.beforeAll(async ({ request }) => {
    gradebook = await openGradebook(request);
  });

  test("the teacher takes today's register from a phone @mobile", async ({ page }) => {
    await signIn(page, USERS.teacher);
    await page.goto("/attendance");
    const card = page.locator('[data-slot="card"]').filter({ has: page.getByText(CLASS, { exact: true }) });
    await card.getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(CLASS) })).toBeVisible();

    const groups = page.getByRole("radiogroup");
    // One student absent and one late; swapped when an earlier run left them so, so there is a change to save.
    const swap = (await groups.nth(0).getByRole("radio", { name: "Absent" }).getAttribute("aria-checked")) === "true";
    await groups.nth(0).getByRole("radio", { name: swap ? "Retard" : "Absent" }).click();
    await groups.nth(1).getByRole("radio", { name: swap ? "Absent" : "Retard" }).click();
    const rest = page.getByRole("button", { name: /Marquer (les \d+ élèves restants présents|l'élève restant présent)/ });
    if (await rest.isVisible()) await rest.click();
    await save(page, /Enregistrer (l'appel|les modifications)/);
    await expect(page.getByText("Présences enregistrées")).toBeVisible();
  });

  test("the teacher adds an assessment, marks it and submits the marks", async ({ page }) => {
    await signIn(page, USERS.teacher);
    await page.goto(`/assessments/${gradebook.id}?tab=rules`);
    await expect(page.getByRole("heading", { level: 1, name: `${SUBJECT} — ${CLASS}` })).toBeVisible();

    await page.getByRole("button", { name: "Ajouter une catégorie" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.locator("#cat-name").fill(`Dictées ${RUN}`);
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Ajouter une évaluation" }).click();
    dialog = page.getByRole("dialog");
    const assessment = `Dictée E2E ${RUN}`;
    await dialog.locator("#as-name").fill(assessment);
    await dialog.locator("#as-cat").click();
    await page.getByRole("option", { name: `Dictées ${RUN}` }).click();
    await dialog.locator("#as-max").fill("20");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("tab", { name: "Notes" }).click();
    const cells = page.getByRole("textbox", { name: new RegExp(`^${assessment} — `) });
    await expect(cells.first()).toBeVisible();
    const count = await cells.count();
    for (let index = 0; index < count; index += 1) {
      await cells.nth(index).fill(String(8 + (index % 12)));
    }
    await page.getByRole("button", { name: "Enregistrer les notes" }).click();
    await expect(page.getByRole("button", { name: "Enregistrer les notes" })).toBeHidden();

    await page.getByRole("button", { name: "Soumettre pour validation" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Soumettre pour validation" }).click();
    await expect(page.getByRole("button", { name: "Publier" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Soumettre pour validation" })).toBeHidden();
  });

  test("the director publishes the marks and prints the report cards", async ({ page }) => {
    await signIn(page, USERS.director);
    await page.goto(`/assessments/${gradebook.id}`);
    await page.getByRole("button", { name: "Publier" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Publier" }).click();
    await expect(page.getByRole("button", { name: "Rouvrir" })).toBeVisible();

    // One student's report card: the PDF comes from the API and is kept as an issued card.
    await page.goto(`/results?term=${gradebook.term}&class=${gradebook.classId}`);
    const firstStudent = page.getByRole("button", { name: "Bulletin", exact: true }).first();
    const [pdf] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/v1/report-cards/") && r.request().method() === "GET"),
      firstStudent.click(),
    ]);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");

    // The whole class, made in the background, then downloaded.
    await page.getByRole("button", { name: /Imprimer les bulletins/ }).click();
    await page.getByRole("menuitem", { name: /Plusieurs classes/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Préparer les bulletins" }).click();
    await expect(dialog.getByText(/bulletins? prêts?/)).toBeVisible({ timeout: 60_000 });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      dialog.getByRole("button", { name: /Télécharger/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
