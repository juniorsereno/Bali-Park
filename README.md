# Dashboard Bali Park

Painel comercial em Express/EJS, com acesso por código, gráficos locais Chart.js e PostgreSQL. O robô Playwright de vendas é executado em um processo separado.

## Executar localmente

Requer Node 24 e PostgreSQL já configurado. Preencha o `.env` com base no `.env.example`. O arquivo local existente foi preservado; ele não deve ser versionado.

```sh
npm ci
npm start
```

Abra `http://localhost:3000` (ou a porta configurada). `DASHBOARD_ACCESS_CODE` define o código de entrada. `SESSION_SECRET` deve conter pelo menos 32 caracteres aleatórios. A sessão dura sete dias, e a troca de qualquer um desses valores invalida as sessões existentes.

Em produção, use HTTPS. Configure `TRUST_PROXY=1` somente quando houver um proxy reverso confiável na frente da aplicação. Cookies são seguros por padrão em produção; `COOKIE_SECURE=false` serve apenas para testes HTTP locais. A aplicação mantém o verificador SOAP a cada duas horas quando `MULTICLUBES_AUTH_KEY` está configurado.

## Robô de vendas

O login usa `MULTICLUBES_PORTAL_LOGIN` e `MULTICLUBES_PORTAL_PASSWORD`. O robô preenche a identificação, aguarda a senha, confirma o login e abre a lista de pedidos **na mesma página e no mesmo contexto de navegador**, preservando os cookies entre os domínios.

São importados apenas pagamentos aprovados. Cada registro contém voucher normalizado, valor decimal, momento da busca em São Paulo e `paid=true`. Dados pessoais ficam nulos. Vouchers já cadastrados são ignorados, sem atualizar seus campos. Vendas importadas participam de todos os indicadores. O campo `result` não existe nesta tabela.

```sh
npx playwright install --with-deps chromium
npm run sync:sales -- --dry-run
```

O dry-run não executa INSERT/UPDATE nem migrações. Ele coleta a lista inteira e compara os vouchers com o banco. Os contadores mostram lidos, aprovados, existentes, novos, ignorados e inválidos. Saída 1 indica falha; saída 2 indica registros inválidos. Mudança de layout, paginação inconsistente ou falha no login interrompem a coleta antes das inserções.

**Estado da validação real:** o portal respondeu com falha de validação de segurança antes de apresentar a senha (`PORTAL_SECURITY`). A navegação entre domínios e a extração foram testadas com páginas simuladas; a extração da lista real ainda precisa ser confirmada. Por isso `MULTICLUBES_IMPORT_ENABLED=false` permanece no ambiente local.

## Ativação do robô

Depois de um dry-run real bem-sucedido, aplicar a migração no banco de destino é uma etapa explícita:

```sh
npm run db:migrate
```

A migração cria o índice único de voucher, verifica duplicidades antes de alterar a tabela e não exclui nem mescla vendas. O índice também afeta outros sistemas que escrevem nessa tabela: eles devem tratar conflito de voucher. O importador faz isso com `ON CONFLICT DO NOTHING` e usa uma trava PostgreSQL para impedir duas execuções simultâneas.

Defina `MULTICLUBES_IMPORT_ENABLED=true` após essas verificações. Para uma execução única, use `npm run sync:sales`. Para agendar, use `npm run worker:sales`; o padrão é `10 */2 * * *`, no fuso `America/Sao_Paulo`, sem execução imediata na inicialização.

```sh
docker compose up -d --build app
docker compose --profile rpa up -d --build sales-worker
docker compose logs -f sales-worker
```

A imagem instala Chromium e suas bibliotecas, executa como usuário sem privilégios e não inclui `.env` nem `.git`. O worker registra contadores e códigos de erro sem imprimir credenciais ou dados pessoais. Se o portal negar o login, ele tenta novamente no ciclo seguinte. Para pausar, pare somente o serviço `sales-worker`; o dashboard e o SOAP continuam independentes.

## Testes

```sh
npm test
npm run test:browser
TEST_DATABASE_URL=postgresql://usuario:senha@localhost:5432/bali_dashboard_test npm run test:db
```

Os testes de banco exigem um banco **exclusivo de testes** chamado `bali_dashboard_test`; criam e limpam tabelas apenas nesse banco e não usam `DATABASE_URL`. Cobrem migração, duplicidade, concorrência, horário da coleta e consistência das métricas. Os testes de navegador simulam o portal e geram imagens em `test-results/`.

Os filtros afetam os indicadores e gráficos. As tabelas mostram o histórico geral. “Interagiram” usa mais de duas mensagens; as regras de origem dos leads permanecem independentes desse critério.
