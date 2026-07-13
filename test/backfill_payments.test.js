const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDateRange } = require('../scripts/backfill_payments');

test('aceita período explícito inclusivo para o backfill', () => {
  assert.deepEqual(
    parseDateRange(['--from', '2026-07-10', '--to', '2026-07-13']),
    { from: '2026-07-10', to: '2026-07-13' }
  );
});

test('recusa execução sem as duas datas', () => {
  assert.throws(
    () => parseDateRange(['--from', '2026-07-10']),
    /Informe --from e --to/
  );
});

test('recusa data inválida', () => {
  assert.throws(
    () => parseDateRange(['--from', '2026-02-30', '--to', '2026-07-13']),
    /Data inválida/
  );
});

test('recusa período invertido', () => {
  assert.throws(
    () => parseDateRange(['--from', '2026-07-14', '--to', '2026-07-13']),
    /não pode ser posterior/
  );
});
