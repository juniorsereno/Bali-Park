// playwright.config.js
module.exports = {
  // Configurações globais do Playwright
  testDir: '.',
  timeout: 60000, // 60 segundos de timeout
  retries: 1, // Tentar novamente 1 vez em caso de falha
  
  // Configurações do navegador
  use: {
    headless: false, // Mostrar navegador para visualizar o processo
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    // Simular um usuário real
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },

  // Configurações do projeto
  projects: [
    {
      name: 'chromium',
      use: { ...require('@playwright/test').devices['Desktop Chrome'] },
    }
  ],

  // Configurações de saída
  reporter: [['html'], ['list']],
  outputDir: 'test-results/'
}; 