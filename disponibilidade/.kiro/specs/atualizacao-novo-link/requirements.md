# Requirements Document

## Introduction

Esta especificação define os requisitos para atualizar a automação de captura de disponibilidades do Bali Park para utilizar o novo link (https://loja.multiclubes.com.br/balipark/Ingressos/CP0014?Promoter=aWFmSjE1SnI3MW8vRzN0RlI0WjVDZz09) e adaptar-se à nova estrutura HTML do calendário. A nova estrutura utiliza um formulário com elementos diferentes dos seletores atuais, requerendo uma atualização completa dos seletores e lógica de captura.

## Requirements

### Requirement 1

**User Story:** Como desenvolvedor da automação, eu quero atualizar o link de acesso para o novo endpoint, para que a automação continue funcionando com a nova URL do sistema.

#### Acceptance Criteria

1. WHEN a automação for iniciada THEN o sistema SHALL navegar para https://loja.multiclubes.com.br/balipark/Ingressos/CP0014?Promoter=aWFmSjE1SnI3MW8vRzN0RlI0WjVDZz09
2. WHEN o sistema acessar a nova URL THEN o sistema SHALL aguardar o carregamento completo da página
3. WHEN a página for carregada THEN o sistema SHALL verificar se o formulário do calendário está presente

### Requirement 2

**User Story:** Como desenvolvedor da automação, eu quero atualizar os seletores CSS para a nova estrutura HTML, para que a captura de dados funcione corretamente com os novos elementos.

#### Acceptance Criteria

1. WHEN o sistema buscar o container do calendário THEN o sistema SHALL utilizar o seletor 'form#calendar' ao invés de '.calendario-aberto'
2. WHEN o sistema buscar o cabeçalho do mês THEN o sistema SHALL utilizar o seletor '.current' dentro do formulário
3. WHEN o sistema buscar dias disponíveis THEN o sistema SHALL utilizar o seletor '.dateValue' ao invés de '.daysOpen'
4. WHEN o sistema buscar dias indisponíveis THEN o sistema SHALL utilizar o seletor '.disabled' ao invés de '.daysClose'
5. WHEN o sistema buscar botões de navegação THEN o sistema SHALL utilizar os seletores '.previous' e '.next' dentro de '.nav'

### Requirement 3

**User Story:** Como desenvolvedor da automação, eu quero adaptar a lógica de extração de dados para a nova estrutura HTML, para que os valores e datas sejam capturados corretamente.

#### Acceptance Criteria

1. WHEN o sistema extrair o dia THEN o sistema SHALL buscar o texto dentro de '.dateValueDay'
2. WHEN o sistema extrair o preço THEN o sistema SHALL buscar o texto dentro de '.dateValuePrice'
3. WHEN o sistema encontrar um preço THEN o sistema SHALL remover o prefixo 'R$' e converter para número
4. WHEN o sistema encontrar um elemento '.disabled' THEN o sistema SHALL marcar como indisponível
5. WHEN o sistema encontrar um elemento '.dateValue' sem classe '.disabled' THEN o sistema SHALL marcar como disponível

### Requirement 4

**User Story:** Como desenvolvedor da automação, eu quero manter a funcionalidade de navegação entre meses, para que a captura de múltiplos meses continue funcionando.

#### Acceptance Criteria

1. WHEN o sistema precisar navegar para o próximo mês THEN o sistema SHALL clicar no botão '.next' dentro de '.nav'
2. WHEN o sistema precisar navegar para o mês anterior THEN o sistema SHALL clicar no botão '.previous' dentro de '.nav'
3. WHEN a navegação for executada THEN o sistema SHALL aguardar a atualização do texto em '.current'
4. WHEN a navegação falhar THEN o sistema SHALL tentar uma abordagem alternativa com JavaScript

### Requirement 5

**User Story:** Como desenvolvedor da automação, eu quero manter a compatibilidade com a estrutura de dados existente, para que o resto do sistema continue funcionando sem alterações.

#### Acceptance Criteria

1. WHEN os dados forem processados THEN o sistema SHALL manter o formato de saída atual (data, valor_adulto, valor_infantil, disponivel, mesAno)
2. WHEN os valores forem capturados THEN o sistema SHALL continuar aplicando a tabela de referência para valores infantis
3. WHEN os dados forem salvos THEN o sistema SHALL manter o formato JSON atual
4. WHEN os dados forem enviados para o webhook THEN o sistema SHALL manter a estrutura de payload atual

### Requirement 6

**User Story:** Como desenvolvedor da automação, eu quero remover dependências do código antigo, para que não haja conflitos ou tentativas de usar seletores obsoletos.

#### Acceptance Criteria

1. WHEN o sistema for atualizado THEN o sistema SHALL remover todas as referências a 'calendarArray'
2. WHEN o sistema for atualizado THEN o sistema SHALL remover seletores CSS obsoletos como '.calendario-aberto', '.daysOpen', '.daysClose'
3. WHEN o sistema for atualizado THEN o sistema SHALL remover lógica de fallback para estruturas HTML antigas
4. WHEN o sistema for atualizado THEN o sistema SHALL simplificar o método 'capturarMesAtual' para usar apenas a nova estrutura