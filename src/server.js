require('dotenv').config();
const express = require('express');
const path = require('path');
const dashboardService = require('./services/dashboardService');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Rota Principal
app.get('/', async (req, res) => {
  try {
    // Buscar dados em paralelo para performance
    const [kpi, charts, monthlyTable, lastSalesTable] = await Promise.all([
      dashboardService.getKPIs(),
      dashboardService.getDailyEvolution(),
      dashboardService.getMonthlyPerformance(),
      dashboardService.getLastSales()
    ]);

    res.render('dashboard', {
      kpi,
      charts,
      tables: {
        mensal: monthlyTable,
        ultimas: lastSalesTable
      }
    });
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    res.status(500).send('Erro interno ao carregar os dados do dashboard.');
  }
});

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});