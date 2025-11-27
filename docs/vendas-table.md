"bali_park"."vendas" ( 
  "id" SERIAL,
  "voucher" TEXT NULL,
  "valor_total" TEXT NULL,
  "data_compra" TEXT NULL,
  "updated_at" TIMESTAMP NULL,
  CONSTRAINT "PK_vendas" PRIMARY KEY ("id"),
  CONSTRAINT "voucher" UNIQUE ("voucher")
);

Exemplo de dados do banco:
24004	KVK67761	R$240,00	25 Nov 2025	2025-11-26 22:00:11.971
23264	WFW67495	R$320,00	21 Nov 2025	2025-11-26 22:00:11.972