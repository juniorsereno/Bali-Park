function normalizeVoucher(value) {
  const voucher = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,49}$/.test(voucher))
    throw new Error("Voucher inválido.");
  return voucher;
}
function parseMoney(value) {
  const text = String(value ?? "")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}$/.test(text))
    throw new Error("Valor inválido.");
  const [whole, fraction] = text.replace(/\./g, "").split(",");
  return BigInt(whole).toString() + "." + fraction;
}
function parsePortalRow(row) {
  const status = String(row.status ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!status) throw new Error("Status ausente.");
  if (status !== "pagamento aprovado") return null;
  return {
    voucher_code: normalizeVoucher(row.voucher),
    valor_total: parseMoney(row.amount),
  };
}
module.exports = { normalizeVoucher, parseMoney, parsePortalRow };
