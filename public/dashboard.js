(() => {
  const source = document.getElementById("chart-data");
  const canvas = document.getElementById("activityChart");
  if (!source || !canvas || typeof Chart === "undefined") return;

  const data = JSON.parse(source.textContent);
  const hourly = data.hourly || { labels: [], sales: [], revenue: [] };
  const currency = (value) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  const percentage = (value) =>
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + "%";

  Chart.defaults.font.family =
    "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = "#526b77";

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const tooltip = {
    backgroundColor: "#143b50",
    padding: 12,
    cornerRadius: 9,
    titleColor: "#fff",
    bodyColor: "#d8eeef",
    displayColors: true,
  };
  const axis = {
    border: { display: false },
    grid: { color: "#e3ecef", drawTicks: false },
    ticks: { padding: 10, maxTicksLimit: 6 },
  };
  const salesDataset = (values) => ({
    label: "Vendas",
    data: values,
    backgroundColor: "#3d7dba",
    borderRadius: 4,
    maxBarThickness: 18,
    yAxisID: "sales",
    order: 3,
  });
  const dailyDatasets = () => [
    salesDataset(data.sales),
    {
      label: "Atendimentos",
      data: data.users,
      type: "line",
      borderColor: "#29b9b2",
      backgroundColor: "#29b9b2",
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
      yAxisID: "users",
      order: 1,
    },
    {
      label: "Interagiram",
      data: data.activeUsers,
      type: "line",
      borderColor: "#dab267",
      backgroundColor: "#dab267",
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
      yAxisID: "users",
      order: 2,
    },
  ];

  let currentView = "daily";
  const activityChart = new Chart(canvas, {
    type: "bar",
    data: { labels: data.labels, datasets: dailyDatasets() },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: reducedMotion ? false : { duration: 350 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 6,
            boxHeight: 6,
            padding: 16,
            font: { size: 11 },
          },
        },
        tooltip: {
          ...tooltip,
          callbacks: {
            afterBody: (items) => {
              const index = items[0].dataIndex;
              if (currentView === "hourly") {
                return ["Faturamento: " + currency(hourly.revenue[index])];
              }
              const conversion = data.users[index]
                ? (data.sales[index] / data.users[index]) * 100
                : 0;
              return [
                "Faturamento: " + currency(data.revenue[index]),
                "Taxa de conversão: " + percentage(conversion),
              ];
            },
          },
        },
      },
      scales: {
        x: {
          ...axis,
          grid: { display: false },
          ticks: { maxTicksLimit: 6, maxRotation: 0 },
        },
        users: {
          ...axis,
          beginAtZero: true,
          position: "left",
          ticks: { ...axis.ticks, precision: 0 },
          title: { display: true, text: "Atendimentos", font: { size: 11 } },
        },
        sales: {
          ...axis,
          beginAtZero: true,
          position: "right",
          grid: { display: false },
          ticks: { ...axis.ticks, precision: 0 },
          title: { display: true, text: "Vendas", font: { size: 11 } },
        },
      },
    },
  });

  const description = document.getElementById("activity-chart-description");
  document.querySelectorAll("[data-chart-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.chartView;
      if (nextView === currentView) return;
      currentView = nextView;
      const isHourly = currentView === "hourly";

      activityChart.data.labels = isHourly ? hourly.labels : data.labels;
      activityChart.data.datasets = isHourly
        ? [salesDataset(hourly.sales)]
        : dailyDatasets();
      activityChart.options.plugins.legend.display = !isHourly;
      activityChart.options.scales.users.display = !isHourly;
      activityChart.options.scales.sales.position = isHourly ? "left" : "right";
      activityChart.options.scales.x.ticks.maxTicksLimit = isHourly ? 12 : 6;
      activityChart.update();

      canvas.setAttribute(
        "aria-label",
        isHourly
          ? "Gráfico de vendas por horário"
          : "Gráfico de vendas e atendimentos por dia",
      );
      description.textContent = isHourly
        ? "Horários com maior volume de vendas no período"
        : "Como as conversas da Babi avançam até a venda";
      document.querySelectorAll("[data-chart-view]").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
    });
  });
})();
