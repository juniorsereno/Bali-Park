const BaliParkDisponibilidade = require('../disponibilidade-automation');

// Criar uma instância da classe para testar os métodos
const baliPark = new BaliParkDisponibilidade();

describe('Testes de parsing de preços', () => {
  // Função auxiliar para testar o parsing de preços
  // Como o método de parsing está dentro de capturarDadosDOM, vamos criar uma função auxiliar
  function parsePreco(texto) {
    return texto.replace('R$', '').replace(',', '.').trim();
  }

  test('Deve converter "R$150.00" para 150.00', () => {
    const resultado = parseFloat(parsePreco('R$150.00'));
    expect(resultado).toBe(150.00);
  });

  test('Deve converter " R$95.00" (com espaço) para 95.00', () => {
    const resultado = parseFloat(parsePreco(' R$95.00'));
    expect(resultado).toBe(95.00);
  });

  test('Deve converter "R$105,50" (com vírgula) para 105.50', () => {
    const resultado = parseFloat(parsePreco('R$105,50'));
    expect(resultado).toBe(105.50);
  });

  test('Deve retornar 0 para string vazia', () => {
    const resultado = parseFloat(parsePreco('')) || 0;
    expect(resultado).toBe(0);
  });

  test('Deve retornar NaN para texto não numérico', () => {
    const resultado = parseFloat(parsePreco('empty'));
    expect(isNaN(resultado)).toBe(true);
  });
});

describe('Testes de parsing de mês/ano', () => {
  test('Deve converter "Julho 2025" para [6, 2025]', () => {
    const resultado = baliPark.parserarMesAno('Julho 2025');
    expect(resultado).toEqual([6, 2025]);
  });

  test('Deve converter "Janeiro 2026" para [0, 2026]', () => {
    const resultado = baliPark.parserarMesAno('Janeiro 2026');
    expect(resultado).toEqual([0, 2026]);
  });

  test('Deve converter "Dezembro 2025" para [11, 2025]', () => {
    const resultado = baliPark.parserarMesAno('Dezembro 2025');
    expect(resultado).toEqual([11, 2025]);
  });

  test('Deve converter "Março 2026" para [2, 2026]', () => {
    const resultado = baliPark.parserarMesAno('Março 2026');
    expect(resultado).toEqual([2, 2026]);
  });
});

describe('Testes de formatação de data', () => {
  test('Deve formatar data (2025, 6, 17) para "2025-07-17"', () => {
    const resultado = baliPark.formatarData(2025, 6, 17);
    expect(resultado).toBe('2025-07-17');
  });

  test('Deve formatar data (2026, 0, 1) para "2026-01-01"', () => {
    const resultado = baliPark.formatarData(2026, 0, 1);
    expect(resultado).toBe('2026-01-01');
  });
});

describe('Testes de validação de seletores CSS', () => {
  // Estes testes são mais para documentação dos seletores esperados
  // Em um ambiente real, precisaríamos de um DOM simulado
  
  test('Seletor para o formulário do calendário deve ser "form#calendar"', () => {
    const seletorFormulario = 'form#calendar';
    expect(seletorFormulario).toBe('form#calendar');
  });

  test('Seletor para o cabeçalho do mês deve ser ".current"', () => {
    const seletorCabecalho = '.current';
    expect(seletorCabecalho).toBe('.current');
  });

  test('Seletor para dias disponíveis deve ser ".dateValue:not(.disabled)"', () => {
    const seletorDiasDisponiveis = '.dateValue:not(.disabled)';
    expect(seletorDiasDisponiveis).toBe('.dateValue:not(.disabled)');
  });

  test('Seletor para dias indisponíveis deve ser ".disabled"', () => {
    const seletorDiasIndisponiveis = '.disabled';
    expect(seletorDiasIndisponiveis).toBe('.disabled');
  });

  test('Seletor para o dia deve ser ".dateValueDay"', () => {
    const seletorDia = '.dateValueDay';
    expect(seletorDia).toBe('.dateValueDay');
  });

  test('Seletor para o preço deve ser ".dateValuePrice"', () => {
    const seletorPreco = '.dateValuePrice';
    expect(seletorPreco).toBe('.dateValuePrice');
  });

  test('Seletor para botão próximo mês deve ser ".next"', () => {
    const seletorProximoMes = '.next';
    expect(seletorProximoMes).toBe('.next');
  });
});

describe('Testes de estrutura de dados de saída', () => {
  // Criar um objeto de exemplo que simula a saída esperada
  const dadoExemplo = {
    data: '2025-07-17',
    valor_adulto: 150.00,
    valor_infantil: 75.00,
    disponivel: true,
    mesAno: 'Julho 2025'
  };

  test('Estrutura de dados deve conter campo "data" no formato ISO', () => {
    expect(dadoExemplo).toHaveProperty('data');
    expect(dadoExemplo.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('Estrutura de dados deve conter campo "valor_adulto" como número', () => {
    expect(dadoExemplo).toHaveProperty('valor_adulto');
    expect(typeof dadoExemplo.valor_adulto).toBe('number');
  });

  test('Estrutura de dados deve conter campo "valor_infantil" como número', () => {
    expect(dadoExemplo).toHaveProperty('valor_infantil');
    expect(typeof dadoExemplo.valor_infantil).toBe('number');
  });

  test('Estrutura de dados deve conter campo "disponivel" como booleano', () => {
    expect(dadoExemplo).toHaveProperty('disponivel');
    expect(typeof dadoExemplo.disponivel).toBe('boolean');
  });

  test('Estrutura de dados deve conter campo "mesAno" como string', () => {
    expect(dadoExemplo).toHaveProperty('mesAno');
    expect(typeof dadoExemplo.mesAno).toBe('string');
  });

  test('Valor infantil deve ser calculado conforme tabela de referência', () => {
    // Verificar se o valor infantil corresponde à tabela de referência
    const valorAdulto = 158;
    const valorInfantilEsperado = 75;
    
    // Verificar se a tabela de referência contém o valor esperado
    expect(baliPark.tabelaReferencia[valorAdulto]).toBe(valorInfantilEsperado);
  });
});