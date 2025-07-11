const { chromium } = require('playwright');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const axios = require('axios');

class BaliParkDisponibilidade {
    constructor() {
        this.browser = null;
        this.page = null;
        this.dadosDisponibilidade = [];
        this.mesesCapturados = 0;
        this.metaMeses = 6; // Capturar 6 meses
        
        // Tabela de referência Adulto -> Infantil
        this.tabelaReferencia = {
            158: 75,
            105: 50,
            116: 65,
            126: 70,
            100: 47,
            110: 62,
            120: 66,
            95: 45,
            114: 63
        };
    }

    async iniciar() {
        console.log('🚀 Iniciando automação de captura de disponibilidades do Bali Park...');
        
        try {
            // Configurar o navegador para rodar em modo headless (backend)
            this.browser = await chromium.launch({
                headless: true, // Alterado para true para modo backend
                args: [
                    '--no-sandbox', // Necessário para rodar em ambientes Docker
                    '--disable-setuid-sandbox',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            });

            this.page = await this.browser.newPage();
            
            // Manter o viewport pode ser útil para consistência de renderização
            await this.page.setViewportSize({ width: 1366, height: 768 });
            
            // Ajustar zoom para melhor visualização
            await this.page.evaluate(() => {
                document.body.style.zoom = '0.8';
            });

            // Navegar para o site
            console.log('📍 Acessando https://balipark.com.br/');
            await this.page.goto('https://balipark.com.br/', { 
                waitUntil: 'domcontentloaded',
                timeout: 60000 
            });
            
            // Aguardar um pouco mais para garantir que os scripts carreguem
            await this.page.waitForTimeout(3000);
            
            // Aplicar zoom após o carregamento inicial
            await this.page.evaluate(() => {
                document.body.style.zoom = '0.8';
            });

            // Aguardar o calendário carregar
            await this.aguardarCalendario();

            // Capturar dados dos próximos 6 meses
            await this.capturarDisponibilidades();

            // Salvar dados
            await this.salvarDados();

            console.log('✅ Automação concluída com sucesso!');

        } catch (error) {
            console.error('❌ Erro na automação:', error);
            await this.capturarScreenshot('erro');
        } finally {
            await this.fechar();
        }
    }

    async aguardarCalendario() {
        console.log('⏳ Aguardando calendário carregar...');
        
        // Aguardar o container do calendário com retry
        let tentativas = 0;
        const maxTentativas = 3;
        
        while (tentativas < maxTentativas) {
            try {
                await this.page.waitForSelector('.calendario-aberto', { timeout: 20000 });
                console.log('✅ Container do calendário encontrado!');
                break;
            } catch (error) {
                tentativas++;
                console.log(`⚠️ Tentativa ${tentativas}/${maxTentativas} falhou, tentando novamente...`);
                if (tentativas >= maxTentativas) {
                    throw new Error('Calendário não encontrado após várias tentativas');
                }
                await this.page.waitForTimeout(5000);
                await this.page.reload();
                await this.page.waitForTimeout(3000);
            }
        }
        
        // Aguardar os dados do calendário serem carregados
        await this.page.waitForFunction(() => {
            return window.calendarArray && window.calendarArray.length > 0;
        }, { timeout: 15000 }).catch(() => {
            console.log('⚠️ CalendarArray não encontrado, tentando capturar dados diretamente do DOM');
        });

        // Verificar se existem dias no calendário
        await this.page.waitForFunction(() => {
            const diasAbertos = document.querySelectorAll('.daysOpen');
            const diasFechados = document.querySelectorAll('.daysClose');
            return diasAbertos.length > 0 || diasFechados.length > 0;
        }, { timeout: 10000 });

        console.log('✅ Calendário carregado!');
        await this.page.waitForTimeout(2000);
    }

    async capturarDisponibilidades() {
        console.log('📅 Iniciando captura de disponibilidades...');

        for (let mes = 0; mes < this.metaMeses; mes++) {
            try {
                console.log(`📊 Capturando mês ${mes + 1}/${this.metaMeses}...`);
                
                // Capturar dados do mês atual
                const dadosMes = await this.capturarMesAtual();
                
                if (dadosMes && dadosMes.length > 0) {
                    this.dadosDisponibilidade.push(...dadosMes);
                    this.mesesCapturados++;
                    console.log(`✅ Mês ${mes + 1} capturado: ${dadosMes.length} datas encontradas`);
                } else {
                    console.log(`⚠️ Nenhum dado encontrado para o mês ${mes + 1}`);
                }

                // Se não é o último mês, navegar para o próximo
                if (mes < this.metaMeses - 1) {
                    await this.navegarProximoMes();
                }

            } catch (error) {
                console.error(`❌ Erro ao capturar mês ${mes + 1}:`, error);
                await this.capturarScreenshot(`erro-mes-${mes + 1}`);
            }
        }

        console.log(`📈 Captura concluída: ${this.mesesCapturados} meses, ${this.dadosDisponibilidade.length} datas totais`);
    }

    async capturarMesAtual() {
        try {
            // Priorizar captura do DOM (específica do mês atual)
            console.log('📋 Capturando dados do DOM do mês atual...');
            const dadosDOM = await this.capturarDadosDOM();
            
            if (dadosDOM && dadosDOM.length > 0) {
                return dadosDOM;
            }

            // Fallback: tentar capturar do calendarArray apenas se DOM falhar
            console.log('⚠️ DOM vazio, tentando calendarArray como fallback...');
            const dadosScript = await this.page.evaluate(() => {
                if (typeof calendarArray !== 'undefined' && calendarArray.length > 0) {
                    return calendarArray;
                }
                return null;
            });

            if (dadosScript && dadosScript.length > 0) {
                console.log('📋 Dados capturados do calendarArray (fallback)');
                return this.processarDadosScriptMesAtual(dadosScript);
            }

            return [];

        } catch (error) {
            console.error('❌ Erro ao capturar dados do mês:', error);
            return [];
        }
    }

    async processarDadosScriptMesAtual(dadosScript) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de data
        
        // Obter o mês/ano atual do cabeçalho do calendário
        const mesAnoAtual = await this.page.textContent('#currentMonth-1');
        const [mesAtual, anoAtual] = this.parserarMesAno(mesAnoAtual);
        
        return dadosScript
            .filter(item => {
                const data = new Date(item.Date);
                const mesData = data.getMonth();
                const anoData = data.getFullYear();
                
                // Filtrar apenas dados do mês/ano atual exibido no calendário
                // E que sejam de hoje em diante
                return anoData === anoAtual && mesData === mesAtual && data >= hoje;
            })
            .map(item => {
                const valorOriginal = parseFloat(item.Value);
                const valorAdulto = valorOriginal;
                const valorInfantil = this.tabelaReferencia[valorAdulto] || 0;
                
                return {
                    data: item.Date.split('T')[0],
                    valor_adulto: valorAdulto,
                    valor_infantil: valorInfantil,
                    disponivel: true,
                    mesAno: mesAnoAtual
                };
            });
    }

    async capturarDadosDOM() {
        // Capturar o mês/ano atual do cabeçalho
        const mesAno = await this.page.textContent('#currentMonth-1');
        
        // Capturar todos os dias disponíveis, restringindo a busca ao #calendar-1
        const diasDisponiveis = await this.page.$$eval('#calendar-1 .daysOpen', (elementos) => {
            return elementos.map(elemento => {
                const dia = elemento.querySelector('span:first-child')?.textContent?.trim();
                const valorElement = elemento.querySelector('.spanValue');
                
                let valor = 0;
                if (valorElement) {
                    const parteInteira = valorElement.querySelector('span:first-child')?.textContent?.replace(',', '') || '0';
                    const parteCentavos = valorElement.querySelector('.centavos')?.textContent || '00';
                    valor = parseFloat(`${parteInteira}.${parteCentavos}`);
                }

                return {
                    dia: parseInt(dia),
                    valor: valor,
                    disponivel: true
                };
            }).filter(item => item.dia && !isNaN(item.dia)); // Adiciona filtro para garantir que o dia é válido
        });

        // Capturar dias não disponíveis, restringindo a busca ao #calendar-1
        const diasIndisponiveis = await this.page.$$eval('#calendar-1 .daysClose', (elementos) => {
            return elementos.map(elemento => {
                const dia = elemento.querySelector('span:first-child')?.textContent?.trim();
                return {
                    dia: parseInt(dia),
                    valor: 0,
                    disponivel: false
                };
            }).filter(item => item.dia && !isNaN(item.dia));
        });

        // Combinar dados e adicionar informações de data completa
        const todosDias = [...diasDisponiveis, ...diasIndisponiveis];
        const [mes, ano] = this.parserarMesAno(mesAno);

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de data
        
        return todosDias
            .map(dia => {
                const dataCompleta = new Date(ano, mes, dia.dia);
                const valorAdulto = dia.valor;
                const valorInfantil = this.tabelaReferencia[valorAdulto] || 0;
                
                return {
                    data: this.formatarData(ano, mes, dia.dia),
                    dataObj: dataCompleta,
                    valor_adulto: valorAdulto,
                    valor_infantil: valorInfantil,
                    disponivel: dia.disponivel,
                    mesAno: mesAno
                };
            })
            .filter(item => item.dataObj >= hoje) // Filtrar apenas datas de hoje em diante
            .map(item => {
                // Remover o dataObj auxiliar antes de retornar
                const { dataObj, ...itemSemDataObj } = item;
                return itemSemDataObj;
            });
    }

    parserarMesAno(mesAnoTexto) {
        const meses = {
            'Janeiro': 0, 'Fevereiro': 1, 'Março': 2, 'Abril': 3,
            'Maio': 4, 'Junho': 5, 'Julho': 6, 'Agosto': 7,
            'Setembro': 8, 'Outubro': 9, 'Novembro': 10, 'Dezembro': 11
        };

        const [mesNome, ano] = mesAnoTexto.split(' ');
        return [meses[mesNome], parseInt(ano)];
    }

    formatarData(ano, mes, dia) {
        const data = new Date(ano, mes, dia);
        return data.toISOString().split('T')[0];
    }

    obterMesAno(dataISO) {
        const data = new Date(dataISO);
        const meses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return `${meses[data.getMonth()]} ${data.getFullYear()}`;
    }

    async navegarProximoMes() {
        console.log('➡️ Navegando para o próximo mês...');
        
        try {
            // Capturar o mês atual antes da navegação
            const mesAnterior = await this.page.textContent('#currentMonth-1');
            console.log(`📅 Mês atual: ${mesAnterior}`);
            
            // Tentar diferentes abordagens para clicar no botão
            const botaoProximo = this.page.locator('#nextMonth-1');
            
            // Verificar se o botão está visível
            await botaoProximo.waitFor({ state: 'visible', timeout: 10000 });
            
            // Fazer scroll até o botão se necessário
            await botaoProximo.scrollIntoViewIfNeeded();
            await this.page.waitForTimeout(1000);
            
            // Tentar clique com força
            await botaoProximo.click({ force: true });
            
            // Aguardar o calendário atualizar
            await this.page.waitForTimeout(3000);
            
            // Aguardar a mudança do mês no cabeçalho
            await this.page.waitForFunction((mesAnterior) => {
                const elemento = document.querySelector('#currentMonth-1');
                return elemento && elemento.textContent.trim() !== '' && elemento.textContent.trim() !== mesAnterior;
            }, mesAnterior, { timeout: 10000 });

            const novoMes = await this.page.textContent('#currentMonth-1');
            console.log(`✅ Navegação concluída: ${mesAnterior} -> ${novoMes}`);

        } catch (error) {
            console.error('❌ Erro ao navegar para próximo mês:', error);
            
            // Tentar abordagem alternativa com JavaScript
            try {
                console.log('🔄 Tentando abordagem alternativa...');
                await this.page.evaluate(() => {
                    const botao = document.querySelector('#nextMonth-1');
                    if (botao) {
                        botao.click();
                    }
                });
                await this.page.waitForTimeout(3000);
                console.log('✅ Navegação alternativa concluída');
            } catch (errorAlternativo) {
                console.error('❌ Erro na abordagem alternativa:', errorAlternativo);
                throw error;
            }
        }
    }

    async salvarDados() {
        // Apagar arquivos anteriores antes de gerar novos
        await this.apagarArquivosAnteriores();
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const nomeArquivo = `disponibilidade-balipark-${timestamp}.json`;
        const caminhoArquivo = path.join(__dirname, nomeArquivo);

        // Remover duplicatas antes de salvar
        this.dadosDisponibilidade = this.removerDuplicatas(this.dadosDisponibilidade);

        // Organizar dados por mês
        const dadosOrganizados = this.organizarDadosPorMes();

        const relatorio = {
            timestamp: new Date().toISOString(),
            resumo: {
                totalDatas: this.dadosDisponibilidade.length,
                mesesCapturados: this.mesesCapturados,
                datasDisponiveis: this.dadosDisponibilidade.filter(d => d.disponivel).length,
                datasIndisponiveis: this.dadosDisponibilidade.filter(d => !d.disponivel).length
            },
            dados: this.dadosDisponibilidade,
            dadosOrganizados: dadosOrganizados
        };

        fs.writeFileSync(caminhoArquivo, JSON.stringify(relatorio, null, 2));
        
        // Enviar dados para o webhook
        await this.enviarParaWebhook(relatorio);

        console.log(`💾 Dados salvos em:`);
        console.log(`   JSON: ${caminhoArquivo}`);

        console.log(`📊 Resumo:`);
        console.log(`   - Total de datas: ${relatorio.resumo.totalDatas}`);
        console.log(`   - Meses capturados: ${relatorio.resumo.mesesCapturados}`);
        console.log(`   - Datas disponíveis: ${relatorio.resumo.datasDisponiveis}`);
        console.log(`   - Datas indisponíveis: ${relatorio.resumo.datasIndisponiveis}`);
    }

    async apagarArquivosAnteriores() {
        try {
            const arquivos = await fsPromises.readdir(__dirname);
            
            // Filtrar arquivos de disponibilidade (JSON e CSV)
            const arquivosParaApagar = arquivos.filter(arquivo => 
                arquivo.startsWith('disponibilidade-balipark-') && 
                (arquivo.endsWith('.json') || arquivo.endsWith('.csv'))
            );
            
            if (arquivosParaApagar.length > 0) {
                console.log(`🗑️ Removendo ${arquivosParaApagar.length} arquivo(s) anterior(es)...`);
                
                for (const arquivo of arquivosParaApagar) {
                    const caminhoCompleto = path.join(__dirname, arquivo);
                    await fsPromises.unlink(caminhoCompleto);
                    console.log(`   ✅ Removido: ${arquivo}`);
                }
            } else {
                console.log('ℹ️ Nenhum arquivo anterior encontrado para remover');
            }
        } catch (error) {
            console.log(`⚠️ Erro ao remover arquivos anteriores: ${error.message}`);
        }
    }

    removerDuplicatas(dados) {
        const dadosUnicos = [];
        const datasProcessadas = new Set();
        
        dados.forEach(item => {
            const chaveUnica = `${item.data}_${item.disponivel}`;
            
            if (!datasProcessadas.has(chaveUnica)) {
                datasProcessadas.add(chaveUnica);
                dadosUnicos.push(item);
            }
        });
        
        console.log(`🧹 Duplicatas removidas: ${dados.length} -> ${dadosUnicos.length} registros`);
        return dadosUnicos;
    }

    organizarDadosPorMes() {
        const dadosPorMes = {};
        
        this.dadosDisponibilidade.forEach(item => {
            const mesAno = item.mesAno || this.obterMesAno(item.data + 'T00:00:00');
            
            if (!dadosPorMes[mesAno]) {
                dadosPorMes[mesAno] = {
                    mes: mesAno,
                    totalDatas: 0,
                    datasDisponiveis: 0,
                    datasIndisponiveis: 0,
                    valorAdultoMinimo: null,
                    valorAdultoMaximo: null,
                    valorAdultoMedio: 0,
                    valorInfantilMinimo: null,
                    valorInfantilMaximo: null,
                    valorInfantilMedio: 0,
                    datas: []
                };
            }

            dadosPorMes[mesAno].datas.push(item);
            dadosPorMes[mesAno].totalDatas++;

            if (item.disponivel) {
                dadosPorMes[mesAno].datasDisponiveis++;
                
                if (item.valor_adulto > 0) {
                    // Valores adulto
                    if (dadosPorMes[mesAno].valorAdultoMinimo === null || item.valor_adulto < dadosPorMes[mesAno].valorAdultoMinimo) {
                        dadosPorMes[mesAno].valorAdultoMinimo = item.valor_adulto;
                    }
                    if (dadosPorMes[mesAno].valorAdultoMaximo === null || item.valor_adulto > dadosPorMes[mesAno].valorAdultoMaximo) {
                        dadosPorMes[mesAno].valorAdultoMaximo = item.valor_adulto;
                    }
                }
                
                if (item.valor_infantil > 0) {
                    // Valores infantil
                    if (dadosPorMes[mesAno].valorInfantilMinimo === null || item.valor_infantil < dadosPorMes[mesAno].valorInfantilMinimo) {
                        dadosPorMes[mesAno].valorInfantilMinimo = item.valor_infantil;
                    }
                    if (dadosPorMes[mesAno].valorInfantilMaximo === null || item.valor_infantil > dadosPorMes[mesAno].valorInfantilMaximo) {
                        dadosPorMes[mesAno].valorInfantilMaximo = item.valor_infantil;
                    }
                }
            } else {
                dadosPorMes[mesAno].datasIndisponiveis++;
            }
        });

        // Calcular valores médios
        Object.values(dadosPorMes).forEach(mes => {
            // Calcular média dos valores adulto
            const valoresAdultoValidos = mes.datas.filter(d => d.disponivel && d.valor_adulto > 0).map(d => d.valor_adulto);
            if (valoresAdultoValidos.length > 0) {
                mes.valorAdultoMedio = valoresAdultoValidos.reduce((a, b) => a + b, 0) / valoresAdultoValidos.length;
                mes.valorAdultoMedio = Math.round(mes.valorAdultoMedio * 100) / 100; // Arredondar para 2 casas decimais
            }
            
            // Calcular média dos valores infantil
            const valoresInfantilValidos = mes.datas.filter(d => d.disponivel && d.valor_infantil > 0).map(d => d.valor_infantil);
            if (valoresInfantilValidos.length > 0) {
                mes.valorInfantilMedio = valoresInfantilValidos.reduce((a, b) => a + b, 0) / valoresInfantilValidos.length;
                mes.valorInfantilMedio = Math.round(mes.valorInfantilMedio * 100) / 100; // Arredondar para 2 casas decimais
            }
        });

        return dadosPorMes;
    }

    async enviarParaWebhook(relatorio) {
        const webhookUrl = 'https://webh.criativamaisdigital.com.br/webhook/ff8054c3-7505-48f8-a581-463b5ff19bd5';
        
        try {
            console.log('🚀 Enviando dados para o webhook...');
            
            const response = await axios.post(webhookUrl, relatorio, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 200 || response.status === 201) {
                console.log('✅ Dados enviados para o webhook com sucesso!');
                console.log(`   - Status: ${response.status}`);
            } else {
                console.log(`⚠️ Resposta inesperada do webhook: ${response.status}`);
            }
            
        } catch (error) {
            console.error('❌ Erro ao enviar dados para o webhook:');
            if (error.response) {
                // O servidor respondeu com um status de erro (4xx, 5xx)
                console.error(`   - Status: ${error.response.status}`);
                console.error(`   - Data: ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                // A requisição foi feita, mas não houve resposta
                console.error('   - Nenhuma resposta recebida do servidor.');
            } else {
                // Algo aconteceu ao configurar a requisição
                console.error(`   - Erro: ${error.message}`);
            }
        }
    }

    async capturarScreenshot(nome) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const nomeArquivo = `screenshot-${nome}-${timestamp}.png`;
            await this.page.screenshot({ path: path.join(__dirname, nomeArquivo), fullPage: true });
            console.log(`📸 Screenshot salvo: ${nomeArquivo}`);
        } catch (error) {
            console.error('❌ Erro ao capturar screenshot:', error);
        }
    }

    async fechar() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔒 Navegador fechado');
        }
    }
}

// Executar a automação
async function executar() {
    console.log(`\n--- [${new Date().toISOString()}] ---`);
    console.log('🚀 Iniciando nova execução da automação...');
    const automacao = new BaliParkDisponibilidade();
    // O try/catch já existe dentro de iniciar(), então não precisamos duplicar aqui.
    await automacao.iniciar();
    console.log(`--- [${new Date().toISOString()}] ---`);
}

// Verificar se está sendo executado diretamente
if (require.main === module) {
    const SEIS_HORAS_EM_MS = 6 * 60 * 60 * 1000;

    console.log('🤖 Serviço de automação iniciado.');
    console.log(`🕒 O script será executado a cada 6 horas.`);

    // Executar imediatamente a primeira vez
    executar().catch(console.error).finally(() => {
        console.log(`✅ Primeira execução concluída. Próxima execução agendada...`);
    });

    // Agendar execuções futuras
    setInterval(() => {
        executar().catch(console.error);
    }, SEIS_HORAS_EM_MS);
}

module.exports = BaliParkDisponibilidade; 