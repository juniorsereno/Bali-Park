const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { startApp, config } = require("../helpers");
test("desktop/mobile login, chart, date filters, empty tables and logout", async (t) => {
  const app = await startApp();
  t.after(app.close);
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    locale: "pt-BR",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Content Security Policy|Refused to/i.test(message.text())
    )
      errors.push(message.text());
  });
  fs.mkdirSync("test-results", { recursive: true });
  await page.goto(app.url);
  assert.equal(new URL(page.url()).pathname, "/login");
  await page.screenshot({
    path: "test-results/login-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Código de acesso").fill(config.accessCode);
  await page.getByRole("button", { name: "Entrar no dashboard" }).click();
  await page.waitForURL(app.url + "/");
  await page.waitForFunction(
    () =>
      typeof Chart !== "undefined" && Object.keys(Chart.instances).length === 1,
  );
  const activityTooltip = await page.evaluate(() => {
    const chart = Object.values(Chart.instances).find(
      (instance) => instance.canvas.id === "activityChart",
    );
    return chart.options.plugins.tooltip.callbacks.afterBody([
      { dataIndex: 0 },
    ]);
  });
  assert.deepEqual(activityTooltip, [
    "Faturamento: R$\u00a01.850,00",
    "Taxa de conversão: 6,92%",
  ]);
  await page.getByRole("button", { name: "Vendas por horário" }).click();
  assert.equal(
    await page.locator("#activityChart").getAttribute("aria-label"),
    "Gráfico de vendas por horário",
  );
  assert.equal(
    await page.getByRole("button", { name: "Vendas por horário" }).getAttribute("aria-pressed"),
    "true",
  );
  assert.deepEqual(
    await page.evaluate(() => {
      const chart = Object.values(Chart.instances)[0];
      return {
        datasets: chart.data.datasets.length,
        firstLabel: chart.data.labels[0],
        lastLabel: chart.data.labels.at(-1),
      };
    }),
    { datasets: 1, firstLabel: "00h", lastLabel: "23h" },
  );
  await page.getByRole("button", { name: "Vendas por dia" }).click();
  assert.equal(await page.locator(".metric").count(), 4);
  assert.equal(await page.locator(".mini-metric").count(), 4);
  assert.equal(
    await page.getByRole("img", { name: "Vartana" }).isVisible(),
    true,
  );
  assert.equal(await page.getByText("Período de análise").isVisible(), true);
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.locator('[name="dataInicial"]').fill("2026-09-01");
  await page.locator('[name="dataFinal"]').fill("2026-09-12");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await page.waitForURL(/dataInicial=2026-09-01/);
  assert.equal(new URL(page.url()).searchParams.get("dataFinal"), "2026-09-12");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.equal(await page.locator("#revenueChart").count(), 0);
  assert.equal(await page.locator("#activityChart").isVisible(), true);
  assert.equal(
    await page.getByRole("img", { name: "Vartana" }).isVisible(),
    true,
  );
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.waitForURL(app.url + "/login");
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
  await page.goto(app.url);
  assert.equal(new URL(page.url()).pathname, "/login");
  assert.deepEqual(errors, []);
  const empty = await startApp({
    async getMonthlyPerformance() {
      return [];
    },
    async getLastSales() {
      return [];
    },
  });
  t.after(empty.close);
  await page.goto(empty.url);
  await page.getByLabel("Código de acesso").fill(config.accessCode);
  await page.getByRole("button", { name: "Entrar no dashboard" }).click();
  await page.getByText("Ainda não há vendas para exibir.").waitFor();
  assert.equal(
    await page.getByText("As próximas vendas aparecerão aqui.").isVisible(),
    true,
  );
});
