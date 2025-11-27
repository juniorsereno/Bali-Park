require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  try {
    await client.connect();
    
    console.log('--- Schemas ---');
    const schemas = await client.query("SELECT schema_name FROM information_schema.schemata");
    schemas.rows.forEach(r => console.log(r.schema_name));

    console.log('\n--- Tables in bali_park ---');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'bali_park'
    `);
    tables.rows.forEach(r => console.log(r.table_name));

    console.log('\n--- All Tables ---');
    const allTables = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    `);
    allTables.rows.forEach(r => console.log(`${r.table_schema}.${r.table_name}`));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

inspect();