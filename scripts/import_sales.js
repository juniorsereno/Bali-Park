require("dotenv").config({ quiet: true });
const db = require("../src/database");
const { collectPortalOrders } = require("../src/services/portalCollector");
const { runImport } = require("../src/services/salesImportService");
async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--dry-run"))
    throw new Error("Uso: npm run sync:sales -- [--dry-run]");
  const dryRun = args.includes("--dry-run");
  if (!dryRun && process.env.MULTICLUBES_IMPORT_ENABLED !== "true")
    throw Object.assign(
      new Error(
        "Valide o dry-run e habilite MULTICLUBES_IMPORT_ENABLED para gravar.",
      ),
      { code: "IMPORT_DISABLED" },
    );
  const summary = await runImport({ db, collect: collectPortalOrders, dryRun });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.invalid) process.exitCode = 2;
}
main()
  .catch((error) => {
    console.error("Importação não concluída:", error.code || error.name);
    process.exitCode = 1;
  })
  .finally(() => db.end());
