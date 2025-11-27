require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function debug() {
  try {
    await client.connect();
    
    console.log('--- Count Users > 2 msg This Month ---');
    const count = await client.query(`
      SELECT COUNT(*) 
      FROM bali_park.users 
      WHERE criado_as >= DATE_TRUNC('month', CURRENT_DATE)
      AND message_count > 2
    `);
    console.log(count.rows[0]);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

debug();