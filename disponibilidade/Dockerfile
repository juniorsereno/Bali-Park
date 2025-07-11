# Use a imagem oficial do Playwright que já inclui Node.js e todas as dependências de navegadores.
# Isso evita problemas de instalação de browsers dentro do contêiner.
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Define o diretório de trabalho dentro do contêiner.
WORKDIR /usr/src/app

# Copia os arquivos de definição de pacotes (package.json e package-lock.json).
COPY package*.json ./

# Instala as dependências do projeto definidas no package.json.
RUN npm install

# Copia o restante dos arquivos da sua aplicação para o diretório de trabalho.
COPY . .

# Define o comando padrão que será executado quando o contêiner iniciar.
CMD ["node", "disponibilidade-automation.js"] 