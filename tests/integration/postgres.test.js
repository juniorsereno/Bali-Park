const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { Pool } = require("pg");
const { runImport } = require("../../src/services/salesImportService");
const approved = (voucher) => ({
  voucher,
  amount: "R$ 183,00",
  status: "Pagamento aprovado",
});
test(
  "real PostgreSQL: migration, idempotency, timestamps, dry run and concurrent imports",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    t.after(() => pool.end());
    assert.equal(
      (await pool.query("SELECT current_database() AS name")).rows[0].name,
      "bali_dashboard_test",
      "requires isolated bali_dashboard_test database",
    );
    await pool.query("CREATE SCHEMA IF NOT EXISTS bali_park");
    await pool.query(
      "CREATE TABLE IF NOT EXISTS bali_park.vendas (id SERIAL PRIMARY KEY, voucher_code VARCHAR(50), valor_total NUMERIC, created_at TIMESTAMP, paid BOOLEAN DEFAULT false, nome TEXT, cpf TEXT, telefone TEXT, email TEXT)",
    );
    await pool.query("TRUNCATE bali_park.vendas RESTART IDENTITY");
    const migration = fs.readFileSync(
      "migrations/001_unique_voucher.sql",
      "utf8",
    );
    const client = await pool.connect();
    try {
      await client.query(migration);
    } finally {
      client.release();
    }
    await pool.query(
      "INSERT INTO bali_park.vendas (voucher_code, valor_total, paid, created_at) VALUES (' exist1 ', 50, false, '2026-01-01')",
    );
    const now = () => new Date("2026-10-01T01:30:00Z");
    let result = await runImport({
      db: pool,
      collect: async () => [approved("EXIST1"), approved("NEW123")],
      now,
      dryRun: true,
    });
    assert.equal(result.new, 1);
    assert.equal(
      (await pool.query("SELECT count(*) FROM bali_park.vendas")).rows[0].count,
      "1",
    );
    result = await runImport({
      db: pool,
      collect: async () => [approved("EXIST1"), approved("NEW123")],
      now,
    });
    assert.equal(result.inserted, 1);
    const saved = (
      await pool.query(
        "SELECT voucher_code, valor_total, paid, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS timestamp, nome FROM bali_park.vendas ORDER BY id",
      )
    ).rows;
    assert.equal(saved[0].paid, false);
    assert.equal(saved[0].valor_total, "50");
    assert.deepEqual(saved[1], {
      voucher_code: "NEW123",
      valor_total: "183.00",
      paid: true,
      timestamp: "2026-09-30 22:30:00",
      nome: null,
    });
    result = await runImport({
      db: pool,
      collect: async () => [approved("exist1"), approved("new123")],
      now,
    });
    assert.equal(result.inserted, 0);
    assert.equal(result.existing, 2);
    await assert.rejects(
      pool.query(
        "INSERT INTO bali_park.vendas (voucher_code) VALUES (' new123 ')",
      ),
      { code: "23505" },
    );
    let releaseCollection, collectionStarted;
    const started = new Promise((resolve) => {
      collectionStarted = resolve;
    });
    const paused = new Promise((resolve) => {
      releaseCollection = resolve;
    });
    const first = runImport({
      db: pool,
      now,
      collect: async () => {
        collectionStarted();
        await paused;
        return [approved("RACE123")];
      },
    });
    await started;
    const second = await runImport({
      db: pool,
      now,
      collect: async () => [approved("RACE123")],
    });
    assert.equal(second.skipped, "already_running");
    releaseCollection();
    assert.equal((await first).inserted, 1);
    const third = await runImport({
      db: pool,
      now,
      collect: async () => [approved("RACE123")],
    });
    assert.equal(third.existing, 1);
    // Simulate an external writer inserting after our existence check.
    const racingDb = {
      async connect() {
        const connection = await pool.connect();
        return {
          release: (...args) => connection.release(...args),
          async query(sql, args) {
            const result = await connection.query(sql, args);
            if (sql.startsWith("SELECT UPPER"))
              await pool.query(
                "INSERT INTO bali_park.vendas (voucher_code, paid) VALUES ('EXT123', false)",
              );
            return result;
          },
        };
      },
    };
    const race = await runImport({
      db: racingDb,
      now,
      collect: async () => [approved("EXT123")],
    });
    assert.equal(race.inserted, 0);
    assert.equal(race.existing, 1);
    await pool.query(
      "CREATE TABLE IF NOT EXISTS bali_park.users (id SERIAL PRIMARY KEY, source TEXT, message_count INTEGER, criado_as TIMESTAMP)",
    );
    await pool.query("TRUNCATE bali_park.users");
    await pool.query(
      "INSERT INTO bali_park.users (source, message_count, criado_as) VALUES ('central_vendas',1,'2026-09-30'),('central_vendas',2,'2026-09-30'),('central_vendas',3,'2026-09-30'),('central',4,'2026-09-30'),('transbordo_central_vendas',2,'2026-09-30'),('transbordo_central_vendas',3,'2026-09-30')",
    );
    const dashboard =
      require("../../src/services/dashboardService").createDashboardService(
        pool,
      );
    const kpi = await dashboard.getKPIs("2026-09-30", "2026-09-30");
    assert.equal(kpi.vendas, "2");
    assert.equal(kpi.atendimentoTotal, "5");
    assert.equal(kpi.atendimentoResp, "3");
    assert.equal(kpi.taxaResposta, "60,0%");
    assert.equal(kpi.convGeral, "40,00%");
    assert.equal(kpi.convReal, "66,67%");
    const chart = await dashboard.getDailyEvolution("2026-09-30", "2026-09-30");
    assert.deepEqual(chart, {
      labels: ["30/09"],
      users: [5],
      activeUsers: [3],
      sales: [2],
      revenue: [366],
    });
    assert.equal((await dashboard.getMonthlyPerformance())[0].mes, "Set/26");
    assert.equal((await dashboard.getLastSales())[0].hora_compra, "22:30");
    // Prove the migration refuses duplicates without deleting any sale.
    await pool.query("DROP INDEX bali_park.idx_vendas_voucher_unique");
    await pool.query(
      "INSERT INTO bali_park.vendas (voucher_code) VALUES ('new123')",
    );
    const guard = await pool.connect();
    try {
      await assert.rejects(guard.query(migration), { code: "P0001" });
      await guard.query("ROLLBACK");
    } finally {
      guard.release();
    }
    assert.equal(
      (
        await pool.query(
          "SELECT count(*) FROM bali_park.vendas WHERE upper(trim(voucher_code))='NEW123'",
        )
      ).rows[0].count,
      "2",
    );
  },
);
