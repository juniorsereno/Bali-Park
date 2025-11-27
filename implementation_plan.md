# Plano de Implementação - Dashboard Comercial Bali Park

## 1. Estrutura do Projeto (Node.js + Express)

```text
/bali-park-dashboard
├── package.json          # Dependências (express, pg, ejs, dotenv)
├── .env                  # Credenciais do Banco (Seguro)
├── src
│   ├── server.js         # Servidor Web e Rotas
│   ├── database.js       # Conexão PostgreSQL (Pool)
│   └── services
│       └── dataService.js # Lógica de Negócios e Queries SQL
└── views
    └── dashboard.ejs     # Template HTML convertido
```

## 2. Tratamento de Dados (Desafio Técnico)

As tabelas possuem campos de texto que precisam ser convertidos para cálculos:
- **Vendas (valor_total)**: Formato 'R$240,00' -> Converter para NUMERIC.
- **Vendas (data_compra)**: Formato '25 Nov 2025' -> Converter para DATE.

### Estratégia SQL
Utilizaremos funções de conversão robustas diretamente nas queries para garantir performance:

**Conversão de Valor:**
```sql
CAST(REPLACE(REPLACE(valor_total, 'R$', ''), ',', '.') AS NUMERIC)
```

**Conversão de Data:**
```sql
TO_DATE(data_compra, 'DD Mon YYYY')
```

## 3. Queries Planejadas

### A. KPIs Gerais (Topo do Dashboard)
Busca totais do mês atual e acumulados.
- **Total Clientes**: `COUNT(*)` em `users`.
- **Clientes Interagiram**: `COUNT(*)` em `users` onde `message_count > 1`.
- **Vendas**: `COUNT(*)` e `SUM(valor)` em `vendas`.
- **Taxas**: Calculadas no Javascript ((Vendas / Clientes) * 100).

### B. Gráfico de Evolução Diária (Últimos 30 dias)
Uma query unificada (CTE) para alinhar as datas das duas tabelas:
1. Gerar série de datas dos últimos 30 dias.
2. JOIN com `users` agrupado por `DATE(criado_as)`.
3. JOIN com `vendas` agrupado por `TO_DATE(data_compra)`.
4. JOIN com `users` (interagiram) agrupado por data.

### C. Tabela de Performance Mensal
Agrupamento por mês/ano para mostrar histórico.

### D. Últimas 10 Vendas
Simples `SELECT` ordenado pela data convertida.

## 4. Frontend (EJS)
- Manteremos o CSS e estrutura HTML originais.
- Substituiremos os placeholders `{{ $json... }}` por tags EJS `<%= kpi.faturamento %>`.
- O Chart.js receberá os arrays de dados processados pelo backend.

## Próximos Passos
1. Aprovar este plano.
2. Mudar para modo **Code**.
3. Executar a implementação passo-a-passo.