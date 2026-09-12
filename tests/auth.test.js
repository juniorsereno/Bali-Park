const { test } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, config } = require("./helpers");
const cookieJar = (response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
async function login(url, code = config.accessCode) {
  return fetch(url + "/login", {
    method: "POST",
    body: new URLSearchParams({ code }),
    redirect: "manual",
  });
}
test("access code protects data, renders safely and logout clears the session", async (t) => {
  let queries = 0;
  const app = await startApp({
    async getLastSales() {
      queries++;
      return [
        {
          id: 1,
          voucher_code: "<script>window.bad=true</script>",
          data_compra: "12/09/2026",
          hora_compra: "12:00",
          valor_total: 20,
        },
      ];
    },
  });
  t.after(app.close);
  let response = await fetch(app.url + "/", { redirect: "manual" });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/login");
  assert.equal(queries, 0);
  response = await login(app.url, "wrong");
  assert.equal(response.status, 401);
  assert.equal(response.headers.getSetCookie().length, 0);
  assert.equal((await response.text()).includes(config.accessCode), false);
  response = await login(app.url);
  assert.equal(response.status, 303);
  assert.match(response.headers.getSetCookie()[0], /httponly/i);
  assert.match(response.headers.getSetCookie()[0], /samesite=lax/i);
  const cookie = cookieJar(response);
  response = await fetch(app.url + "/", { headers: { cookie } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const html = await response.text();
  assert.ok(html.includes("&lt;script&gt;window.bad=true&lt;/script&gt;"));
  assert.ok(!html.includes(config.accessCode));
  assert.equal(queries, 1);
  response = await fetch(app.url + "/?dataInicial=2026-02-30", {
    headers: { cookie },
  });
  assert.equal(response.status, 400);
  assert.equal(queries, 1);
  response = await fetch(app.url + "/", {
    headers: {
      cookie: cookie.replace("bali_session=", "bali_session=corrupted"),
    },
    redirect: "manual",
  });
  assert.equal(response.status, 302);
  response = await fetch(app.url + "/logout", {
    method: "POST",
    headers: { cookie },
    redirect: "manual",
  });
  assert.equal(response.status, 303);
  assert.match(response.headers.getSetCookie()[0], /expires=Thu, 01 Jan 1970/i);
  response = await fetch(app.url + "/assets/dashboard.js");
  assert.equal(response.status, 200);
  response = await fetch(app.url + "/assets/chart.umd.js");
  assert.equal(response.status, 200);
});
test("server checks session expiry, not just browser cookie lifetime", async (t) => {
  const app = await startApp();
  t.after(app.close);
  const response = await login(app.url);
  const cookie = cookieJar(response);
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  t.mock.timers.tick(8 * 86400000);
  assert.equal(
    (await fetch(app.url + "/", { headers: { cookie }, redirect: "manual" }))
      .status,
    302,
  );
});
test("failed logins are rate limited and cross-origin forms are rejected", async (t) => {
  const app = await startApp();
  t.after(app.close);
  for (let i = 0; i < 10; i++)
    assert.equal((await login(app.url, "wrong")).status, 401);
  assert.equal((await login(app.url, "wrong")).status, 429);
  const response = await fetch(app.url + "/logout", {
    method: "POST",
    headers: { origin: "https://another-site.example" },
  });
  assert.equal(response.status, 403);
});
test("database outages are an unavailable state, not fabricated metrics", async (t) => {
  const app = await startApp({
    async getKPIs() {
      throw Object.assign(new Error("unavailable"), { code: "TEST_DB_DOWN" });
    },
  });
  t.after(app.close);
  const cookie = cookieJar(await login(app.url));
  const response = await fetch(app.url + "/", { headers: { cookie } });
  assert.equal(response.status, 503);
  assert.match(await response.text(), /temporariamente indisponíveis/);
});
