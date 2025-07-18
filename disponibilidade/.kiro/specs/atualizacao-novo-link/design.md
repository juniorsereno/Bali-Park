# Design Document

## Overview

Esta atualização modifica a automação existente do Bali Park para trabalhar com a nova estrutura HTML do calendário. A principal mudança é a migração de seletores CSS específicos e a simplificação da lógica de captura, removendo dependências de estruturas antigas como `calendarArray` e focando exclusivamente na extração de dados do DOM.

## Architecture

A arquitetura geral da aplicação permanece inalterada, mantendo:
- Classe principal `BaliParkDisponibilidade`
- Fluxo de execução: iniciar → aguardar calendário → capturar disponibilidades → salvar dados
- Estrutura de dados de saída idêntica
- Sistema de webhook e relatórios

### Principais Mudanças Arquiteturais

1. **Simplificação da Captura**: Remoção da lógica dual (DOM + calendarArray) em favor de uma abordagem única baseada no DOM
2. **Atualização de Seletores**: Migração completa para os novos seletores CSS
3. **Manutenção da Interface**: Preservação da API pública e formato de dados

## Components and Interfaces

### Componentes Afetados

#### 1. Método `iniciar()`
- **Mudança**: Atualização da URL de navegação
- **Impacto**: Baixo - apenas alteração de string

#### 2. Método `aguardarCalendario()`
- **Mudança**: Substituição do seletor `.calendario-aberto` por `form#calendar`
- **Remoção**: Lógica de verificação do `calendarArray`
- **Impacto**: Médio - simplificação significativa

#### 3. Método `capturarMesAtual()`
- **Mudança**: Remoção completa da lógica de fallback
- **Simplificação**: Uso exclusivo do método `capturarDadosDOM()`
- **Impacto**: Alto - simplificação drástica do código

#### 4. Método `capturarDadosDOM()`
- **Mudança**: Atualização completa dos seletores CSS
- **Novos Seletores**:
  - Container: `form#calendar`
  - Cabeçalho do mês: `.current`
  - Dias disponíveis: `.dateValue:not(.disabled)`
  - Dias indisponíveis: `.disabled`
  - Dia: `.dateValueDay`
  - Preço: `.dateValuePrice`
- **Impacto**: Alto - reescrita completa da lógica de extração

#### 5. Método `navegarProximoMes()`
- **Mudança**: Atualização dos seletores de navegação
- **Novos Seletores**:
  - Botão próximo: `.next`
  - Botão anterior: `.previous`
  - Cabeçalho: `.current`
- **Impacto**: Médio - atualização de seletores

### Interfaces Mantidas

- **Estrutura de Dados de Saída**: Formato JSON permanece idêntico
- **Webhook Payload**: Estrutura de envio inalterada
- **API Pública**: Métodos públicos mantêm assinatura
- **Configurações**: Tabela de referência e configurações gerais preservadas

## Data Models

### Estrutura HTML Nova (Entrada)

```html
<form id="calendar">
  <div class="picker form">
    <div class="head">
      <div class="current">Julho 2025</div>
      <div class="nav">
        <button class="previous">...</button>
        <button class="next">...</button>
      </div>
    </div>
    <div class="container">
      <div class="month">
        <div class="days">
          <!-- Dia disponível -->
          <div class="dateValue" day="17">
            <span class="dateValueDay">17</span>
            <span class="dateValuePrice"> R$150.00</span>
          </div>
          <!-- Dia indisponível -->
          <div class="disabled" day="1">
            <span class="dateValueDay">1</span>
            <span class="dateValuePrice empty"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</form>
```

### Mapeamento de Seletores

| Função | Seletor Antigo | Seletor Novo |
|--------|----------------|--------------|
| Container Principal | `.calendario-aberto` | `form#calendar` |
| Cabeçalho do Mês | `#currentMonth-1` | `.current` |
| Dias Disponíveis | `.daysOpen` | `.dateValue:not(.disabled)` |
| Dias Indisponíveis | `.daysClose` | `.disabled` |
| Número do Dia | `span:first-child` | `.dateValueDay` |
| Valor do Ingresso | `.spanValue` | `.dateValuePrice` |
| Botão Próximo Mês | `#nextMonth-1` | `.next` |
| Botão Mês Anterior | `#prevMonth-1` | `.previous` |

### Estrutura de Dados de Saída (Mantida)

```javascript
{
  data: "2025-07-17",           // ISO date string
  valor_adulto: 150.00,         // Preço adulto extraído
  valor_infantil: 75.00,        // Preço infantil (tabela referência)
  disponivel: true,             // Boolean baseado na classe CSS
  mesAno: "Julho 2025"          // String do cabeçalho
}
```

## Error Handling

### Estratégias de Tratamento de Erro

#### 1. Aguardar Calendário
- **Erro**: Formulário não encontrado
- **Tratamento**: Retry com reload da página (máximo 3 tentativas)
- **Fallback**: Captura de screenshot e erro detalhado

#### 2. Captura de Dados
- **Erro**: Seletores não encontrados
- **Tratamento**: Log de aviso e continuação com array vazio
- **Fallback**: Captura de screenshot para debug

#### 3. Navegação Entre Meses
- **Erro**: Botão de navegação não responsivo
- **Tratamento**: Tentativa com JavaScript direto
- **Fallback**: Captura de screenshot e interrupção controlada

#### 4. Parsing de Valores
- **Erro**: Formato de preço inesperado
- **Tratamento**: Valor padrão 0 e log de aviso
- **Fallback**: Continuação do processamento

### Logs e Debugging

- **Logs Detalhados**: Cada etapa da captura será logada
- **Screenshots Automáticos**: Em caso de erro, captura automática
- **Validação de Dados**: Verificação de integridade antes do salvamento

## Testing Strategy

### Testes de Unidade

#### 1. Parsing de Dados
```javascript
// Teste de extração de preços
testParsingPreco("R$150.00") → 150.00
testParsingPreco(" R$95.00") → 95.00
testParsingPreco("empty") → 0

// Teste de parsing de mês/ano
testParsingMesAno("Julho 2025") → [6, 2025]
testParsingMesAno("Janeiro 2026") → [0, 2026]
```

#### 2. Seletores CSS
```javascript
// Verificar se seletores retornam elementos esperados
testSeletor("form#calendar") → deve existir
testSeletor(".current") → deve conter texto de mês
testSeletor(".dateValue") → deve retornar array de dias
```

### Testes de Integração

#### 1. Fluxo Completo
- Navegação para URL
- Aguardar carregamento do calendário
- Captura de dados de um mês
- Navegação para próximo mês
- Validação de dados capturados

#### 2. Cenários de Erro
- Página não carrega
- Calendário não aparece
- Botões de navegação não funcionam
- Dados malformados

### Testes de Regressão

#### 1. Compatibilidade de Dados
- Formato de saída idêntico ao anterior
- Webhook payload inalterado
- Estrutura de arquivos JSON mantida

#### 2. Performance
- Tempo de execução similar ou melhor
- Uso de memória otimizado
- Estabilidade em execuções longas

### Estratégia de Validação

#### 1. Validação de Ambiente
- Verificar se Playwright está funcionando
- Testar conectividade com a nova URL
- Validar estrutura HTML esperada

#### 2. Validação de Dados
- Verificar se datas estão no futuro
- Validar formato de preços
- Confirmar aplicação da tabela de referência

#### 3. Validação de Saída
- Verificar integridade do JSON
- Confirmar envio para webhook
- Validar limpeza de arquivos antigos

## Implementation Notes

### Ordem de Implementação Recomendada

1. **Atualização de Constantes**: URL e seletores básicos
2. **Método aguardarCalendario()**: Novo seletor principal
3. **Método capturarDadosDOM()**: Nova lógica de extração
4. **Método navegarProximoMes()**: Novos seletores de navegação
5. **Simplificação capturarMesAtual()**: Remoção de código obsoleto
6. **Testes e Validação**: Verificação completa do fluxo

### Considerações de Performance

- **Redução de Complexidade**: Remoção da lógica dual melhora performance
- **Seletores Otimizados**: Uso de IDs e classes específicas
- **Menos Verificações**: Eliminação de fallbacks desnecessários

### Backward Compatibility

- **Dados de Saída**: 100% compatível
- **Configurações**: Tabela de referência mantida
- **Webhook**: Payload idêntico
- **Arquivos**: Formato e nomenclatura preservados