const cron = require('node-cron');
const paymentVerificationService = require('../services/paymentVerificationService');

/**
 * Inicia o job de verificação de pagamentos
 * Executa a cada 2 horas
 */
function startPaymentScheduler() {
  // Cron: a cada 2 horas (minuto 0)
  cron.schedule('0 */2 * * *', async () => {
    try {
      await paymentVerificationService.runVerification();
    } catch (error) {
      console.error('Erro no job de verificação de pagamentos:', error);
    }
  });

  console.log('📅 Job de verificação de pagamentos agendado (a cada 2 horas)');
  
  // Executa uma vez ao iniciar o servidor (opcional)
  // paymentVerificationService.runVerification();
}

module.exports = { startPaymentScheduler };
