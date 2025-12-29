const db = require('../database');

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
          COUNT(*) as total_clientes,
          COUNT(CASE WHEN message_count > 1 THEN 1 END) as clientes_interagiram,
          COUNT(CASE WHEN source = 'central_vendas' THEN 1 END) as leads_central_vendas,
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
    const taxaResposta = data.atendimentototal > 0 ? (data.atendimentoresp / data.atendimentototal) * 100 : 0;
    
    // Novas Taxas
    const convGeral = data.atendimentototal > 0 ? (data.vendas / data.atendimentototal) * 100 : 0;
    const convReal = data.atendimentoresp > 0 ? (data.vendas / data.atendimentoresp) * 100 : 0;

    return {
      faturamento: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.faturamento),
      vendas: data.vendas,
      ticket: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket),
      taxaResposta: taxaResposta.toFixed(1) + '%',
      atendimentoResp: data.atendimentoresp,
      atendimentoTotal: data.atendimentototal,
      leadsCentralVendas: data.leadscentralvendas,
      leadsRemarketing: data.leadsremarketing,
      convGeral: convGeral.toFixed(2) + '%',
      convReal: convReal.toFixed(2) + '%'
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
          COUNT(*) as total_vendas
        FROM bali_park.vendas
        WHERE paid = true
          AND DATE(created_at) BETWEEN $1::date AND $2::date
        GROUP BY 1
      ),
      daily_users AS (
        SELECT
          DATE(criado_as) as date,
          COUNT(*) as total_users,
          COUNT(CASE WHEN message_count > 2 THEN 1 END) as active_users
        FROM bali_park.users
        WHERE DATE(criado_as) BETWEEN $1::date AND $2::date
        GROUP BY 1
      )
      SELECT
        TO_CHAR(ds.date, 'DD/MM') as label,
        COALESCE(u.total_users, 0) as users,
        COALESCE(u.active_users, 0) as active_users,
        COALESCE(s.total_vendas, 0) as sales
      FROM date_series ds
      LEFT JOIN daily_sales s ON ds.date = s.date
      LEFT JOIN daily_users u ON ds.date = u.date
      ORDER BY ds.date;
    `;

    const result = await db.query(query, [dataInicial, dataFinal]);
    return {
      labels: JSON.stringify(result.rows.map(r => r.label)),
      users: JSON.stringify(result.rows.map(r => r.users)),
      activeUsers: JSON.stringify(result.rows.map(r => r.active_users)),
      sales: JSON.stringify(result.rows.map(r => r.sales))
    };
  },

  async getMonthlyPerformance() {
    // Performance Mensal (Últimos 6 meses) - Apenas vendas pagas
    const query = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon/YY') as mes,
        DATE_TRUNC('month', created_at) as data_ordem,
        COUNT(*) as qtd,
        SUM(valor_total) as total
      FROM bali_park.vendas
      WHERE paid = true
      GROUP BY 1, 2
      ORDER BY 2 DESC
      LIMIT 6;
    `;
    
    const result = await db.query(query);

    return result.rows.map(row => `
      <tr>
        <td>${row.mes}</td>
        <td><span class="badge">${row.qtd}</span></td>
        <td>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.total)}</td>
      </tr>
    `).join('');
  },

  async getLastSales() {
    // Últimas 10 Vendas - Apenas vendas pagas
    const query = `
      SELECT
        TO_CHAR(created_at, 'DD Mon YYYY') as data_compra,
        voucher_code,
        id,
        valor_total
      FROM bali_park.vendas
      WHERE paid = true
      ORDER BY created_at DESC
      LIMIT 10;
    `;

    const result = await db.query(query);

    return result.rows.map(row => `
      <tr>
        <td>${row.data_compra}</td>
        <td>
          <div style="font-weight:500;">${row.voucher_code || '-'}</div>
          <div style="font-size:0.75rem; color:#6b7280;">ID: ${row.id}</div>
        </td>
        <td style="font-weight:600; color:#111827;">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valor_total || 0)}</td>
      </tr>
    `).join('');
  }
};

module.exports = dashboardService;
