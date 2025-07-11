# 📅 Automação de Disponibilidade - Bali Park

Esta automação captura as disponibilidades e valores do calendário do site oficial do Bali Park (https://balipark.com.br/).

## 🎯 Objetivo

Automatizar a captura de dados de disponibilidade e preços do Bali Park para os próximos 6 meses, salvando os resultados em formato JSON e CSV para análise.

## 📋 Funcionalidades

- ✅ Acessa automaticamente o site oficial do Bali Park
- ✅ Aguarda o carregamento completo do calendário
- ✅ Captura dados de disponibilidade e preços de 6 meses consecutivos
- ✅ Extrai informações tanto do script quanto do DOM
- ✅ Navega automaticamente entre os meses
- ✅ Salva dados em formato JSON estruturado
- ✅ Gera arquivo CSV para análise em planilhas
- ✅ Organiza dados por mês com estatísticas
- ✅ Captura screenshots em caso de erro

## 🛠️ Instalação

### Pré-requisitos
- Node.js 16+ instalado
- Windows/Linux/macOS

### Passos de Instalação

1. **Navegue para a pasta disponibilidade:**
   ```bash
   cd disponibilidade
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Instale os navegadores do Playwright:**
   ```bash
   npx playwright install
   ```

## 🚀 Como Usar

### Execução Simples
```bash
npm start
```

### Execução Direta
```bash
node disponibilidade-automation.js
```

## 📊 Dados Capturados

### Informações por Data
- **Data**: Data no formato ISO (YYYY-MM-DD)
- **Valor**: Preço do ingresso em reais
- **Disponível**: Se a data está disponível para visita
- **Mês/Ano**: Mês e ano de referência

### Estatísticas por Mês
- Total de datas no mês
- Datas disponíveis vs indisponíveis
- Valor mínimo, máximo e médio
- Lista completa de datas

## 📁 Arquivos de Saída

### JSON (Completo)
```
disponibilidade-balipark-[timestamp].json
```
Contém:
- Timestamp da execução
- Resumo estatístico
- Dados brutos de todas as datas
- Dados organizados por mês

### CSV (Simplificado)
```
disponibilidade-balipark-[timestamp].csv
```
Formato de colunas:
```
Data,Valor,Disponivel,MesAno
2025-07-02,105.00,Sim,Julho 2025
2025-07-03,105.00,Sim,Julho 2025
```

## ⚙️ Configurações

### Alterar Quantidade de Meses
No arquivo `disponibilidade-automation.js`, linha 9:
```javascript
this.metaMeses = 6; // Altere para o número desejado
```

### Modo Headless
No arquivo, linha 21:
```javascript
headless: false, // Altere para true para executar sem interface
```

## 🔍 Exemplo de Dados JSON

```json
{
  "timestamp": "2025-01-07T20:07:00.000Z",
  "resumo": {
    "totalDatas": 156,
    "mesesCapturados": 6,
    "datasDisponiveis": 120,
    "datasIndisponiveis": 36
  },
  "dadosOrganizados": {
    "Julho 2025": {
      "mes": "Julho 2025",
      "totalDatas": 26,
      "datasDisponiveis": 20,
      "datasIndisponiveis": 6,
      "valorMinimo": 95.00,
      "valorMaximo": 126.00,
      "valorMedio": 107.50
    }
  }
}
```

## 🐛 Solução de Problemas

### Erro de Timeout
- Verifique sua conexão com a internet
- O site pode estar lento, aguarde alguns minutos

### Calendário não encontrado
- Verifique se o site está acessível
- A estrutura do site pode ter mudado

### Navegadores não instalados
```bash
npx playwright install chromium
```

## 📝 Logs da Execução

A automação mostra logs detalhados:
```
🚀 Iniciando automação de captura de disponibilidades do Bali Park...
📍 Acessando https://balipark.com.br/
⏳ Aguardando calendário carregar...
✅ Calendário carregado!
📅 Iniciando captura de disponibilidades...
📊 Capturando mês 1/6...
✅ Mês 1 capturado: 26 datas encontradas
➡️ Navegando para o próximo mês...
```

## 🔧 Manutenção

### Atualizações do Site
Se o site do Bali Park alterar a estrutura do calendário, pode ser necessário atualizar os seletores:

- `.calendario-aberto` - Container principal do calendário
- `#currentMonth-1` - Título do mês atual
- `#nextMonth-1` - Botão próximo mês
- `.daysOpen` - Dias disponíveis
- `.daysClose` - Dias indisponíveis
- `.spanValue` - Container do valor

### Dependências
```json
{
  "playwright": "^1.53.2"
}
```

## 🎯 Casos de Uso

- **Análise de Preços**: Identificar padrões de preços ao longo dos meses
- **Planejamento de Visitas**: Encontrar datas mais baratas
- **Monitoramento**: Acompanhar mudanças de disponibilidade
- **Relatórios**: Gerar relatórios de disponibilidade

## ⚠️ Aviso Legal

Esta automação é para uso educacional e pessoal. Respeite os termos de uso do site do Bali Park e não faça uso excessivo que possa sobrecarregar seus servidores.

## 🤝 Contribuição

Para melhorar esta automação:
1. Identifique problemas ou melhorias
2. Teste alterações localmente
3. Documente mudanças

---

**Desenvolvido para capturar dados de disponibilidade do Bali Park de forma automatizada e organizada.** 