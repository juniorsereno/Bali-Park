const { parsePortalRow } = require("./portalParser");
const { localTimestamp } = require("../lib/dates");
const LOCK_KEY = 1847212026;
async function runImport({
  db,
  collect,
  dryRun = false,
  now = () => new Date(),
}) {
  const client = await db.connect();
  let locked = false,
    transaction = false,
    discard = false;
  const summary = {
    dryRun,
    read: 0,
    approved: 0,
    existing: 0,
    new: 0,
    inserted: 0,
    ignored: 0,
    invalid: 0,
    repeated: 0,
  };
  try {
    locked = (
      await client.query("SELECT pg_try_advisory_lock($1) AS locked", [
        LOCK_KEY,
      ])
    ).rows[0].locked;
    if (!locked) return { ...summary, skipped: "already_running" };
    if (!dryRun) {
      const index = await client.query(
        "SELECT indisunique AND indisvalid AS ready FROM pg_index WHERE indexrelid = to_regclass('bali_park.idx_vendas_voucher_unique')",
      );
      if (!index.rows[0]?.ready)
        throw Object.assign(
          new Error("Execute a migração de unicidade antes de importar."),
          { code: "IMPORT_MIGRATION_REQUIRED" },
        );
    }
    // Complete collection before INSERTs: authentication/pagination failures never write sales.
    const rows = await collect();
    summary.read = rows.length;
    const timestamp = localTimestamp(now());
    const sales = new Map();
    for (const row of rows) {
      let sale;
      try {
        sale = parsePortalRow(row);
      } catch {
        summary.invalid++;
        continue;
      }
      if (!sale) {
        summary.ignored++;
        continue;
      }
      summary.approved++;
      if (sales.has(sale.voucher_code)) {
        if (sales.get(sale.voucher_code).valor_total !== sale.valor_total)
          throw Object.assign(
            new Error(
              "O portal apresentou valores diferentes para o mesmo voucher.",
            ),
            { code: "IMPORT_CONFLICT" },
          );
        summary.repeated++;
      } else sales.set(sale.voucher_code, sale);
    }
    if (dryRun) {
      await client.query("BEGIN READ ONLY");
      transaction = true;
    }
    const existing = await client.query(
      "SELECT UPPER(BTRIM(voucher_code)) AS voucher FROM bali_park.vendas WHERE UPPER(BTRIM(voucher_code)) = ANY($1::text[])",
      [[...sales.keys()]],
    );
    const known = new Set(existing.rows.map((row) => row.voucher));
    for (const sale of sales.values()) {
      if (known.has(sale.voucher_code)) {
        summary.existing++;
        continue;
      }
      summary.new++;
      if (!dryRun) {
        const inserted = await client.query(
          "INSERT INTO bali_park.vendas (voucher_code, valor_total, created_at, paid) VALUES ($1, $2::numeric, $3::timestamp, true) ON CONFLICT DO NOTHING RETURNING id",
          [sale.voucher_code, sale.valor_total, timestamp],
        );
        if (inserted.rowCount) summary.inserted++;
        else {
          summary.existing++;
          summary.new--;
        }
      }
    }
    if (transaction) {
      await client.query("COMMIT");
      transaction = false;
    }
    return summary;
  } finally {
    try {
      if (transaction) await client.query("ROLLBACK");
      if (locked)
        await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    } catch {
      discard = true;
    }
    client.release(discard);
  }
}
module.exports = { runImport };
