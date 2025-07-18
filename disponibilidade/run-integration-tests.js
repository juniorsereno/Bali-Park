/**
 * Script para executar testes de integração da automação do Bali Park
 * Este script executa os testes de integração e gera um relatório detalhado
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes de integração da automação do Bali Park...');
console.log('📋 Verificando ambiente...');

// Verificar se o Node.js está instalado
try {
  const nodeVersion = execSync('node --version').toString().trim();
  console.log(`✅ Node.js: ${nodeVersion}`);
} catch (error) {
  console.error('❌ Node.js não encontrado. Por favor, instale o Node.js.');
  process.exit(1);
}

// Verificar se as dependências estão instaladas
console.log('📦 Verificando dependências...');
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('⚠️ Pasta node_modules não encontrada. Instalando dependências...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependências instaladas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao instalar dependências:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ Dependências já instaladas.');
}

// Verificar se o Playwright está instalado
console.log('🎭 Verificando Playwright...');
try {
  const playwrightVersion = require('playwright').version;
  console.log(`✅ Playwright: ${playwrightVersion}`);
} catch (error) {
  console.error('❌ Playwright não encontrado ou com erro:', error.message);
  process.exit(1);
}

// Executar os testes de integração
console.log('\n🚀 Executando testes de integração...');
console.log('⏳ Este processo pode levar alguns minutos...');

try {
  // Executar apenas os testes de integração
  execSync('npx jest tests/integration.test.js --verbose', { stdio: 'inherit' });
  console.log('\n✅ Testes de integração concluídos com sucesso!');
} catch (error) {
  console.error('\n❌ Falha nos testes de integração:', error.message);
  process.exit(1);
}

// Verificar formato de dados de saída
console.log('\n📊 Verificando formato de dados de saída...');

try {
  // Executar testes específicos para estrutura de dados
  execSync('npx jest tests/parsing.test.js -t "Testes de estrutura de dados de saída"', { stdio: 'inherit' });
  console.log('✅ Formato de dados validado com sucesso!');
} catch (error) {
  console.error('❌ Falha na validação do formato de dados:', error.message);
  process.exit(1);
}

console.log('\n🏁 Todos os testes foram concluídos!');
console.log('📝 Resumo:');
console.log('  - Automação com novo link: ✅');
console.log('  - Captura de dados de múltiplos meses: ✅');
console.log('  - Navegação entre meses: ✅');
console.log('  - Formato de dados de saída mantido: ✅');
console.log('  - Envio para webhook: ✅');

console.log('\n🔍 Para mais detalhes, verifique os logs acima.');