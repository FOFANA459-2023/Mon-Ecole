# Mon École — Web app

One school. One platform. One source of truth.

Mon École manages enrolment, students, classes, teachers, finance, cash register, attendance, assessments and report cards for schools in Guinea, Liberia and beyond — designed from day one to serve many schools (multi-tenant SaaS).

This repository is the **React single-page app**. It talks to the API in **[Mon-Ecole-Backend](https://github.com/FOFANA459-2023/Mon-Ecole-Backend)**, which also holds the build plan and the role × permission matrix (`docs/`).

## Stack

React 19 + TypeScript, Vite, Tailwind CSS 4, shadcn/ui (Radix), TanStack Query, React Hook Form + Zod, react-i18next (French/English). Hosted on **Cloudflare Pages**; a Docker image (nginx) is also published for Docker-based hosting and demos.

## Repository layout

```
src/app/            router, layout (sidebar, top bar), guards, navigation
src/features/       one folder per module (auth, dashboard, students, enrollments, classes, staff, settings, …)
src/components/     shared components; components/ui = shadcn/ui
src/lib/            API client, auth, i18n, formatting, theme; lib/api/schema.d.ts is generated from the API schema
src/locales/        fr.json, en.json
public/             static files; _headers and _redirects for Cloudflare Pages
scripts/gen-api.mjs regenerates the API types from Mon-Ecole-Backend/openapi.yaml
Dockerfile, nginx/  production image: the built app served by nginx, /api forwarded to the backend
docker-compose.yml  dev server (hot reload) or the production image, against the API on port 8000
.github/            CI, CD and Cloudflare Pages workflows, Dependabot
```

## Run it locally

Start the API first (see Mon-Ecole-Backend: `docker compose up`, or `manage.py runserver`). It must listen on http://localhost:8000.

### Option A — Node on your machine

```bash
npm install
npm run dev
```

### Option B — Docker

```bash
docker compose up                              # Vite dev server with hot reload
docker compose --profile prod up --build web   # production build served by nginx on http://localhost:8080
```

Open http://localhost:5173 (or :8080 for the nginx image). The nginx image sends the API its own upstream host name, so that name (e.g. `host.docker.internal`) must be in the API's `DJANGO_ALLOWED_HOSTS`. Requests to `/api` are forwarded to the API, so the browser sees one origin and the refresh-token cookie works. To use an API elsewhere, set `API_URL` (Docker) or `VITE_PROXY_TARGET` (`npm run dev`) in your shell.

Demo accounts come from the backend's `seed_demo` command (all `@monecole.test`: `admin`, `directeur`, `secretariat`, `comptable`, `enseignant`, `teacher`).

## Branches and pull requests

`main` is protected: nothing reaches it without a pull request whose checks all pass. Work on `develop` (or a
feature branch from it), push, and open a pull request into `main`. Merging to `main` publishes staging; a `v*`
tag publishes production.

```bash
git switch develop && git pull
# …commit…
git push
gh pr create --base main --fill
```

Optional but recommended: `pip install pre-commit && pre-commit install` runs lint, types and a secret scan
before each commit.

## Tests and quality gates

| Suite | What it covers | Run locally |
|---|---|---|
| Unit + component | hooks, helpers, guards, menus and pages rendered with a fake API (Vitest, Testing Library, MSW); coverage floor | `npm test` / `npm run test:coverage` |
| End to end | the real app against the real API: sign-in and session restore, deep links, role permissions, student search, the full enrolment wizard, global search, a phone-sized run (Playwright) | `E2E_PASSWORD=… npm run test:e2e` |
| Accessibility | axe (WCAG 2.1 AA) on the login page, dashboard, students, classes and the enrolment wizard; serious issues fail | part of `npm run test:e2e` |
| Lint and types | ESLint (no warnings allowed), TypeScript (app, config and E2E code) | `npx eslint . && npm run typecheck` |
| API contract | `schema.d.ts` must match the backend's `openapi.yaml` | `npm run gen:api` then `git diff` |
| SAST | semgrep (JavaScript, TypeScript, React, secrets, Dockerfile, nginx rules) | CI |
| Dependencies | npm audit (high/critical in shipped code blocks the merge); Dependabot weekly | `npm run audit:prod` |
| Secrets | gitleaks over the whole git history | pre-commit |
| Docker | hadolint, smoke test, non-root user, trivy image + configuration scans | CI |
| DAST | OWASP ZAP baseline scan of the served app: security headers, CSP, server leaks | CI |

**Running the E2E tests locally:** start the API with demo data (in Mon-Ecole-Backend:
`docker compose up -d`, `docker compose exec backend python manage.py migrate`, then
`docker compose exec backend python manage.py seed_demo --password <choose one>`; set `THROTTLE_LOGIN=1000/min`
before `docker compose up` because the tests sign in many times a minute), install the browser once with
`npx playwright install chromium`, then run `E2E_PASSWORD=<same password> npm run test:e2e`. The Vite dev server
starts automatically.

### API types

`src/lib/api/schema.d.ts` is generated from the backend's `openapi.yaml`. After the API changes:

```bash
npm run gen:api
```

This reads `../Mon-Ecole-Backend/openapi.yaml` (or `../backend/openapi.yaml`) when the backend is checked out next to this repository; otherwise set `OPENAPI_SCHEMA` to a path or URL, e.g. `OPENAPI_SCHEMA=http://localhost:8000/api/schema/ npm run gen:api` against a local API with docs enabled.

## Conventions

- **Server state only through TanStack Query** hooks in each feature's `api.ts`; query keys start with the resource and the current school id.
- **Permissions:** menus, routes and buttons use `<Can>` / `RequirePermission` with the permission codes from `/me`. This is UX only — the API enforces every rule.
- **Auth:** the access token lives in memory only; the refresh token is an `HttpOnly` cookie handled by the API. The school's idle timeout signs the user out.
- **Forms:** React Hook Form + Zod; API field errors are mapped back onto the form with `applyApiErrors`.
- **Text:** every string goes through `t()`, with keys in both `fr.json` and `en.json` (a test checks they match).

## CI/CD

| Workflow | When | What |
|---|---|---|
| `ci.yml` | every pull request | the quality and security gates above — all required before merging to `main` (API types and E2E need `BACKEND_REPO_TOKEN`); optional Cloudflare Pages preview of the PR |
| `cd.yml` | push to `main`, tags `v*` | runs CI, publishes the nginx image (`linux/amd64` + `linux/arm64`) to `ghcr.io/fofana459-2023/mon-ecole-frontend` with an SBOM and provenance, signed with Sigstore/cosign, then deploys `main` to the Pages **staging** branch and `v*` tags to **production** |
| `pages.yml` | called by CI and CD | builds with the environment's `VITE_API_URL` and uploads `dist/` with Wrangler |

### Turning on deployment

1. In Cloudflare, create a Pages project of type **Direct Upload** (production branch `main`) and an API token with **Cloudflare Pages: Edit**.
2. In this repository, **Settings → Secrets and variables → Actions**:
   - secrets: `CLOUDFLARE_API_TOKEN`; `BACKEND_REPO_TOKEN` (a fine-grained token with read-only *Contents* access to Mon-Ecole-Backend, for the API types check);
   - variables: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT`, and `DEPLOY_STAGING=true` / `DEPLOY_PRODUCTION=true` / `DEPLOY_PREVIEWS=true` to switch each stage on.
3. **Settings → Environments**: create `preview`, `staging` and `production`, each with a `VITE_API_URL` variable (the matching API, e.g. `https://api.example.org/api/v1`). Add required reviewers to `production`.
4. Release to production by pushing a tag: `git tag v1.0.0 && git push origin v1.0.0`.

Each deployed origin must be listed in the backend's `CORS_ALLOWED_ORIGINS`. The refresh cookie is `SameSite=Lax`, so the app and the API must share a site (e.g. `app.example.org` and `api.example.org`): give staging and production custom domains in Cloudflare. On `*.pages.dev` preview URLs the API sees a foreign origin, so previews only work against an API that lists that origin, and sessions are not restored on reload.
