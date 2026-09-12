const axios = require("axios");
const db = require("../database");

const SOAP_URL =
  process.env.MULTICLUBES_SOAP_URL ||
  "https://multiclubes.balipark.com.br/(a655f81b-8437-48ec-8876-069664ee891a)/TicketsV2.svc";
const SOAP_ACTION =
  "http://multiclubes.com.br/tickets/v2/IService/SearchVoucher";
const AUTH_KEY = process.env.MULTICLUBES_AUTH_KEY;

const paymentVerificationService = {
  /**
   * Monta o envelope SOAP para consulta de voucher
   */
  buildSoapEnvelope(voucherCode) {
    if (!AUTH_KEY?.trim()) throw new Error("Configure MULTICLUBES_AUTH_KEY.");
    voucherCode = String(voucherCode).replace(
      /[<>&\"']/g,
      (character) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '\"': "&quot;",
          "'": "&apos;",
        })[character],
    );
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
      const response = await axios.post(
        SOAP_URL,
        this.buildSoapEnvelope(voucherCode),
        {
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: SOAP_ACTION,
          },
          timeout: 30000,
        },
      );

      const xml = response.data;

      // Extrair VoucherStatus do XML de resposta
      const statusMatch = xml.match(/<VoucherStatus>([^<]+)<\/VoucherStatus>/);
      const status = statusMatch ? statusMatch[1] : null;

      return {
        success: true,
        voucherCode,
        status,
        isPaid: status === "AccessReady",
      };
    } catch (error) {
      console.error(`Erro ao verificar voucher ${voucherCode}:`, error.message);
      return {
        success: false,
        voucherCode,
        error: error.message,
        isPaid: false,
      };
    }
  },

  /**
   * Busca vendas não pagas com menos de 3 dias de criação
   */
  async getPendingPayments() {
    const query = `
      SELECT id, voucher_code
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
  async updatePaymentStatus(id, paid) {
    const query = `
      UPDATE bali_park.vendas
      SET paid = $1
      WHERE id = $2
    `;

    await db.query(query, [paid, id]);
  },

  /**
   * Executa a verificação de todas as vendas pendentes
   */
  async runVerification() {
    console.log(
      `[${new Date().toISOString()}] Iniciando verificação de pagamentos...`,
    );

    try {
      const pendingPayments = await this.getPendingPayments();
      console.log(
        `Encontradas ${pendingPayments.length} vendas pendentes para verificar.`,
      );

      let updated = 0;
      let errors = 0;

      for (const sale of pendingPayments) {
        const result = await this.checkVoucherStatus(sale.voucher_code);

        if (result.success && result.isPaid) {
          await this.updatePaymentStatus(sale.id, true);
          console.log(
            `✓ Venda #${sale.id} (${sale.voucher_code}) marcada como PAGA`,
          );
          updated++;
        } else if (!result.success) {
          errors++;
        }

        // Pequeno delay entre requisições para não sobrecarregar a API
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log(
        `[${new Date().toISOString()}] Verificação concluída: ${updated} atualizadas, ${errors} erros.`,
      );

      return { total: pendingPayments.length, updated, errors };
    } catch (error) {
      console.error("Erro na verificação de pagamentos:", error);
      throw error;
    }
  },
};

module.exports = paymentVerificationService;
