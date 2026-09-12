require("dotenv").config({ quiet: true });
const fs = require("node:fs");
const path = require("node:path");
const db = require("../src/database");
async function main() {
  const client = await db.connect();
  try {
    await client.query(
      fs.readFileSync(
        path.join(__dirname, "../migrations/001_unique_voucher.sql"),
        "utf8",
      ),
    );
    console.log("Migração de unicidade concluída.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
main()
  .catch((error) => {
    console.error("Migração não concluída:", error.code || error.name);
    process.exitCode = 1;
  })
  .finally(() => db.end());
