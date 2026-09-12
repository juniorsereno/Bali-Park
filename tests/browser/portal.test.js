const { test } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const {
  loginAndOpenOrders,
  readAllOrders,
  readOrderPage,
  collectPortalOrders,
} = require("../../src/services/portalCollector");
function order(voucher, amount = "183,00", status = "Pagamento aprovado") {
  return (
    "<article><div><small>Status</small><p>" +
    status +
    "</p></div><div><small>Valor total</small><p>R$ " +
    amount +
    "</p></div><div><small>Voucher</small><p>" +
    voucher +
    "</p></div><div><small>Vendido em</small><p>12 Set 2026</p></div></article>"
  );
}
test("portal login and cross-domain orders preserve the same browser session; all pages are read", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  const logins = [];
  await context.route("http://*.multiclubes.test/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname === "/login.aspx") {
      const fields = new URLSearchParams(request.postData() || "");
      if (request.method() === "GET") {
        return route.fulfill({
          contentType: "text/html",
          body: '<form method="post"><input id="body_accessKeywordTextBox_textBox" name="identity"><button>Prosseguir</button></form>',
        });
      }
      if (fields.has("identity")) {
        logins.push(fields.get("identity"));
        return route.fulfill({
          contentType: "text/html",
          body: '<form method="post"><input id="body_entrancePasswordTextBox_textBox" name="password" type="password"><button>Entrar</button></form>',
        });
      }
      logins.push(fields.get("password"));
      return route.fulfill({
        status: 302,
        headers: {
          location: "/sale.aspx",
          "set-cookie":
            "portal_session=authenticated; Domain=.multiclubes.test; Path=/; HttpOnly; SameSite=Lax",
        },
      });
    }
    if (url.pathname === "/sale.aspx")
      return route.fulfill({
        contentType: "text/html",
        body: "<h1>Área autenticada</h1>",
      });
    assert.ok(
      request.headers().cookie?.includes("portal_session=authenticated"),
      "orders must receive the login cookie",
    );
    const second = url.searchParams.has("page");
    return route.fulfill({
      contentType: "text/html",
      body:
        "<h1>Minhas vendas</h1>" +
        (second
          ? order("NEW123", "194,00") + "<button disabled>Próxima</button>"
          : order("EXIST1") +
            '<a href="/orders?page=2" rel="next">Próxima</a>'),
    });
  });
  await loginAndOpenOrders(page, {
    login: "test-promoter",
    password: "test-password",
    loginUrl: "http://portal.multiclubes.test/login.aspx",
    ordersUrl: "http://loja.multiclubes.test/orders",
  });
  const rows = await readAllOrders(page);
  assert.equal(context.pages().length, 1);
  assert.deepEqual(logins, ["test-promoter", "test-password"]);
  assert.deepEqual(
    rows.map((row) => row.voucher),
    ["EXIST1", "NEW123"],
  );
  assert.equal(rows[1].amount, "R$ 194,00");
});
test("collector supports load-more, recognizes empty lists and rejects unknown markup", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(
    "<h1>Minhas vendas</h1><main>" +
      order("FIRST123") +
      "</main><button>Carregar mais</button>",
  );
  await page.evaluate(
    (html) =>
      document.querySelector("button").addEventListener("click", (event) => {
        document.querySelector("main").insertAdjacentHTML("beforeend", html);
        event.target.remove();
      }),
    order("SECOND123"),
  );
  assert.deepEqual(
    (await readAllOrders(page)).map((row) => row.voucher),
    ["FIRST123", "SECOND123"],
  );
  await page.setContent(
    "<h1>Minhas vendas</h1><p>Nenhum pedido encontrado</p>",
  );
  assert.deepEqual(await readAllOrders(page), []);
  await page.setContent(
    "<h1>Minhas vendas</h1><p>Unexpected new structure</p>",
  );
  const snapshot = await page.evaluate(readOrderPage);
  assert.equal(snapshot.empty, false);
  await assert.rejects(readAllOrders(page), { code: "PORTAL_LAYOUT" });
});
test("browser closes if authentication fails", async () => {
  let closed = false;
  const chromium = {
    async launch() {
      return {
        async newContext() {
          throw new Error("authentication unavailable");
        },
        async close() {
          closed = true;
        },
      };
    },
  };
  await assert.rejects(
    collectPortalOrders({
      chromium,
      env: {
        MULTICLUBES_PORTAL_LOGIN: "test",
        MULTICLUBES_PORTAL_PASSWORD: "test",
      },
    }),
  );
  assert.equal(closed, true);
});
