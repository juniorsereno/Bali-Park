const LOGIN_URL =
  "https://portal.multiclubes.com.br/balipark/login.aspx?ReturnUrl=%2fbalipark%2fsale.aspx";
const ORDERS_URL =
  "https://loja.multiclubes.com.br/balipark/conta/pedidos/ultimas";
const SECURITY_MESSAGE =
  /não foi possível validar sua solicitação de segurança|verifique que você é humano|verify you are human/i;
class PortalError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PortalError";
    this.code = code;
  }
}

// Runs inside the page. Labels are used rather than unverified vendor CSS classes.
function readOrderPage() {
  const clean = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  const visible = (element) =>
    !!(
      element.getClientRects().length &&
      getComputedStyle(element).visibility !== "hidden"
    );
  const bodyText = clean(document.body.innerText);
  const rows = [];
  const containers = new Set();
  const labels = [...document.querySelectorAll("body *")].filter(
    (element) =>
      visible(element) &&
      clean(element.textContent) === "Voucher" &&
      ![...element.children].some(
        (child) => clean(child.textContent) === "Voucher",
      ),
  );
  for (const label of labels) {
    let container = label.parentElement;
    while (container && container !== document.body) {
      const text = clean(container.innerText);
      if (
        /Status/i.test(text) &&
        /Valor total/i.test(text) &&
        /Vendido em/i.test(text)
      ) {
        if (labels.filter((other) => container.contains(other)).length === 1)
          containers.add(container);
        break;
      }
      container = container.parentElement;
    }
  }
  for (const container of containers) {
    const text = clean(container.innerText);
    rows.push({
      voucher: text.match(/Voucher\s*:?\s*([A-Za-z0-9-]+)/i)?.[1],
      amount: text.match(/Valor total\s*:?\s*(R\$\s*[\d.,]+)/i)?.[1],
      status: text.match(/Status\s*:?\s*(.*?)\s*Valor total/i)?.[1],
    });
  }
  if (!rows.length) {
    for (const table of document.querySelectorAll("table")) {
      const headers = [...table.querySelectorAll("thead th")].map((cell) =>
        clean(cell.textContent).toLowerCase(),
      );
      const voucherIndex = headers.indexOf("voucher"),
        amountIndex = headers.indexOf("valor total"),
        statusIndex = headers.indexOf("status");
      if ([voucherIndex, amountIndex, statusIndex].some((index) => index < 0))
        continue;
      for (const row of table.querySelectorAll("tbody tr")) {
        if (!visible(row)) continue;
        const cells = [...row.querySelectorAll("td")].map((cell) =>
          clean(cell.innerText),
        );
        if (cells.length < headers.length) continue;
        rows.push({
          voucher: cells[voucherIndex],
          amount: cells[amountIndex],
          status: cells[statusIndex],
        });
      }
    }
  }
  return {
    rows,
    recognized: /Minhas vendas/i.test(bodyText),
    empty:
      /nenhum(?:a)? (?:pedido|venda)|não (?:há|existem|possui) (?:pedidos|vendas)|você ainda não (?:possui|realizou) (?:pedidos|compras|vendas)/i.test(
        bodyText,
      ),
  };
}

async function loginAndOpenOrders(
  page,
  { login, password, loginUrl = LOGIN_URL, ordersUrl = ORDERS_URL },
) {
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#body_accessKeywordTextBox_textBox").fill(login);
  await page.getByRole("button", { name: "Prosseguir", exact: true }).click();
  const passwordField = page.locator("#body_entrancePasswordTextBox_textBox");
  try {
    await passwordField.waitFor({ state: "visible", timeout: 45000 });
  } catch {
    const failed = SECURITY_MESSAGE.test(
      await page.locator("body").innerText(),
    );
    throw new PortalError(
      failed ? "PORTAL_SECURITY" : "PORTAL_LOGIN",
      failed
        ? "O portal não concluiu a validação de segurança."
        : "O portal não apresentou o campo de senha.",
    );
  }
  await passwordField.fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  try {
    await page.waitForURL((url) => !/\/login\.aspx/i.test(url.pathname), {
      timeout: 45000,
    });
  } catch {
    throw new PortalError(
      "PORTAL_LOGIN",
      "Não foi possível confirmar o login no portal.",
    );
  }
  // Keep the same Page AND BrowserContext when changing domains.
  await page.goto(ordersUrl, { waitUntil: "domcontentloaded" });
  try {
    await page
      .getByText(/Minhas\s+vendas/i)
      .first()
      .waitFor({ state: "visible", timeout: 30000 });
  } catch {
    throw new PortalError(
      "PORTAL_SESSION",
      "A sessão autenticada não abriu a lista de vendas.",
    );
  }
}

async function readAllOrders(page) {
  const found = new Map(),
    visited = new Set();
  for (let index = 0; index < 200; index++) {
    const snapshot = await page.evaluate(readOrderPage);
    if (!snapshot.recognized || (!snapshot.rows.length && !snapshot.empty))
      throw new PortalError(
        "PORTAL_LAYOUT",
        "A lista de pedidos não pôde ser reconhecida.",
      );
    const signature = JSON.stringify(snapshot.rows);
    if (visited.has(signature))
      throw new PortalError(
        "PORTAL_PAGINATION",
        "A paginação repetiu a mesma lista.",
      );
    visited.add(signature);
    for (const row of snapshot.rows) found.set(JSON.stringify(row), row);
    const nextName =
      /^(carregar mais(?: pedidos)?|mostrar mais(?: pedidos)?|ver mais(?: pedidos)?|próxim[ao](?: página)?|next|›|»)\s*$/i;
    const next = page
      .getByRole("button", { name: nextName })
      .or(page.getByRole("link", { name: nextName }))
      .or(page.locator('a[rel="next"]'));
    let nextControl = null;
    for (let i = 0; i < (await next.count()); i++) {
      const candidate = next.nth(i);
      const disabled = await candidate.evaluate(
        (element) =>
          element.closest('[aria-disabled="true"], .disabled, [disabled]') !==
          null,
      );
      if (
        (await candidate.isVisible()) &&
        (await candidate.isEnabled()) &&
        !disabled
      ) {
        nextControl = candidate;
        break;
      }
    }
    if (!nextControl) return [...found.values()];
    await nextControl.click();
    let changed = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const updated = await page.evaluate(readOrderPage);
      if (updated.rows.length && JSON.stringify(updated.rows) !== signature) {
        changed = true;
        break;
      }
      await page.waitForTimeout(500);
    }
    if (!changed)
      throw new PortalError(
        "PORTAL_PAGINATION",
        "A próxima página não carregou.",
      );
  }
  throw new PortalError(
    "PORTAL_PAGINATION",
    "Limite de paginação excedido; a coleta foi interrompida.",
  );
}

async function collectPortalOrders({ env = process.env, chromium } = {}) {
  const login = env.MULTICLUBES_PORTAL_LOGIN,
    password = env.MULTICLUBES_PORTAL_PASSWORD;
  if (!login || !password)
    throw new PortalError(
      "PORTAL_CONFIG",
      "Configure as credenciais do portal no ambiente.",
    );
  chromium ||= require("playwright").chromium;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    await loginAndOpenOrders(page, { login, password });
    return await readAllOrders(page);
  } finally {
    await browser.close();
  }
}
module.exports = {
  collectPortalOrders,
  loginAndOpenOrders,
  readAllOrders,
  readOrderPage,
  PortalError,
};
