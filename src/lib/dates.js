const TIME_ZONE = "America/Sao_Paulo";
function localTimestamp(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
function dateRange(query = {}, now = new Date()) {
  const today = localTimestamp(now).slice(0, 10);
  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = query.dataInicial ?? `${today.slice(0, 7)}-01`;
  const end = query.dataFinal ?? `${today.slice(0, 7)}-${lastDay}`;
  for (const value of [start, end]) {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    ) {
      throw new Error("Selecione datas válidas para o período.");
    }
  }
  if (start > end)
    throw new Error("A data inicial deve ser anterior ou igual à data final.");
  if ((Date.parse(end) - Date.parse(start)) / 86400000 > 3660)
    throw new Error("Selecione um período de até dez anos.");
  return { dataInicial: start, dataFinal: end };
}
module.exports = { TIME_ZONE, localTimestamp, dateRange };
