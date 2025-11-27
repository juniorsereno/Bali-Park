"bali_park"."users" ( 
  "id" SERIAL,
  "nome" TEXT NULL,
  "telefone" TEXT NULL,
  "conv_id" TEXT NULL,
  "message_count" INTEGER NULL,
  "pausaIA" BOOLEAN NULL DEFAULT false ,
  "retomaIA" TIMESTAMP NULL,
  "criado_as" TIMESTAMP NULL DEFAULT now() ,
  "ult_interacao" TIMESTAMP NULL,
  "follow_up_20min" TIMESTAMP NULL,
  "follow_up_24hr" TEXT NULL,
  "result" BOOLEAN NULL DEFAULT false ,
  "deal_id" TEXT NULL,
  "contact_id" TEXT NULL,
  "source" TEXT NULL,
  "chat_contact_id" TEXT NULL,
  "chat_conv_id" TEXT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "telefone" UNIQUE ("telefone")
);

Exemplo de dados do banco:
1092233	Danilo Gomes	5561991507170	1a1e7561-08ec-45b3-be9b-f85dfa1f422e	2	false	(NULL)	2025-11-25 13:09:31.094931	2025-11-25 13:16:09.296	2025-11-26 16:02:00	(NULL)	false	6925d4b9cc9dbe0001ec2d2f	6925d4b9cc9dbe0001ec2d25	central_vendas	17398	11449
1092231	Lusiene Santos	5561999689595	55c27d7c-ce0b-4e5a-8798-a1b355fd57f7	11	false	(NULL)	2025-11-25 13:00:15.344954	2025-11-26 15:02:13.605	2025-11-27 08:00:00	(NULL)	false	67fa56ae4c864e00016b5fbf	6910e8d2d5a7fc000133a941	central	17397	11448