function createDashboardService(
  db = { query: (...args) => require("../database").query(...args) },
) {
  const dashboardService = {
    async getKPIs(dataInicial, dataFinal) {
      // KPIs Gerais (Período Selecionado) - Apenas vendas pagas (paid = true)
      const query = `
      WITH period_sales AS (
        SELECT
          COUNT(*) as total_vendas,
          SUM(valor_total) as faturamento
        FROM bali_park.vendas
        WHERE paid = true
          AND DATE(created_at) BETWEEN $1::date AND $2::date
      ),
      period_users AS (
        SELECT
          COUNT(*) FILTER (WHERE source = 'central_vendas' OR (source = 'transbordo_central_vendas' AND message_count > 1)) as total_clientes,
          COUNT(CASE WHEN message_count > 2 THEN 1 END) as clientes_interagiram,
          COUNT(*) FILTER (WHERE source = 'central_vendas' OR (source = 'transbordo_central_vendas' AND message_count > 1)) as leads_central_vendas,
          COUNT(CASE WHEN source = 'central' THEN 1 END) as leads_remarketing
        FROM bali_park.users
        WHERE DATE(criado_as) BETWEEN $1::date AND $2::date
      )
      SELECT
        COALESCE(s.faturamento, 0) as faturamento,
        COALESCE(s.total_vendas, 0) as vendas,
        COALESCE(u.total_clientes, 0) as atendimentoTotal,
        COALESCE(u.clientes_interagiram, 0) as atendimentoResp,
        COALESCE(u.leads_central_vendas, 0) as leadsCentralVendas,
        COALESCE(u.leads_remarketing, 0) as leadsRemarketing
      FROM period_sales s, period_users u;
    `;

      const result = await db.query(query, [dataInicial, dataFinal]);
      const data = result.rows[0];

      // Cálculos derivados
      const ticket = data.vendas > 0 ? data.faturamento / data.vendas : 0;
      const taxaResposta =
        data.atendimentototal > 0
          ? (data.atendimentoresp / data.atendimentototal) * 100
          : 0;

      // Novas Taxas
      const convGeral =
        data.atendimentototal > 0
          ? (data.vendas / data.atendimentototal) * 100
          : 0;
      const convReal =
        data.atendimentoresp > 0
          ? (data.vendas / data.atendimentoresp) * 100
          : 0;

      return {
        faturamento: new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(data.faturamento),
        vendas: data.vendas,
        ticket: new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(ticket),
        taxaResposta: taxaResposta.toFixed(1).replace(".", ",") + "%",
        atendimentoResp: data.atendimentoresp,
        atendimentoTotal: data.atendimentototal,
        leadsCentralVendas: data.leadscentralvendas,
        leadsRemarketing: data.leadsremarketing,
        convGeral: convGeral.toFixed(2).replace(".", ",") + "%",
        convReal: convReal.toFixed(2).replace(".", ",") + "%",
      };
    },

    async getDailyEvolution(dataInicial, dataFinal) {
      // Evolução Diária (Período Selecionado) - Apenas vendas pagas
      const query = `
      WITH date_series AS (
        SELECT generate_series($1::date, $2::date, '1 day')::date AS date
      ),
      daily_sales AS (
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total_vendas,
          COALESCE(SUM(valor_total), 0) as faturamento
        FROM bali_park.vendas
        WHERE paid = true
          AND DATE(created_at) BETWEEN $1::date AND $2::date
        GROUP BY 1
      ),
      daily_users AS (
        SELECT
          DATE(criado_as) as date,
          COUNT(*) FILTER (WHERE source = 'central_vendas' OR (source = 'transbordo_central_vendas' AND message_count > 1)) as total_users,
          COUNT(CASE WHEN message_count > 2 THEN 1 END) as active_users
        FROM bali_park.users
        WHERE DATE(criado_as) BETWEEN $1::date AND $2::date
        GROUP BY 1
      )
      SELECT
        TO_CHAR(ds.date, 'DD/MM') as label,
        COALESCE(u.total_users, 0) as users,
        COALESCE(u.active_users, 0) as active_users,
        COALESCE(s.total_vendas, 0) as sales,
        COALESCE(s.faturamento, 0) as revenue
      FROM date_series ds
      LEFT JOIN daily_sales s ON ds.date = s.date
      LEFT JOIN daily_users u ON ds.date = u.date
      ORDER BY ds.date;
    `;

      const result = await db.query(query, [dataInicial, dataFinal]);
      return {
        labels: result.rows.map((r) => r.label),
        users: result.rows.map((r) => Number(r.users)),
        activeUsers: result.rows.map((r) => Number(r.active_users)),
        sales: result.rows.map((r) => Number(r.sales)),
        revenue: result.rows.map((r) => Number(r.revenue)),
      };
    },

    async getHourlySales(dataInicial, dataFinal) {
      const query = `
      WITH hour_series AS (
        SELECT generate_series(0, 23) AS hour
      ),
      hourly_sales AS (
        SELECT
          EXTRACT(HOUR FROM created_at)::integer AS hour,
          COUNT(*) AS sales,
          COALESCE(SUM(valor_total), 0) AS revenue
        FROM bali_park.vendas
        WHERE paid = true
          AND DATE(created_at) BETWEEN $1::date AND $2::date
        GROUP BY 1
      )
      SELECT
        LPAD(h.hour::text, 2, '0') || 'h' AS label,
        COALESCE(s.sales, 0) AS sales,
        COALESCE(s.revenue, 0) AS revenue
      FROM hour_series h
      LEFT JOIN hourly_sales s ON s.hour = h.hour
      ORDER BY h.hour;
    `;

      const result = await db.query(query, [dataInicial, dataFinal]);
      return {
        labels: result.rows.map((row) => row.label),
        sales: result.rows.map((row) => Number(row.sales)),
        revenue: result.rows.map((row) => Number(row.revenue)),
      };
    },

    async getMonthlyPerformance() {
      // Histórico mensal completo - Apenas vendas pagas
      const query = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'MM/YYYY') as mes,
        DATE_TRUNC('month', created_at) as data_ordem,
        COUNT(*) as qtd,
        SUM(valor_total) as total
      FROM bali_park.vendas
      WHERE paid = true
      GROUP BY 1, 2
      ORDER BY 2 DESC;
    `;

      const result = await db.query(query);

      const months = [
        "Jan",
        "Fev",
        "Mar",
        "Abr",
        "Mai",
        "Jun",
        "Jul",
        "Ago",
        "Set",
        "Out",
        "Nov",
        "Dez",
      ];
      return result.rows.map((row) => {
        const [month, year] = row.mes.split("/");
        return {
          ...row,
          mes: `${months[Number(month) - 1]}/${year.slice(-2)}`,
        };
      });
    },

    async getLastSales() {
      // Últimas 10 Vendas - Apenas vendas pagas
      const query = `
      SELECT
        TO_CHAR(created_at, 'DD/MM/YYYY') as data_compra,
        TO_CHAR(created_at, 'HH24:MI') as hora_compra,
        voucher_code,
        id,
        valor_total
      FROM bali_park.vendas
      WHERE paid = true
      ORDER BY created_at DESC
      LIMIT 10;
    `;

      const result = await db.query(query);

      return result.rows;
    },
  };

  return dashboardService;
}
module.exports = createDashboardService();
module.exports.createDashboardService = createDashboardService;
