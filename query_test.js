const db = require('./src/database');

async function test() {
  const result = await db.query(`
    SELECT count(*) 
    FROM bali_park.users 
    WHERE source = 'anuncio_fb' AND voucher_venda IS NOT NULL;
  `);
  console.log('Total leads anuncio_fb with voucher:', result.rows);
  
  const result2 = await db.query(`
    SELECT count(*) 
    FROM bali_park.vendas 
    WHERE paid = true AND voucher_code IN (
      SELECT voucher_venda FROM bali_park.users WHERE source = 'anuncio_fb'
    );
  `);
  console.log('Total sales for those vouchers:', result2.rows);

  const result3 = await db.query(`
    SELECT u.voucher_venda, u.criado_as, v.created_at, v.paid
    FROM bali_park.users u
    LEFT JOIN bali_park.vendas v ON u.voucher_venda = v.voucher_code
    WHERE u.source = 'anuncio_fb' AND u.voucher_venda IS NOT NULL
  `);
  console.log('Detailed:', result3.rows);

  process.exit(0);
}
test();
