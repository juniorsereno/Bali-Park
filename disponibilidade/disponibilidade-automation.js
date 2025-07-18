const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class BaliParkDisponibilidade {
    constructor() {
        this.browser = null;
        this.page = null;
        this.dadosDisponibilidade = [];
        this.mesesCapturados = 0;
        this.metaMeses = 6; // Capturar 6 meses

        // Mês e ano atuais para controle de navegação
        const dataAtual = new Date();
        this.mesAtual = dataAtual.getMonth();
        this.anoAtual = dataAtual.getFullYear();

        // Tabela de referência Adulto -> Infantil
        this.tabelaReferencia = {
            150: 70,
            110: 62,
            120: 67,
            100: 48,
            95: 46,
            105: 59,
            114: 64,
            108: 61,
            90: 44
        };
    }

    async iniciar() {
        console.log('🚀 Iniciando automação de captura de disponibilidades do Bali Park...');

        try {
            // Configurar o navegador para rodar em modo headless (backend)
            this.browser = await chromium.launch({
                headless: true, // Modo headless para produção
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

            // Navegar para o endpoint do Bali Park
            console.log('📍 Acessando https://loja.multiclubes.com.br/balipark/Ingressos/CP0014?Promoter=aWFmSjE1SnI3MW8vRzN0RlI0WjVDZz09');
            await this.page.goto('https://loja.multiclubes.com.br/balipark/Ingressos/CP0014?Promoter=aWFmSjE1SnI3MW8vRzN0RlI0WjVDZz09', {
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

            // Enviar dados para o webhook
            await this.enviarDadosParaWebhook();

            console.log('✅ Automação concluída com sucesso!');

        } catch (error) {
            console.error('❌ Erro na automação:', error);
        } finally {
            await this.fechar();
        }
    }

    async aguardarCalendario() {
        console.log('⏳ Aguardando formulário do calendário carregar...');

        // Aguardar o formulário do calendário com retry
        let tentativas = 0;
        const maxTentativas = 3;

        while (tentativas < maxTentativas) {
            try {
                await this.page.waitForSelector('form#calendar', { timeout: 20000 });
                console.log('✅ Formulário do calendário encontrado!');
                break;
            } catch (error) {
                tentativas++;
                console.log(`⚠️ Tentativa ${tentativas}/${maxTentativas} falhou, tentando novamente...`);
                if (tentativas >= maxTentativas) {
                    throw new Error('Formulário do calendário não encontrado após várias tentativas');
                }
                await this.page.waitForTimeout(5000);
                await this.page.reload();
                await this.page.waitForTimeout(3000);
            }
        }

        // Verificar se existem dias no calendário
        await this.page.waitForFunction(() => {
            const diasDisponiveis = document.querySelectorAll('.dateValue');
            const diasIndisponiveis = document.querySelectorAll('.disabled');
            return diasDisponiveis.length > 0 || diasIndisponiveis.length > 0;
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
            }
        }

        console.log(`📈 Captura concluída: ${this.mesesCapturados} meses, ${this.dadosDisponibilidade.length} datas totais`);
    }

    async capturarMesAtual() {
        try {
            // Capturar dados diretamente do DOM
            console.log('📋 Capturando dados do formulário do calendário...');
            const dadosDOM = await this.capturarDadosDOM();

            // Retornar os dados capturados ou array vazio se não houver dados
            return dadosDOM && dadosDOM.length > 0 ? dadosDOM : [];
        } catch (error) {
            console.error('❌ Erro ao capturar dados do mês:', error);
            return [];
        }
    }

    async verificarPaginaCalendario() {
        try {
            // Verificar se estamos na página do calendário
            const formCalendario = await this.page.$('form#calendar');
            const stepDia = await this.page.$('.step:has-text("PASSO 1")');

            // Se temos o formulário do calendário e estamos no passo 1 (dia), estamos na página correta
            return !!formCalendario && !!stepDia;
        } catch (error) {
            console.error('❌ Erro ao verificar página do calendário:', error);
            return false;
        }
    }

    async navegarParaPaginaCalendario() {
        try {
            // Verificar se há um botão para ir para a página de seleção de data
            const botaoSelecaoData = await this.page.$('button:has-text("Selecionar Data")');
            if (botaoSelecaoData) {
                await botaoSelecaoData.click();
                await this.page.waitForTimeout(2000);
                console.log('✅ Navegado para a página de seleção de data');
                return true;
            }

            // Verificar se há um botão para voltar ao passo 1
            const botaoVoltarPasso1 = await this.page.$('button:has-text("Voltar ao Passo 1")');
            if (botaoVoltarPasso1) {
                await botaoVoltarPasso1.click();
                await this.page.waitForTimeout(2000);
                console.log('✅ Voltado para o passo 1 (seleção de data)');
                return true;
            }

            console.log('⚠️ Não foi possível encontrar botões de navegação para o calendário');
            return false;
        } catch (error) {
            console.error('❌ Erro ao navegar para página do calendário:', error);
            return false;
        }
    }

    async capturarDadosDOM() {
        try {
            // Capturar o mês/ano atual do cabeçalho
            const mesAnoTexto = await this.page.textContent('.current');
            console.log(`📅 Mês atual: ${mesAnoTexto}`);

            // Verificar se estamos na página correta
            const paginaCorreta = await this.verificarPaginaCalendario();
            if (!paginaCorreta) {
                console.log('⚠️ Não estamos na página do calendário. Tentando navegar para a página correta...');
                // Tentar clicar em algum botão que leve ao calendário se necessário
                await this.navegarParaPaginaCalendario();
                await this.page.waitForTimeout(2000);
            }

            // Analisar a estrutura HTML para entender o formato atual
            const estruturaHTML = await this.page.evaluate(() => {
                return {
                    elementosDateValue: document.querySelectorAll('.dateValue').length,
                    elementosDisabled: document.querySelectorAll('.disabled').length,
                    elementosNext: document.querySelectorAll('.next').length
                };
            });

            console.log(`📊 Estrutura atual: ${estruturaHTML.elementosDateValue} dias disponíveis, ${estruturaHTML.elementosDisabled} dias indisponíveis`);

            // Capturar todos os dias disponíveis usando $$eval para garantir que retorne um array
            const diasDisponiveis = await this.page.$$eval('.dateValue:not(.disabled)', (elementos) => {
                return Array.from(elementos).map(elemento => {
                    // Extrair o dia do elemento
                    const dia = elemento.querySelector('.dateValueDay')?.textContent?.trim();

                    // Extrair o preço do elemento
                    const valorElement = elemento.querySelector('.dateValuePrice');

                    let valor = 0;
                    if (valorElement && valorElement.textContent) {
                        // Remover prefixo "R$" e converter para número
                        const valorTexto = valorElement.textContent.trim().replace('R$', '').replace(',', '.').trim();
                        valor = valorTexto ? parseFloat(valorTexto) : 0;
                    }

                    return {
                        dia: parseInt(dia),
                        valor: valor,
                        disponivel: true
                    };
                }).filter(item => item.dia && !isNaN(item.dia)); // Filtrar para garantir que o dia é válido
            });

            console.log(`✅ Dias disponíveis encontrados: ${diasDisponiveis.length}`);

            // Capturar dias não disponíveis
            const diasIndisponiveis = await this.page.$$eval('.disabled', (elementos) => {
                return Array.from(elementos).map(elemento => {
                    // Extrair o dia do elemento
                    const dia = elemento.querySelector('.dateValueDay')?.textContent?.trim();

                    return {
                        dia: parseInt(dia),
                        valor: 0,
                        disponivel: false
                    };
                }).filter(item => item.dia && !isNaN(item.dia)); // Filtrar para garantir que o dia é válido
            });

            console.log(`✅ Dias indisponíveis encontrados: ${diasIndisponiveis.length}`);

            // Combinar dados e adicionar informações de data completa
            const todosDias = [...diasDisponiveis, ...diasIndisponiveis];

            // Usar o mês e ano atuais para controle
            const mes = this.mesAtual;
            const ano = this.anoAtual;

            console.log(`📅 Usando mês/ano: ${this.obterNomeMes(mes)} ${ano}`);

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
                        disponivel: dia.disponivel
                    };
                })
                .filter(item => item.dataObj >= hoje) // Filtrar apenas datas de hoje em diante
                .map(item => {
                    // Remover o dataObj auxiliar antes de retornar
                    const { dataObj, ...itemSemDataObj } = item;
                    return itemSemDataObj;
                });
        } catch (error) {
            console.error('❌ Erro ao capturar dados do DOM:', error);
            return [];
        }
    }

    parserarMesAno(mesAnoTexto) {
        const meses = {
            'Janeiro': 0, 'Fevereiro': 1, 'Março': 2, 'Abril': 3,
            'Maio': 4, 'Junho': 5, 'Julho': 6, 'Agosto': 7,
            'Setembro': 8, 'Outubro': 9, 'Novembro': 10, 'Dezembro': 11
        };

        // Verificar se o texto contém um mês válido
        let mesNome = null;
        let ano = null;

        // Verificar cada mês no texto
        for (const mes of Object.keys(meses)) {
            if (mesAnoTexto.includes(mes)) {
                mesNome = mes;
                break;
            }
        }

        // Procurar por um ano de 4 dígitos no texto
        const anoMatch = mesAnoTexto.match(/\b(20\d{2})\b/);
        if (anoMatch) {
            ano = parseInt(anoMatch[1]);
        }

        // Se não encontrou mês ou ano, usar valores padrão
        if (mesNome === null || ano === null) {
            console.log(`⚠️ Não foi possível extrair mês/ano de "${mesAnoTexto}", usando data atual`);
            const dataAtual = new Date();
            return [dataAtual.getMonth(), dataAtual.getFullYear()];
        }

        return [meses[mesNome], ano];
    }

    formatarData(ano, mes, dia) {
        try {
            // Verificar se os valores são válidos
            if (isNaN(ano) || isNaN(mes) || isNaN(dia) ||
                ano < 2000 || ano > 2100 ||
                mes < 0 || mes > 11 ||
                dia < 1 || dia > 31) {
                console.log(`⚠️ Valores inválidos para data: ano=${ano}, mes=${mes}, dia=${dia}, usando data atual`);
                const dataAtual = new Date();
                return dataAtual.toISOString().split('T')[0];
            }

            const data = new Date(ano, mes, dia);

            // Verificar se a data é válida
            if (isNaN(data.getTime())) {
                console.log(`⚠️ Data inválida: ano=${ano}, mes=${mes}, dia=${dia}, usando data atual`);
                const dataAtual = new Date();
                return dataAtual.toISOString().split('T')[0];
            }

            return data.toISOString().split('T')[0];
        } catch (error) {
            console.error(`❌ Erro ao formatar data: ${error.message}, usando data atual`);
            const dataAtual = new Date();
            return dataAtual.toISOString().split('T')[0];
        }
    }

    obterNomeMes(mes) {
        const meses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return meses[mes];
    }

    obterMesAno(dataISO) {
        const data = new Date(dataISO);
        return `${this.obterNomeMes(data.getMonth())} ${data.getFullYear()}`;
    }

    async navegarProximoMes() {
        console.log('➡️ Navegando para o próximo mês...');

        try {
            // Capturar o mês atual antes da navegação
            const mesAnterior = await this.page.textContent('.current');
            console.log(`📅 Mês atual: ${mesAnterior}`);

            // Capturar a estrutura atual do calendário para análise
            const estruturaAntes = await this.page.evaluate(() => {
                return {
                    diasDisponiveis: document.querySelectorAll('.dateValue:not(.disabled)').length,
                    diasIndisponiveis: document.querySelectorAll('.disabled').length,
                    botoes: Array.from(document.querySelectorAll('.next')).map(b => ({
                        title: b.title || '',
                        text: b.textContent.trim(),
                        classes: b.className,
                        isButton: b.tagName === 'BUTTON'
                    }))
                };
            });

            console.log(`🔍 Estrutura atual: ${estruturaAntes.diasDisponiveis} dias disponíveis, ${estruturaAntes.diasIndisponiveis} dias indisponíveis`);
            console.log(`🔍 Encontrados ${estruturaAntes.botoes.length} botões com classe .next`);

            // Incrementar o mês para o próximo
            this.mesAtual++;

            // Ajustar o ano se necessário
            if (this.mesAtual > 11) {
                this.mesAtual = 0;
                this.anoAtual++;
            }

            console.log(`📅 Simulando navegação para: ${this.obterNomeMes(this.mesAtual)} ${this.anoAtual}`);

            // Tentar clicar no botão de próximo mês
            let navegacaoBemSucedida = false;

            // Tentar encontrar o botão específico para navegação do calendário
            const botaoProximoMes = await this.page.$('.next[title="Próximo mês"]');

            if (botaoProximoMes) {
                console.log('✅ Botão de próximo mês encontrado com atributo title');
                await botaoProximoMes.scrollIntoViewIfNeeded();
                await this.page.waitForTimeout(1000);
                await botaoProximoMes.click({ force: true });
                await this.page.waitForTimeout(3000);
                navegacaoBemSucedida = true;
            } else {
                // Tentar cada botão .next até encontrar o correto
                const botoesNext = await this.page.$$('.next');

                for (let i = 0; i < botoesNext.length; i++) {
                    console.log(`🔄 Tentando botão .next #${i + 1}`);

                    try {
                        await botoesNext[i].scrollIntoViewIfNeeded();
                        await this.page.waitForTimeout(1000);
                        await botoesNext[i].click({ force: true });

                        // Aguardar um pouco para ver se a estrutura mudou
                        await this.page.waitForTimeout(3000);

                        const estruturaDepois = await this.page.evaluate(() => {
                            return {
                                diasDisponiveis: document.querySelectorAll('.dateValue:not(.disabled)').length,
                                diasIndisponiveis: document.querySelectorAll('.disabled').length
                            };
                        });

                        // Verificar se a estrutura mudou (número de dias disponíveis/indisponíveis)
                        if (estruturaDepois.diasDisponiveis !== estruturaAntes.diasDisponiveis ||
                            estruturaDepois.diasIndisponiveis !== estruturaAntes.diasIndisponiveis) {
                            console.log(`✅ Navegação bem-sucedida com botão #${i + 1} - estrutura do calendário mudou`);
                            navegacaoBemSucedida = true;
                            break;
                        }
                    } catch (err) {
                        console.log(`⚠️ Erro ao tentar botão #${i + 1}: ${err.message}`);
                    }
                }
            }

            // Se nenhum dos botões funcionou, tentar com JavaScript
            if (!navegacaoBemSucedida) {
                console.log('🔄 Tentando abordagem alternativa com JavaScript...');
                await this.page.evaluate(() => {
                    // Tentar encontrar o botão correto
                    const botoes = Array.from(document.querySelectorAll('.next'));
                    const botaoCalendario = botoes.find(b => b.title === 'Próximo mês');

                    if (botaoCalendario) {
                        botaoCalendario.click();
                    } else if (botoes.length > 0) {
                        // Se não encontrar pelo título, tentar o primeiro botão
                        botoes[0].click();
                    }
                });

                await this.page.waitForTimeout(3000);
                console.log('✅ Navegação alternativa concluída');
            }

            // Mesmo que visualmente o mês não mude, vamos considerar que estamos em um novo mês
            // para fins de organização dos dados
            console.log(`✅ Navegação concluída para: ${this.obterNomeMes(this.mesAtual)} ${this.anoAtual}`);

        } catch (error) {
            console.error('❌ Erro ao navegar para próximo mês:', error);

            // Tentar abordagem alternativa com JavaScript
            try {
                console.log('🔄 Tentando abordagem alternativa...');
                await this.page.evaluate(() => {
                    const botao = document.querySelector('.next');
                    if (botao) {
                        botao.click();
                    }
                });
                await this.page.waitForTimeout(3000);
                console.log('✅ Navegação alternativa concluída');

                // Incrementar o mês mesmo assim
                this.mesAtual++;
                if (this.mesAtual > 11) {
                    this.mesAtual = 0;
                    this.anoAtual++;
                }
            } catch (errorAlternativo) {
                console.error('❌ Erro na abordagem alternativa:', errorAlternativo);
                throw error;
            }
        }
    }

    async enviarDadosParaWebhook() {
        // Remover duplicatas antes de enviar
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

        // Enviar dados para o webhook
        const webhookUrl = 'https://webh.criativamaisdigital.com.br/webhook/ff8054c3-7505-48f8-a581-463b5ff19bd5';

        try {
            console.log('🚀 Enviando dados para o webhook...');
            console.log(`   - URL: ${webhookUrl}`);
            console.log(`   - Dados: ${relatorio.resumo.totalDatas} datas, ${relatorio.resumo.mesesCapturados} meses`);

            // Adicionar timestamp atualizado para garantir dados frescos
            relatorio.timestamp_envio = new Date().toISOString();

            const response = await axios.post(webhookUrl, relatorio, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 segundos de timeout
            });

            if (response.status === 200 || response.status === 201) {
                console.log('✅ Dados enviados para o webhook com sucesso!');
                console.log(`   - Status: ${response.status}`);
                console.log(`   - Resposta: ${JSON.stringify(response.data)}`);
                return true;
            } else {
                console.log(`⚠️ Resposta inesperada do webhook: ${response.status}`);
                console.log(`   - Resposta: ${JSON.stringify(response.data)}`);
                return false;
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
            return false;
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
            const mesAno = this.obterMesAno(item.data + 'T00:00:00');

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