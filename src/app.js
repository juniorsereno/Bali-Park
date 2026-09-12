const express = require("express");
const path = require("path");
const crypto = require("node:crypto");
const cookieSession = require("cookie-session");
const { rateLimit } = require("express-rate-limit");
const { dateRange } = require("./lib/dates");
const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;

function createApp({ dashboardService, config }) {
  const app = express();
  const authTag = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(config.accessCode)
    .digest("hex");
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "../views"));
  app.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
    });
    next();
  });
  app.use("/assets", express.static(path.join(__dirname, "../public")));
  app.get("/assets/chart.umd.js", (req, res) =>
    res.sendFile(
      path.join(__dirname, "../node_modules/chart.js/dist/chart.umd.js"),
    ),
  );
  app.use(express.urlencoded({ extended: false, limit: "2kb" }));
  app.use(
    cookieSession({
      name: "bali_session",
      keys: [config.sessionSecret],
      maxAge: SESSION_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: config.cookieSecure,
    }),
  );
  const authenticated = (req) =>
    req.session?.authTag === authTag && req.session.expiresAt > Date.now();
  app.use((req, res, next) => {
    if (
      req.method === "POST" &&
      req.get("origin") &&
      req.get("origin") !== `${req.protocol}://${req.get("host")}`
    ) {
      return res
        .status(403)
        .render("error", {
          title: "Solicitação não permitida",
          message: "Abra esta página novamente para continuar.",
        });
    }
    next();
  });
  app.get("/login", (req, res) =>
    authenticated(req)
      ? res.redirect("/")
      : res.render("login", { error: null }),
  );
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (req, res) =>
      res
        .status(429)
        .render("login", {
          error: "Muitas tentativas. Aguarde 15 minutos e tente novamente.",
        }),
  });
  app.post("/login", loginLimit, (req, res) => {
    const supplied = typeof req.body.code === "string" ? req.body.code : "";
    const digest = (value) =>
      crypto.createHash("sha256").update(value).digest();
    if (!crypto.timingSafeEqual(digest(supplied), digest(config.accessCode))) {
      return res
        .status(401)
        .render("login", {
          error: "Código de acesso incorreto. Tente novamente.",
        });
    }
    req.session = { authTag, expiresAt: Date.now() + SESSION_AGE };
    res.redirect(303, "/");
  });
  app.post("/logout", (req, res) => {
    req.session = null;
    res.redirect(303, "/login");
  });
  app.use((req, res, next) =>
    authenticated(req) ? next() : res.redirect("/login"),
  );
  app.get("/", async (req, res) => {
    let range;
    try {
      range = dateRange(req.query);
    } catch (error) {
      return res
        .status(400)
        .render("error", {
          title: "Confira o período",
          message: error.message,
        });
    }
    try {
      const [kpi, charts, hourlySales, mensal, ultimas] = await Promise.all([
        dashboardService.getKPIs(range.dataInicial, range.dataFinal),
        dashboardService.getDailyEvolution(range.dataInicial, range.dataFinal),
        dashboardService.getHourlySales(range.dataInicial, range.dataFinal),
        dashboardService.getMonthlyPerformance(),
        dashboardService.getLastSales(),
      ]);
      res.render("dashboard", {
        kpi,
        charts,
        tables: { mensal, ultimas },
        ...range,
        money: (value) =>
          new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(Number(value || 0)),
        number: (value) =>
          new Intl.NumberFormat("pt-BR").format(Number(value || 0)),
        chartJson: JSON.stringify({ ...charts, hourly: hourlySales }).replace(
          /</g,
          "\\u003c",
        ),
      });
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error.code || error.name);
      res
        .status(503)
        .render("error", {
          title: "Os dados estão temporariamente indisponíveis",
          message:
            "Não foi possível atualizar o painel. Tente novamente em alguns instantes.",
        });
    }
  });
  app.use((req, res) =>
    res
      .status(404)
      .render("error", {
        title: "Página não encontrada",
        message: "Volte ao painel para continuar.",
      }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res
      .status(error.status === 413 ? 413 : 400)
      .render("error", {
        title: "Não foi possível processar a solicitação",
        message: "Atualize a página e tente novamente.",
      });
  });
  return app;
}
module.exports = { createApp };
