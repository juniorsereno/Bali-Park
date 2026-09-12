# Tabela de Vendas

```sql
CREATE TABLE "bali_park"."vendas" (
  "id" SERIAL,
  "nome" VARCHAR(255) NULL,
  "cpf" VARCHAR(11) NULL,
  "telefone" VARCHAR(11) NULL,
  "email" VARCHAR(255) NULL,
  "voucher_code" VARCHAR(50) NULL,
  "valor_total" NUMERIC NULL,
  "link_pagamento" TEXT NULL,
  "sale_id" VARCHAR(50) NULL,
  "data_visita" DATE NULL,
  "created_at" TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  "paid" BOOLEAN NULL DEFAULT false,
  "user_id" INTEGER NULL,
  CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_vendas_cpf" ON "bali_park"."vendas" ("cpf" ASC);
CREATE INDEX "idx_vendas_voucher" ON "bali_park"."vendas" ("voucher_code" ASC);
CREATE UNIQUE INDEX idx_vendas_voucher_unique
  ON bali_park.vendas (UPPER(BTRIM(voucher_code)))
  WHERE NULLIF(BTRIM(voucher_code), '') IS NOT NULL;
```

## Campos importantes para o Dashboard

- `paid`: Indica se a venda foi paga (true/false). Apenas vendas com `paid = true` são contabilizadas no dashboard.
- `created_at`: Data de criação da venda. Usada para filtros de período e agrupamentos.
- `valor_total`: Valor numérico da venda (sem formatação).
- `voucher_code`: Código do voucher da venda.

## Importação do portal

A estrutura reflete a inspeção do PostgreSQL em setembro de 2026. O índice único é instalado pela migração `001_unique_voucher.sql`.

O robô grava somente `voucher_code`, `valor_total`, `created_at` (momento da coleta, em São Paulo) e `paid = true`. Os dados pessoais ficam nulos. Não há coluna `result` em vendas. Vouchers existentes são ignorados, inclusive se estiverem pendentes; a conciliação SOAP permanece independente.
