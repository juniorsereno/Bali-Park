const { createApp } = require("../src/app");
const config = {
  accessCode: "test-access-code",
  sessionSecret: "test-secret-only-".repeat(4),
  cookieSecure: false,
  trustProxy: false,
};
const kpi = {
  faturamento: "R$ 48.735,00",
  vendas: "238",
  ticket: "R$ 204,77",
  taxaResposta: "64.2%",
  atendimentoResp: "1542",
  atendimentoTotal: "2402",
  leadsCentralVendas: "2402",
  leadsRemarketing: "846",
  convGeral: "9.91%",
  convReal: "15.43%",
};
const charts = {
  labels: ["01/09", "02/09", "03/09", "04/09", "05/09", "06/09", "07/09"],
  users: [130, 150, 90, 180, 210, 165, 220],
  activeUsers: [90, 110, 58, 120, 150, 110, 169],
  sales: [9, 12, 6, 14, 18, 13, 20],
  revenue: [1850, 2460, 1230, 2870, 3690, 2665, 4100],
};
const hourlySales = {
  labels: Array.from({ length: 24 }, (_, hour) =>
    String(hour).padStart(2, "0") + "h",
  ),
  sales: Array.from({ length: 24 }, (_, hour) =>
    hour >= 8 && hour <= 18 ? hour - 6 : 0,
  ),
  revenue: Array.from({ length: 24 }, (_, hour) =>
    hour >= 8 && hour <= 18 ? (hour - 6) * 190 : 0,
  ),
};
const service = {
  async getKPIs() {
    return kpi;
  },
  async getDailyEvolution() {
    return charts;
  },
  async getHourlySales() {
    return hourlySales;
  },
  async getMonthlyPerformance() {
    return ["Set/26", "Ago/26", "Jul/26", "Jun/26", "Mai/26", "Abr/26"].map(
      (mes, i) => ({ mes, qtd: 238 + i * 31, total: 48735 + i * 4100 }),
    );
  },
  async getLastSales() {
    return Array.from({ length: 10 }, (_, i) => ({
      id: i + 100,
      voucher_code: "TEST" + (99310 - i),
      data_compra: "12/09/2026",
      hora_compra: "10:30",
      valor_total: 183 + 11 * i,
    }));
  },
};
async function startApp(overrides = {}) {
  const app = createApp({
    config,
    dashboardService: { ...service, ...overrides },
  });
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", (error) =>
      error ? reject(error) : resolve(instance),
    );
  });
  return {
    server,
    url: "http://127.0.0.1:" + server.address().port,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
module.exports = { config, service, kpi, charts, hourlySales, startApp };
