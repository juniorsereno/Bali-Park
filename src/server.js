require("dotenv").config({ quiet: true });
const { getConfig } = require("./config");
const { createApp } = require("./app");
const dashboardService = require("./services/dashboardService");
const { startPaymentScheduler } = require("./jobs/paymentScheduler");
const db = require("./database");

const app = createApp({ dashboardService, config: getConfig() });
const server = app.listen(process.env.PORT || 3000, (error) => {
  if (error) {
    console.error("Não foi possível iniciar o dashboard:", error.code);
    process.exit(1);
  }
  console.log("Dashboard Bali Park iniciado.");
});
const scheduler = startPaymentScheduler();
function shutdown() {
  scheduler?.stop();
  server.close(async () => {
    await db.end();
    process.exit(0);
  });
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
