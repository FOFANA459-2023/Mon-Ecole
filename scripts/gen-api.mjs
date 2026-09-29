// Regenerate src/lib/api/schema.d.ts from the backend's OpenAPI schema (Mon-Ecole-Backend/openapi.yaml).
// Uses OPENAPI_SCHEMA (a file path or URL) when set, otherwise a backend checkout next to this repository.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const OUTPUT = "src/lib/api/schema.d.ts";
const SIBLINGS = ["../Mon-Ecole-Backend/openapi.yaml", "../backend/openapi.yaml"];

const source = process.env.OPENAPI_SCHEMA || SIBLINGS.find((path) => existsSync(path));
if (!source) {
  console.error(
    `No OpenAPI schema found. Clone Mon-Ecole-Backend next to this repository (${SIBLINGS.join(" or ")}),\n` +
      "or point OPENAPI_SCHEMA at the file or URL, e.g. OPENAPI_SCHEMA=http://localhost:8000/api/schema/",
  );
  process.exit(1);
}

console.log(`Generating ${OUTPUT} from ${source}`);
const cli = "node_modules/openapi-typescript/bin/cli.js";
const result = spawnSync(process.execPath, [cli, source, "-o", OUTPUT], { stdio: "inherit" });
process.exit(result.status ?? 1);
