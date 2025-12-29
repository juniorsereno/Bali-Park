/**
 * Script para executar verificação de pagamentos manualmente
 * Uso: node scripts/verify_payments.js
 */
require('dotenv').config();
const paymentVerificationService = require('../src/services/paymentVerificationService');

async function main() {
  console.log('Executando verificação manual de pagamentos...\n');
  
  try {
    const result = await paymentVerificationService.runVerification();
    console.log('\n=== Resumo ===');
    console.log(`Total verificadas: ${result.total}`);
    console.log(`Atualizadas para PAGO: ${result.updated}`);
    console.log(`Erros: ${result.errors}`);
  } catch (error) {
    console.error('Erro:', error);
  }
  
  process.exit(0);
}

main();
