require("dotenv").config({ quiet: true });
const cron = require("node-cron");
const db = require("../database");
const { collectPortalOrders } = require("../services/portalCollector");
const { runImport } = require("../services/salesImportService");
const { TIME_ZONE } = require("../lib/dates");
if (process.env.MULTICLUBES_IMPORT_ENABLED !== "true") {
  console.log(
    "Importação desativada. Valide o dry-run e a migração antes de habilitar.",
  );
} else {
  if (
    !process.env.MULTICLUBES_PORTAL_LOGIN ||
    !process.env.MULTICLUBES_PORTAL_PASSWORD
  )
    throw new Error("Configure as credenciais do portal.");
  const expression = process.env.MULTICLUBES_IMPORT_CRON || "10 */2 * * *";
  if (!cron.validate(expression))
    throw new Error("MULTICLUBES_IMPORT_CRON inválido.");
  const job = cron.schedule(
    expression,
    async () => {
      try {
        const summary = await runImport({ db, collect: collectPortalOrders });
        console.log(
          JSON.stringify({
            job: "sales-import",
            at: new Date().toISOString(),
            ...summary,
          }),
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            job: "sales-import",
            at: new Date().toISOString(),
            error: error.code || error.name,
          }),
        );
      }
    },
    { timezone: TIME_ZONE, noOverlap: true },
  );
  console.log("Importação agendada:", expression, TIME_ZONE);
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => {
      await job.stop();
      await db.end();
      process.exit(0);
    });
  }
}
