# Tabela de Vendas

```sql
CREATE TABLE "bali_park"."vendas" (
  "id" SERIAL,
  "nome" VARCHAR(255) NOT NULL,
  "cpf" VARCHAR(11) NOT NULL,
  "telefone" VARCHAR(11) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "voucher_code" VARCHAR(50) NULL,
  "valor_total" NUMERIC NULL,
  "link_pagamento" TEXT NULL,
  "sale_id" VARCHAR(50) NULL,
  "data_visita" DATE NULL,
  "created_at" TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  "paid" BOOLEAN NULL DEFAULT false,
  CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_vendas_cpf" ON "bali_park"."vendas" ("cpf" ASC);
CREATE INDEX "idx_vendas_voucher" ON "bali_park"."vendas" ("voucher_code" ASC);
```

## Campos importantes para o Dashboard

- `paid`: Indica se a venda foi paga (true/false). Apenas vendas com `paid = true` são contabilizadas no dashboard.
- `created_at`: Data de criação da venda. Usada para filtros de período e agrupamentos.
- `valor_total`: Valor numérico da venda (sem formatação).
- `voucher_code`: Código do voucher da venda.
