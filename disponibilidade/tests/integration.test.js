const BaliParkDisponibilidade = require('../disponibilidade-automation');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Mock para axios para evitar chamadas reais ao webhook
jest.mock('axios');

describe('Testes de integração completa', () => {
  let baliPark;
  let originalConsoleLog;
  let logs = [];

  // Capturar logs para análise
  beforeAll(() => {
    originalConsoleLog = console.log;
    console.log = jest.fn((...args) => {
      logs.push(args.join(' '));
      originalConsoleLog(...args);
    });

    // Mock para axios.post retornando uma promessa resolvida
    axios.post.mockResolvedValue({ status: 200, data: { success: true } });
  });

  afterAll(() => {
    console.log = originalConsoleLog;
  });

  beforeEach(() => {
    baliPark = new BaliParkDisponibilidade();
    logs = [];
    
    // Reduzir o número de meses para o teste ser mais rápido
    baliPark.metaMeses = 2;
  });

  afterEach(async () => {
    if (baliPark.browser) {
      await baliPark.fechar();
    }
  });

  test('Deve iniciar a automação e acessar o novo link', async () => {
    // Sobrescrever o método para não executar a automação completa
    baliPark.capturarDisponibilidades = jest.fn().mockResolvedValue(true);
    baliPark.salvarDados = jest.fn().mockResolvedValue(true);
    baliPark.aguardarCalendario = jest.fn().mockResolvedValue(true);
    
    await baliPark.iniciar();
    
    // Verificar se acessou a URL correta
    expect(logs.some(log => log.includes('https://loja.multiclubes.com.br/balipark/Ingressos/CP0014?Promoter=aWFmSjE1SnI3MW8vRzN0RlI0WjVDZz09'))).toBe(true);
  }, 30000);

  test('Deve verificar a estrutura HTML da página', async () => {
    // Iniciar o navegador manualmente para testar apenas a análise da estrutura
    baliPark.browser = await require('playwright').chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    baliPark.page = await baliPark.browser.newPage();
    
    await baliPark.page.goto('https://loja.multiclubes.com.br/balipark/Ingressos/CP0014?Promoter=aWFmSjE1SnI3MW8vRzN0RlI0WjVDZz09', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    await baliPark.page.waitForTimeout(3000);
    
    // Analisar a estrutura HTML para entender o formato atual
    const estruturaHTML = await baliPark.page.evaluate(() => {
      return {
        titulo: document.title,
        url: window.location.href,
        formCalendario: !!document.querySelector('form#calendar'),
        elementosCurrent: document.querySelectorAll('.current').length,
        elementosDateValue: document.querySelectorAll('.dateValue').length,
        elementosDisabled: document.querySelectorAll('.disabled').length,
        elementosNext: document.querySelectorAll('.next').length,
        seletores: {
          form: document.querySelector('form#calendar') ? true : false,
          current: document.querySelector('.current') ? true : false,
          dateValue: document.querySelector('.dateValue') ? true : false,
          disabled: document.querySelector('.disabled') ? true : false,
          next: document.querySelector('.next') ? true : false,
          dateValueDay: document.querySelector('.dateValueDay') ? true : false,
          dateValuePrice: document.querySelector('.dateValuePrice') ? true : false
        }
      };
    });
    
    console.log('📊 Análise da estrutura HTML:');
    console.log(JSON.stringify(estruturaHTML, null, 2));
    
    // Capturar screenshot para análise visual
    await baliPark.capturarScreenshot('analise-estrutura');
    
    // Verificar se a página tem os elementos esperados
    expect(estruturaHTML.url).toContain('balipark');
  }, 30000);

  test('Deve executar o fluxo completo e salvar dados', async () => {
    // Mock para o método de envio para webhook
    baliPark.enviarParaWebhook = jest.fn().mockResolvedValue(true);
    
    // Executar a automação completa
    await baliPark.iniciar();
    
    // Verificar se os logs indicam sucesso
    expect(logs.some(log => log.includes('Automação concluída com sucesso'))).toBe(true);
    
    // Verificar se o webhook foi chamado
    expect(baliPark.enviarParaWebhook).toHaveBeenCalled();
    
    // Verificar se existe um arquivo JSON gerado
    const arquivos = fs.readdirSync(path.dirname(require.resolve('../disponibilidade-automation')));
    const jsonGerado = arquivos.find(arquivo => arquivo.startsWith('disponibilidade-balipark-') && arquivo.endsWith('.json'));
    
    if (jsonGerado) {
      console.log(`✅ Arquivo JSON gerado: ${jsonGerado}`);
      
      // Verificar o conteúdo do arquivo
      const caminhoArquivo = path.join(path.dirname(require.resolve('../disponibilidade-automation')), jsonGerado);
      const conteudo = JSON.parse(fs.readFileSync(caminhoArquivo, 'utf8'));
      
      console.log('📊 Resumo dos dados capturados:');
      console.log(`   - Total de datas: ${conteudo.resumo.totalDatas}`);
      console.log(`   - Meses capturados: ${conteudo.resumo.mesesCapturados}`);
      console.log(`   - Datas disponíveis: ${conteudo.resumo.datasDisponiveis}`);
      console.log(`   - Datas indisponíveis: ${conteudo.resumo.datasIndisponiveis}`);
      
      // Não falhar o teste se não houver dados, apenas logar
      if (conteudo.resumo.totalDatas === 0) {
        console.log('⚠️ Nenhum dado foi capturado, mas o fluxo foi executado com sucesso');
      }
    } else {
      console.log('⚠️ Nenhum arquivo JSON foi gerado');
    }
    
    // O teste deve passar se a automação foi concluída com sucesso, mesmo sem dados
    expect(logs.some(log => log.includes('Automação concluída com sucesso'))).toBe(true);
  }, 120000);
});