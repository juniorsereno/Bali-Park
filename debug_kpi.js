require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function debug() {
  try {
    await client.connect();
    
    const query = `
      WITH current_month_sales AS (
        SELECT 
          COUNT(*) as total_vendas,
          SUM(CAST(REPLACE(REPLACE(REPLACE(valor_total, 'R$', ''), '.', ''), ',', '.') AS NUMERIC)) as faturamento
        FROM bali_park.vendas
        WHERE TO_DATE(
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(data_compra, 
            'Fev', 'Feb'), 'Abr', 'Apr'), 'Mai', 'May'), 'Ago', 'Aug'), 'Set', 'Sep'), 'Out', 'Oct'), 'Dez', 'Dec'), '.', '')
        , 'DD Mon YYYY') >= DATE_TRUNC('month', CURRENT_DATE)
      ),
      current_month_users AS (
        SELECT 
          COUNT(*) as total_clientes,
          COUNT(CASE WHEN message_count > 1 THEN 1 END) as clientes_interagiram
        FROM bali_park.users
        WHERE criado_as >= DATE_TRUNC('month', CURRENT_DATE)
      )
      SELECT 
        COALESCE(s.faturamento, 0) as faturamento,
        COALESCE(s.total_vendas, 0) as vendas,
        COALESCE(u.total_clientes, 0) as atendimentoTotal,
        COALESCE(u.clientes_interagiram, 0) as atendimentoResp
      FROM current_month_sales s, current_month_users u;
    `;

    const result = await client.query(query);
    console.log(result.rows[0]);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

debug();