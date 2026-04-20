const db = require('../database');

const dashboardService = {
  async getKPIs(dataInicial, dataFinal) {
    const query = `
      WITH
      sales_with_source AS (
        SELECT
          v.valor_total,
          v.voucher_code,
          CASE 
            WHEN DATE(v.created_at) < '2026-04-01' THEN 'anuncio_fb'
            ELSE (SELECT u.source FROM bali_park.users u WHERE u.voucher_venda = v.voucher_code LIMIT 1)
          END as user_source
        FROM bali_park.vendas v
        WHERE v.paid = true
          AND DATE(v.created_at) BETWEEN $1::date AND $2::date
      ),
      site_sales AS (
        SELECT
          COUNT(*) as vendas,
          COALESCE(SUM(valor_total), 0) as faturamento
        FROM sales_with_source
        WHERE user_source != 'anuncio_fb' OR user_source IS NULL
      ),
      fb_sales AS (
        SELECT
          COUNT(*) as vendas,
          COALESCE(SUM(valor_total), 0) as faturamento
        FROM sales_with_source
        WHERE user_source = 'anuncio_fb'
      ),
      site_users AS (
        SELECT
          COUNT(*) as leads,
          COUNT(*) FILTER (WHERE message_count > 1) as responderam,
          COUNT(*) FILTER (WHERE message_count > 2) as interagiram
        FROM bali_park.users
        WHERE source != 'anuncio_fb'
          AND DATE(criado_as) BETWEEN $1::date AND $2::date
      ),
      fb_users AS (
        SELECT
          COUNT(*) as leads,
          COUNT(*) FILTER (WHERE message_count > 1) as responderam,
          COUNT(*) FILTER (WHERE message_count > 2) as interagiram
        FROM bali_park.users
        WHERE source = 'anuncio_fb'
          AND DATE(criado_as) BETWEEN $1::date AND $2::date
      )
      SELECT
        ss.faturamento as site_faturamento,
        ss.vendas as site_vendas,
        su.leads as site_leads,
        su.responderam as site_responderam,
        su.interagiram as site_interagiram,
        fs.faturamento as fb_faturamento,
        fs.vendas as fb_vendas,
        fu.leads as fb_leads,
        fu.responderam as fb_responderam,
        fu.interagiram as fb_interagiram
      FROM site_sales ss, fb_sales fs, site_users su, fb_users fu
    `;

    const result = await db.query(query, [dataInicial, dataFinal]);
    const data = result.rows[0];
    const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const siteTicket = data.site_vendas > 0 ? data.site_faturamento / data.site_vendas : 0;
    const siteTaxaInteracao = data.site_leads > 0 ? (data.site_interagiram / data.site_leads) * 100 : 0;
    const siteConvGeral = data.site_leads > 0 ? (data.site_vendas / data.site_leads) * 100 : 0;
    const siteConvReal = data.site_interagiram > 0 ? (data.site_vendas / data.site_interagiram) * 100 : 0;

    const fbTicket = data.fb_vendas > 0 ? data.fb_faturamento / data.fb_vendas : 0;
    const fbTaxaInteracao = data.fb_leads > 0 ? (data.fb_interagiram / data.fb_leads) * 100 : 0;
    const fbConvGeral = data.fb_leads > 0 ? (data.fb_vendas / data.fb_leads) * 100 : 0;
    const fbConvReal = data.fb_interagiram > 0 ? (data.fb_vendas / data.fb_interagiram) * 100 : 0;

    return {
      siteFaturamento: fmt(data.site_faturamento),
      siteVendas: data.site_vendas,
      siteTicket: fmt(siteTicket),
      siteLeads: data.site_leads,
      siteInteragiram: data.site_interagiram,
      siteTaxaResposta: siteTaxaInteracao.toFixed(1) + '%',
      siteConvGeral: siteConvGeral.toFixed(2) + '%',
      siteConvReal: siteConvReal.toFixed(2) + '%',
      fbFaturamento: fmt(data.fb_faturamento),
      fbVendas: data.fb_vendas,
      fbTicket: fmt(fbTicket),
      fbLeads: data.fb_leads,
      fbInteragiram: data.fb_interagiram,
      fbTaxaResposta: fbTaxaInteracao.toFixed(1) + '%',
      fbConvGeral: fbConvGeral.toFixed(2) + '%',
      fbConvReal: fbConvReal.toFixed(2) + '%',
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
        WHERE false -- Disable exclusions
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
          COUNT(*) FILTER (WHERE source != 'anuncio_fb') as total_users,
          COUNT(CASE WHEN message_count > 2 AND source != 'anuncio_fb' THEN 1 END) as active_users
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
