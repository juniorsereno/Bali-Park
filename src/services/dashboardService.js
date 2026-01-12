const db = require('../database');

const dashboardService = {
  async getKPIs(dataInicial, dataFinal) {
    // KPIs Gerais (Período Selecionado) - Apenas vendas pagas (paid = true)
    const query = `
      WITH period_transbordo_vouchers AS (
        SELECT voucher_venda
        FROM bali_park.users
        WHERE source = 'transbordo_central_vendas'
          AND voucher_venda IS NOT NULL
          AND DATE(criado_as) BETWEEN $1::date AND $2::date
      ),
      period_sales AS (
        SELECT
          COUNT(*) as total_vendas,
          SUM(valor_total) as faturamento
        FROM bali_park.vendas
        WHERE paid = true
          AND DATE(created_at) BETWEEN $1::date AND $2::date
          AND voucher_code NOT IN (SELECT voucher_venda FROM period_transbordo_vouchers)
      ),
      period_users AS (
        SELECT
          COUNT(*) FILTER (WHERE source = 'central_vendas') as total_clientes,
          COUNT(CASE WHEN message_count > 1 AND source = 'central_vendas' THEN 1 END) as clientes_interagiram,
          COUNT(*) FILTER (WHERE source = 'central_vendas') as leads_central_vendas,
          COUNT(CASE WHEN message_count > 2 AND source = 'central_vendas' THEN 1 END) as interagiram_central
        FROM bali_park.users
        WHERE DATE(criado_as) BETWEEN $1::date AND $2::date
      ),
      transbordo_stats AS (
        SELECT
          COUNT(*) as leads_transbordo,
          COUNT(*) FILTER (WHERE message_count > 2) as interagiram_transbordo,
          COUNT(*) FILTER (WHERE voucher_venda IS NOT NULL) as vendas_transbordo,
          ARRAY_AGG(voucher_venda) FILTER (WHERE voucher_venda IS NOT NULL) as transbordo_vouchers
        FROM bali_park.users
        WHERE source = 'transbordo_central_vendas'
          AND DATE(criado_as) BETWEEN $1::date AND $2::date
      ),
      transbordo_revenue AS (
        SELECT COALESCE(SUM(valor_total), 0) as faturamento_transbordo
        FROM bali_park.vendas
        WHERE paid = true
          AND DATE(created_at) BETWEEN $1::date AND $2::date
          AND voucher_code IN (SELECT UNNEST(transbordo_vouchers) FROM transbordo_stats)
      )
      SELECT
        COALESCE(s.faturamento, 0) as faturamento,
        COALESCE(s.total_vendas, 0) as vendas,
        COALESCE(u.total_clientes, 0) as atendimentoTotal,
        COALESCE(u.clientes_interagiram, 0) as atendimentoResp,
        COALESCE(u.leads_central_vendas, 0) as leadsCentralVendas,
        COALESCE(u.interagiram_central, 0) as interagiram_central,
        COALESCE(ts.leads_transbordo, 0) as leads_transbordo,
        COALESCE(ts.interagiram_transbordo, 0) as interagiram_transbordo,
        COALESCE(ts.vendas_transbordo, 0) as vendas_transbordo,
        COALESCE(tr.faturamento_transbordo, 0) as faturamento_transbordo
      FROM period_sales s, period_users u, transbordo_stats ts, transbordo_revenue tr;
    `;
    
    const result = await db.query(query, [dataInicial, dataFinal]);
    const data = result.rows[0];
    
    // Cálculos derivados
    const ticket = data.vendas > 0 ? data.faturamento / data.vendas : 0;
    const taxaResposta = data.atendimentototal > 0 ? (data.atendimentoresp / data.atendimentototal) * 100 : 0;
    
    // Novas Taxas
    const convGeral = data.atendimentototal > 0 ? (data.vendas / data.atendimentototal) * 100 : 0;
    const convReal = data.atendimentoresp > 0 ? (data.vendas / data.atendimentoresp) * 100 : 0;

    // Cálculos Transbordo
    const taxaRespostaTransbordo = data.leads_transbordo > 0 ? (data.interagiram_transbordo / data.leads_transbordo) * 100 : 0;
    const convTransbordo = data.leads_transbordo > 0 ? (data.vendas_transbordo / data.leads_transbordo) * 100 : 0;
    const convRealTransbordo = data.interagiram_transbordo > 0 ? (data.vendas_transbordo / data.interagiram_transbordo) * 100 : 0;

    return {
      faturamento: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.faturamento),
      vendas: data.vendas,
      ticket: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket),
      taxaResposta: taxaResposta.toFixed(1) + '%',
      atendimentoResp: data.atendimentoresp,
      atendimentoTotal: data.atendimentototal,
      leadsCentralVendas: data.leadscentralvendas,
      interagiramCentral: data.interagiram_central,
      convGeral: convGeral.toFixed(2) + '%',
      convReal: convReal.toFixed(2) + '%',
      // Transbordo
      faturamentoTransbordo: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.faturamento_transbordo),
      vendasTransbordo: data.vendas_transbordo,
      leadsTransbordo: data.leads_transbordo,
      interagiramTransbordo: data.interagiram_transbordo,
      taxaRespostaTransbordo: taxaRespostaTransbordo.toFixed(1) + '%',
      convTransbordo: convTransbordo.toFixed(2) + '%',
      convRealTransbordo: convRealTransbordo.toFixed(2) + '%'
    };
  },

  async getDailyEvolution(dataInicial, dataFinal) {
    // Evolução Diária (Período Selecionado) - Apenas vendas pagas
    const query = `
      WITH date_series AS (
        SELECT generate_series($1::date, $2::date, '1 day')::date AS date
      ),
      daily_transbordo_vouchers AS (
        SELECT DATE(criado_as) as date, voucher_venda
        FROM bali_park.users
        WHERE source = 'transbordo_central_vendas'
          AND voucher_venda IS NOT NULL
          AND DATE(criado_as) BETWEEN $1::date AND $2::date
      ),
      daily_sales AS (
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total_vendas,
          COALESCE(SUM(valor_total), 0) as faturamento
        FROM bali_park.vendas v
        WHERE paid = true
          AND DATE(created_at) BETWEEN $1::date AND $2::date
          AND NOT EXISTS (
            SELECT 1 FROM daily_transbordo_vouchers dtv
            WHERE dtv.voucher_venda = v.voucher_code AND dtv.date = DATE(v.created_at)
          )
        GROUP BY 1
      ),
      daily_users AS (
        SELECT
          DATE(criado_as) as date,
          COUNT(*) FILTER (WHERE source = 'central_vendas') as total_users,
          COUNT(CASE WHEN message_count > 2 AND source = 'central_vendas' THEN 1 END) as active_users
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
      labels: JSON.stringify(result.rows.map(r => r.label)),
      users: JSON.stringify(result.rows.map(r => r.users)),
      activeUsers: JSON.stringify(result.rows.map(r => r.active_users)),
      sales: JSON.stringify(result.rows.map(r => r.sales)),
      revenue: JSON.stringify(result.rows.map(r => parseFloat(r.revenue)))
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
