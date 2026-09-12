require("dotenv").config({ quiet: true });
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  options: "-c timezone=America/Sao_Paulo",
});

pool.on("error", (error) =>
  console.error("Conexão PostgreSQL interrompida:", error.code || error.name),
);

module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(),
  end: () => pool.end(),
};
