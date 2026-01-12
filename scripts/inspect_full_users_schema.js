require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  try {
    await client.connect();
    
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'bali_park' AND table_name = 'users'
      ORDER BY column_name
    `);
    console.log('Columns in bali_park.users:');
    res.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

inspect();
