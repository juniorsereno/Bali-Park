# Implementation Plan

- [x] 1. Atualizar URL de navegação e configurações básicas




  - Modificar a URL no método `iniciar()` para o novo endpoint
  - Atualizar comentários e logs relacionados à URL
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Atualizar método aguardarCalendario() para nova estrutura HTML





  - Substituir seletor `.calendario-aberto` por `form#calendar`
  - Remover verificação do `calendarArray` e lógica relacionada
  - Atualizar verificação de elementos do calendário para usar `.dateValue` e `.disabled`
  - Simplificar lógica de retry removendo dependências obsoletas
  - _Requirements: 2.1, 6.1, 6.3_

- [x] 3. Reescrever método capturarDadosDOM() com novos seletores








  - Atualizar captura do cabeçalho do mês para usar `.current`
  - Implementar nova lógica para capturar dias disponíveis usando `.dateValue:not(.disabled)`
  - Implementar nova lógica para capturar dias indisponíveis usando `.disabled`
  - Atualizar extração do número do dia para usar `.dateValueDay`
  - Atualizar extração de preços para usar `.dateValuePrice`
  - Implementar parsing de preços removendo prefixo "R$" e convertendo para número
  - _Requirements: 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Atualizar método navegarProximoMes() com novos seletores de navegação





  - Substituir seletor `#nextMonth-1` por `.next`
  - Atualizar captura do mês atual para usar `.current`
  - Atualizar verificação de mudança de mês para usar `.current`
  - Manter lógica de fallback com JavaScript mas usando novos seletores
  - _Requirements: 4.1, 4.3, 2.5_

- [x] 5. Simplificar método capturarMesAtual() removendo código obsoleto





  - Remover completamente a lógica de fallback para `calendarArray`
  - Remover método `processarDadosScriptMesAtual()`
  - Simplificar para usar apenas `capturarDadosDOM()`
  - Atualizar tratamento de erros para nova estrutura simplificada
  - _Requirements: 6.1, 6.3, 6.4_

- [x] 6. Remover métodos e variáveis obsoletas










  - Remover método `processarDadosScriptMesAtual()` se não removido na tarefa anterior
  - Remover todas as referências a `calendarArray` em comentários e logs
  - Limpar imports ou dependências não utilizadas
  - Atualizar mensagens de log para refletir nova estrutura
  - _Requirements: 6.1, 6.2, 6.4_

- [x] 7. Implementar testes unitários para parsing de dados





  - Criar testes para parsing de preços com formato "R$XXX.XX"
  - Criar testes para parsing de mês/ano do formato "Mês YYYY"
  - Criar testes para validação de seletores CSS
  - Implementar testes para verificar estrutura de dados de saída
  - _Requirements: 5.1, 5.2_

- [x] 8. Testar integração completa com nova estrutura





  - Executar automação completa com novo link
  - Verificar captura de dados de múltiplos meses
  - Validar navegação entre meses
  - Confirmar formato de dados de saída mantido
  - Testar envio para webhook com dados capturados
  - _Requirements: 5.3, 5.4_

- [ ] 9. Implementar tratamento de erros específico para nova estrutura
  - Adicionar validação específica para elementos `form#calendar`
  - Implementar logs detalhados para debugging da nova estrutura
  - Adicionar captura de screenshots em pontos críticos
  - Implementar validação de dados antes do processamento
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 10. Validar compatibilidade e realizar testes de regressão
  - Executar bateria de testes comparando saída antiga vs nova
  - Verificar se tabela de referência continua sendo aplicada corretamente
  - Confirmar que formato JSON de saída permanece idêntico
  - Testar cenários de erro e recuperação
  - Validar performance e estabilidade da nova implementação
  - _Requirements: 5.1, 5.2, 5.3, 5.4_