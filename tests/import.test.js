const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runImport } = require("../src/services/salesImportService");
const approved = (voucher, amount = "R$ 183,00") => ({
  voucher,
  amount,
  status: "Pagamento aprovado",
});
function fakeDatabase({ locked = true, known = [], ready = true } = {}) {
  const statements = [],
    inserted = [];
  const client = {
    release() {
      statements.push("release");
    },
    async query(sql, values) {
      statements.push(sql);
      if (sql.includes("pg_try_advisory_lock")) return { rows: [{ locked }] };
      if (sql.includes("pg_advisory_unlock")) return { rows: [] };
      if (sql.includes("FROM pg_index")) return { rows: [{ ready }] };
      if (sql.startsWith("SELECT UPPER"))
        return { rows: known.map((voucher) => ({ voucher })) };
      if (sql.startsWith("INSERT")) {
        inserted.push(values);
        return { rowCount: 1 };
      }
      return { rows: [] };
    },
  };
  return { connect: async () => client, statements, inserted };
}
test("dry run classifies approved, existing, repeated, pending and invalid without INSERTs", async () => {
  const db = fakeDatabase({ known: ["EXIST1"] });
  const result = await runImport({
    db,
    dryRun: true,
    collect: async () => [
      approved("exist1"),
      approved("NEW123"),
      approved(" new123 "),
      approved("BAD123", "oops"),
      { status: "Pagamento pendente" },
    ],
  });
  assert.equal(result.existing, 1);
  assert.equal(result.new, 1);
  assert.equal(result.repeated, 1);
  assert.equal(result.invalid, 1);
  assert.equal(result.ignored, 1);
  assert.equal(db.inserted.length, 0);
  assert.ok(db.statements.includes("BEGIN READ ONLY"));
  assert.equal(db.statements.at(-1), "release");
});
test("new imports use collection time and only required columns; existing vouchers are untouched", async () => {
  const db = fakeDatabase({ known: ["EXIST1"] });
  const result = await runImport({
    db,
    collect: async () => [approved("EXIST1"), approved("NEW123")],
    now: () => new Date("2026-10-01T01:30:00Z"),
  });
  assert.equal(result.inserted, 1);
  assert.deepEqual(db.inserted, [["NEW123", "183.00", "2026-09-30 22:30:00"]]);
  assert.equal(
    db.statements.some((sql) => sql.startsWith("UPDATE")),
    false,
  );
});
test("concurrent jobs and missing migration never start collection", async () => {
  let collected = false;
  const collect = async () => {
    collected = true;
    return [];
  };
  assert.equal(
    (await runImport({ db: fakeDatabase({ locked: false }), collect })).skipped,
    "already_running",
  );
  await assert.rejects(
    runImport({ db: fakeDatabase({ ready: false }), collect }),
    { code: "IMPORT_MIGRATION_REQUIRED" },
  );
  assert.equal(collected, false);
});
test("portal failures and conflicting voucher amounts never write and always release the lock", async () => {
  const db = fakeDatabase();
  await assert.rejects(
    runImport({
      db,
      collect: async () => {
        throw new Error("portal security");
      },
    }),
  );
  assert.equal(db.inserted.length, 0);
  assert.equal(db.statements.at(-1), "release");
  await assert.rejects(
    runImport({
      db,
      collect: async () => [approved("NEW123"), approved("NEW123", "R$ 20,00")],
    }),
    { code: "IMPORT_CONFLICT" },
  );
  assert.equal(db.inserted.length, 0);
});
