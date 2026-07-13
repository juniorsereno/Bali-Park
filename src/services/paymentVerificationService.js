const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const db = require('../database');

const SOAP_URL = process.env.MULTICLUBES_SOAP_URL || 'https://onlineservices.balipark.com.br:4443/(a655f81b-8437-48ec-8876-069664ee891a)/tickets/v2.svc';
const SOAP_ACTION = 'http://multiclubes.com.br/tickets/v2/IService/SearchVoucher';
const AUTH_KEY = process.env.MULTICLUBES_AUTH_KEY || '3fe6ca43-65cc-4776-9fb8-667855dbd6e0';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
  minVersion: 'TLSv1',
  ciphers: 'DEFAULT:@SECLEVEL=0'
});

const paymentVerificationService = {
  /**
   * Monta o envelope SOAP para consulta de voucher
   */
  buildSoapEnvelope(voucherCode) {
    return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v2="http://multiclubes.com.br/tickets/v2">
  <soapenv:Header>
    <_AuthenticationKey xmlns="ns">${AUTH_KEY}</_AuthenticationKey>
  </soapenv:Header>
  <soapenv:Body>
    <v2:SearchVoucher>
      <v2:data>
        <v2:VoucherCode>${voucherCode}</v2:VoucherCode>
      </v2:data>
    </v2:SearchVoucher>
  </soapenv:Body>
</soapenv:Envelope>`;
  },

  /**
   * Consulta o status do voucher na API SOAP
   */
  async checkVoucherStatus(voucherCode) {
    try {
      const response = await axios.post(SOAP_URL, this.buildSoapEnvelope(voucherCode), {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': SOAP_ACTION
        },
        httpsAgent,
        timeout: 30000
      });

      const xml = response.data;
      
      // Extrair VoucherStatus do XML de resposta
      const statusMatch = xml.match(/<VoucherStatus>([^<]+)<\/VoucherStatus>/);
      const status = statusMatch ? statusMatch[1] : null;

      return {
        success: true,
        voucherCode,
        status,
        isPaid: status === 'AccessReady'
      };
    } catch (error) {
      console.error(`Erro ao verificar voucher ${voucherCode}:`, error.message);
      return {
        success: false,
        voucherCode,
        error: error.message,
        isPaid: false
      };
    }
  },

  /**
   * Busca vendas não pagas com menos de 3 dias de criação
   */
  async getPendingPayments() {
    const query = `
      SELECT id, voucher_code, telefone
      FROM bali_park.vendas
      WHERE paid = false
        AND voucher_code IS NOT NULL
        AND created_at >= NOW() - INTERVAL '3 days'
    `;
    
    const result = await db.query(query);
    return result.rows;
  },

  /**
   * Atualiza o status de pagamento de uma venda
   */
  async updatePaymentStatus(id, paid, voucherCode, telefone) {
    const query = `
      UPDATE bali_park.vendas
      SET paid = $1
      WHERE id = $2
    `;
    
    await db.query(query, [paid, id]);

    // Se a venda foi paga, tenta atualizar o voucher na tabela users pelo telefone (últimos 5 dígitos)
    if (paid && telefone && voucherCode) {
      try {
        const last5Digits = telefone.slice(-5);
        const userUpdateQuery = `
          UPDATE bali_park.users
          SET voucher_venda = $1
          WHERE telefone LIKE '%' || $2
            AND voucher_venda IS NULL
        `;
        const userResult = await db.query(userUpdateQuery, [voucherCode, last5Digits]);
        if (userResult.rowCount > 0) {
          console.log(`✓ Vinculei voucher ${voucherCode} a ${userResult.rowCount} usuário(s) com final de telefone ${last5Digits}`);
        }
      } catch (err) {
        console.error(`Erro ao vincular voucher ao usuário:`, err.message);
      }
    }
  },

  /**
   * Executa a verificação de todas as vendas pendentes
   */
  async runVerification() {
    console.log(`[${new Date().toISOString()}] Iniciando verificação de pagamentos...`);
    
    try {
      const pendingPayments = await this.getPendingPayments();
      console.log(`Encontradas ${pendingPayments.length} vendas pendentes para verificar.`);

      let updated = 0;
      let errors = 0;

      for (const sale of pendingPayments) {
        const result = await this.checkVoucherStatus(sale.voucher_code);
        
        if (result.success && result.isPaid) {
          await this.updatePaymentStatus(sale.id, true, sale.voucher_code, sale.telefone);
          console.log(`✓ Venda #${sale.id} (${sale.voucher_code}) marcada como PAGA`);
          updated++;
        } else if (!result.success) {
          errors++;
        }

        // Pequeno delay entre requisições para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[${new Date().toISOString()}] Verificação concluída: ${updated} atualizadas, ${errors} erros.`);
      
      return { total: pendingPayments.length, updated, errors };
    } catch (error) {
      console.error('Erro na verificação de pagamentos:', error);
      throw error;
    }
  }
};

module.exports = paymentVerificationService;
