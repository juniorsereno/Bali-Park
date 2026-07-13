#!/usr/bin/env node

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseDateRange(args) {
  const fromIndex = args.indexOf('--from');
  const toIndex = args.indexOf('--to');
  const from = fromIndex >= 0 ? args[fromIndex + 1] : null;
  const to = toIndex >= 0 ? args[toIndex + 1] : null;

  if (!from || !to) {
    throw new Error('Informe --from e --to no formato AAAA-MM-DD.');
  }

  if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
    throw new Error('Data inválida. Use o formato AAAA-MM-DD.');
  }

  if (from > to) {
    throw new Error('A data --from não pode ser posterior à data --to.');
  }

  return { from, to };
}

async function runBackfill({ from, to }) {
  require('dotenv').config();
  const db = require('../src/database');
  const paymentVerificationService = require('../src/services/paymentVerificationService');

  const result = await db.query(`
    SELECT id, voucher_code, telefone
    FROM bali_park.vendas
    WHERE paid = false
      AND voucher_code IS NOT NULL
      AND created_at >= $1::date
      AND created_at < ($2::date + INTERVAL '1 day')
    ORDER BY created_at ASC
  `, [from, to]);

  console.log(`Encontradas ${result.rows.length} vendas pendentes entre ${from} e ${to}.`);

  const summary = {
    total: result.rows.length,
    updated: 0,
    stillPending: 0,
    errors: 0
  };

  for (const sale of result.rows) {
    const voucher = await paymentVerificationService.checkVoucherStatus(sale.voucher_code);

    if (!voucher.success) {
      summary.errors++;
      console.error(`✗ Venda #${sale.id}: erro ao consultar a Multiclubes`);
    } else if (voucher.isPaid) {
      await paymentVerificationService.updatePaymentStatus(
        sale.id,
        true,
        sale.voucher_code,
        sale.telefone
      );
      summary.updated++;
      console.log(`✓ Venda #${sale.id}: atualizada para PAGA`);
    } else {
      summary.stillPending++;
      console.log(`- Venda #${sale.id}: permanece pendente (${voucher.status || 'sem status'})`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return summary;
}

async function main() {
  try {
    const dateRange = parseDateRange(process.argv.slice(2));
    console.log(`Iniciando backfill de pagamentos de ${dateRange.from} até ${dateRange.to}...`);

    const summary = await runBackfill(dateRange);

    console.log('\n=== Resumo do backfill ===');
    console.log(`Total consultadas: ${summary.total}`);
    console.log(`Atualizadas para PAGO: ${summary.updated}`);
    console.log(`Ainda pendentes: ${summary.stillPending}`);
    console.log(`Erros: ${summary.errors}`);

    process.exit(summary.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error(`Erro: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseDateRange, runBackfill };
