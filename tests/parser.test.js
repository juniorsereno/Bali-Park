const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeVoucher,
  parseMoney,
  parsePortalRow,
} = require("../src/services/portalParser");
const { localTimestamp, dateRange } = require("../src/lib/dates");
test("Brazilian money preserves exact decimal representation", () => {
  assert.equal(parseMoney("R$ 1.234,56"), "1234.56");
  assert.equal(parseMoney("R$\u00a0183,00"), "183.00");
  assert.equal(parseMoney("1234,56"), "1234.56");
  assert.equal(parseMoney("0,00"), "0.00");
  assert.equal(parseMoney("00183,00"), "183.00");
  for (const value of ["123.45", "1.23,45", "R$ -12,00", "", null])
    assert.throws(() => parseMoney(value));
});
test("vouchers are normalized; invalid or HTML values are rejected", () => {
  assert.equal(normalizeVoucher(" rsw99310 "), "RSW99310");
  for (const value of ["", null, "<img src=x>", "ABC 123", "A".repeat(51)])
    assert.throws(() => normalizeVoucher(value));
});
test("only approved payments can become sales", () => {
  assert.deepEqual(
    parsePortalRow({
      voucher: "abc123",
      amount: "R$ 10,50",
      status: " Pagamento aprovado ",
    }),
    { voucher_code: "ABC123", valor_total: "10.50" },
  );
  assert.equal(
    parsePortalRow({
      voucher: "ABC",
      amount: "R$ 10,50",
      status: "Pagamento pendente",
    }),
    null,
  );
  assert.equal(parsePortalRow({ status: "Pagamento cancelado" }), null);
});
test("collection timestamp uses São Paulo even across midnight and month boundaries", () => {
  assert.equal(
    localTimestamp(new Date("2026-10-01T01:30:00Z")),
    "2026-09-30 22:30:00",
  );
  assert.deepEqual(dateRange({}, new Date("2026-10-01T01:30:00Z")), {
    dataInicial: "2026-09-01",
    dataFinal: "2026-09-30",
  });
});
test("filters reject malformed dates, arrays, reversed and excessive ranges", () => {
  for (const dataInicial of [
    "2026-02-30",
    "invalid",
    ["2026-09-01"],
    "2026-13-01",
  ])
    assert.throws(() => dateRange({ dataInicial }));
  assert.throws(() =>
    dateRange({ dataInicial: "2026-09-02", dataFinal: "2026-09-01" }),
  );
  assert.throws(() =>
    dateRange({ dataInicial: "0001-01-01", dataFinal: "9999-01-01" }),
  );
});
