import { Router } from 'express';
import util from 'util';
import xml2js from 'xml2js';
import axios from 'axios';

import { tempoOffline } from '../helpers/tempoOffline';
import { NOTIFICACOES_GERAL, NOTIFICACOES_PAGAMENTOS } from '../helpers/staticConfig';
import { estornarOperacaoPagSeguro } from '../helpers/estornarOperacaoPagSeguro';
import { notificarDiscord } from '../helpers/notificarDiscord';

import { prismaClient } from '../prismaClient/prismaClient';
import { obterDataAtual } from '../helpers/obterDataAtual';

const webHooksRoutes = Router();

const parseStringPromise = util.promisify(xml2js.parseString);


webHooksRoutes.post("/webhookmercadopago/:id", async (req: any, res: any) => {
    try {
        if (req.query['data.id'] === "123456" && req.query.type === "payment") {
            console.log("recebendo requisição de teste do Mercado Pago");
            const ipFromHeader = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            console.log("ipFromHeader", ipFromHeader);

            return res.status(200).json({ "status": "ok" });
        }
    } catch (error) {
        console.error(error);
        return res.status(402).json({ "error": "error: " + error });
    }
});

webHooksRoutes.post('/webhookpagbank/:idCliente', async (req: any, res: any) => { // PAGBANK AQUI
    try {
        const PAGSEGURO_API_URL = 'https://ws.pagseguro.uol.com.br/v3/transactions/notifications';

        const notificationCode = req.body.notificationCode;
        const notificationType = req.body.notificationType;

        console.log('Notification Code:', notificationCode);
        console.log('Notification Type:', notificationType);

        let serialNumber = '';

        const cliente = await prismaClient.pix_Cliente.findUnique({
            where: {
                id: req.params.idCliente,
            },
        });

        const tokenCliente = cliente?.pagbankToken || '';
        const emailCliente = cliente?.pagbankEmail || '';

        if (tokenCliente) {
            console.log("Token obtido.");
        }

        if (emailCliente) {
            console.log("Email obtido.");
        }

        console.log("Cliente ativo:", cliente?.ativo);

        // Monta a URL para a consulta da notificação
        const url = `${PAGSEGURO_API_URL}/${notificationCode}?email=${emailCliente}&token=${tokenCliente}`;

        // Faz a requisição GET para a API do PagSeguro
        const response = await axios.get(url);

        // Converte o XML em JSON usando parseStringPromise
        const result: any = await parseStringPromise(response.data);

        const transaction = result.transaction;
        const creditorFees = transaction.creditorFees[0];

        const paymentMethod = transaction.paymentMethod[0];
        console.log('Método de Pagamento - Tipo:', paymentMethod.type[0]);

        console.log('Dados da Transação:', transaction);

        // Verificar se deviceInfo existe e mapear suas propriedades
        if (transaction.deviceInfo && transaction.deviceInfo.length > 0) {
            const deviceInfo = transaction.deviceInfo[0];

            console.log('Device Info encontrado:');
            serialNumber = deviceInfo.serialNumber ? deviceInfo.serialNumber[0] : 'Não disponível';
            console.log('Serial Number:', serialNumber);
            console.log('Referência:', deviceInfo.reference ? deviceInfo.reference[0] : 'Não disponível');
            console.log('Bin:', deviceInfo.bin ? deviceInfo.bin[0] : 'Não disponível');
            console.log('Holder:', deviceInfo.holder ? deviceInfo.holder[0] : 'Não disponível');

            // BUSCAR QUAL MÁQUINA ESTÁ SENDO UTILIZADA (store_id)
            const maquina = await prismaClient.pix_Maquina.findFirst({
                where: {
                    maquininha_serial: serialNumber,
                    clienteId: req.params.idCliente,
                },
                include: {
                    cliente: true,
                },
            });

            console.log("Máquina:", maquina);

            // PROCESSAR O PAGAMENTO (se eu tiver uma máquina com store_id cadastrado)
            if (maquina && maquina.maquininha_serial) {
                console.log(`Processando pagamento na máquina: ${maquina.nome} - id: ${maquina.id}`);

                // Validações antes de processar o pagamento

                // VERIFICANDO SE A MÁQUINA PERTENCE A UM CLIENTE ATIVO
                if (cliente) {
                    if (cliente.ativo) {
                        console.log("Cliente ativo - seguindo...");

                        // VERIFICAÇÃO DA DATA DE VENCIMENTO:
                        if (cliente.dataVencimento) {
                            const dataVencimento: Date = cliente.dataVencimento;
                            const dataAtual = new Date();
                            const diferencaEmMilissegundos = dataAtual.getTime() - dataVencimento.getTime();
                            const diferencaEmDias = Math.floor(diferencaEmMilissegundos / (1000 * 60 * 60 * 24));

                            console.log(diferencaEmDias);

                            if (diferencaEmDias > 10) {
                                console.log("Cliente MENSALIDADE atrasada - estornando...");

                                // EVITAR ESTORNO DUPLICADO
                                const registroExistente = await prismaClient.pix_Pagamento.findFirst({
                                    where: {
                                        mercadoPagoId: transaction.code[0].toString(),
                                        estornado: true,
                                        clienteId: req.params.idCliente,
                                    },
                                });

                                if (registroExistente) {
                                    console.log("Esse estorno já foi feito...");
                                    return res.status(200).json({ retorno: "Erro: cliente atrasado - mais de 10 dias sem pagamento!" });
                                }

                                console.log("3561");
                                estornarOperacaoPagSeguro(emailCliente, tokenCliente, transaction.code[0].toString());

                                // REGISTRAR O PAGAMENTO
                                const novoPagamento = await prismaClient.pix_Pagamento.create({
                                    data: {
                                        maquinaId: maquina.id,
                                        valor: transaction.netAmount[0].toString(),
                                        mercadoPagoId: transaction.code[0].toString(),
                                        motivoEstorno: '01 - Mensalidade com atraso.',
                                        estornado: true,
                                        operadora: "Pagbank",
                                        clienteId: req.params.idCliente,
                                        data: obterDataAtual()
                                    },
                                });

                                return res.status(200).json({ retorno: "Erro: cliente atrasado - mais de 10 dias sem pagamento!" });
                            }
                        } else {
                            console.log("Pulando etapa de verificar inadimplência... campo dataVencimento não cadastrado ou nulo!");
                        }
                    } else {
                        console.log("Cliente inativo - estornando...");

                        // EVITAR ESTORNO DUPLICADO
                        const registroExistente = await prismaClient.pix_Pagamento.findFirst({
                            where: {
                                mercadoPagoId: transaction.code[0].toString(),
                                estornado: true,
                                clienteId: req.params.idCliente,
                            },
                        });

                        if (registroExistente) {
                            console.log("Esse estorno já foi feito...");
                            return res.status(200).json({ retorno: "Erro: cliente inativo!" });
                        }

                        console.log("3598");
                        estornarOperacaoPagSeguro(emailCliente, tokenCliente, transaction.code[0].toString());

                        // REGISTRAR O PAGAMENTO
                        const novoPagamento = await prismaClient.pix_Pagamento.create({
                            data: {
                                maquinaId: maquina.id,
                                valor: transaction.netAmount[0].toString(),
                                mercadoPagoId: transaction.code[0].toString(),
                                motivoEstorno: '02 - Cliente inativo.',
                                estornado: true,
                                operadora: "Pagbank",
                                clienteId: req.params.idCliente,
                                data: obterDataAtual()
                            },
                        });

                        return res.status(200).json({ retorno: "Erro: cliente inativo - pagamento estornado!" });
                    }
                }

                // VERIFICANDO SE A MÁQUINA ESTÁ OFFLINE
                if (maquina.ultimaRequisicao instanceof Date) {
                    const diferencaEmSegundos = tempoOffline(maquina.ultimaRequisicao);
                    if (diferencaEmSegundos > 60) {
                        console.log("Estornando... máquina offline.");

                        // EVITAR ESTORNO DUPLICADO
                        const registroExistente = await prismaClient.pix_Pagamento.findFirst({
                            where: {
                                mercadoPagoId: transaction.code[0].toString(),
                                estornado: true,
                                clienteId: req.params.idCliente,
                            },
                        });

                        if (registroExistente) {
                            console.log("Esse estorno já foi feito...");
                            return res.status(200).json({ retorno: "Erro: Esse estorno já foi feito..." });
                        }

                        console.log("3637");
                        estornarOperacaoPagSeguro(emailCliente, tokenCliente, transaction.code[0].toString());

                        // REGISTRAR O ESTORNO
                        const novoPagamento = await prismaClient.pix_Pagamento.create({
                            data: {
                                maquinaId: maquina.id,
                                valor: transaction.netAmount[0].toString(),
                                mercadoPagoId: transaction.code[0].toString(),
                                motivoEstorno: '03 - Máquina offline.',
                                clienteId: req.params.idCliente,
                                estornado: true,
                                data: obterDataAtual()
                            },
                        });

                        return res.status(200).json({ retorno: "Pagamento estornado - Máquina offline" });
                    }
                }

                // VERIFICAR SE O VALOR PAGO É MAIOR QUE O VALOR MÍNIMO
                const valorMinimo = parseFloat(maquina.valorDoPulso);
                const valorAtual = parseFloat(transaction.netAmount[0].toString());

                console.log("Valor atual: " + valorAtual);

                if (valorAtual < valorMinimo) {
                    console.log("Iniciando estorno...");

                    // EVITAR ESTORNO DUPLICADO
                    const registroExistente = await prismaClient.pix_Pagamento.findFirst({
                        where: {
                            mercadoPagoId: transaction.code[0].toString(),
                            estornado: true,
                            clienteId: req.params.idCliente,
                        },
                    });

                    if (registroExistente) {
                        console.log("Esse estorno já foi feito...");
                        return res.status(200).json({ retorno: "Erro: Esse estorno já foi feito..." });
                    }

                    console.log("3578");
                    estornarOperacaoPagSeguro(emailCliente, tokenCliente, transaction.code[0].toString());

                    // REGISTRAR O PAGAMENTO
                    const novoPagamento = await prismaClient.pix_Pagamento.create({
                        data: {
                            maquinaId: maquina.id,
                            valor: transaction.netAmount[0].toString(),
                            mercadoPagoId: transaction.code[0].toString(),
                            motivoEstorno: '05 - Valor inferior ao mínimo.',
                            estornado: true,
                            operadora: "Pagbank",
                            clienteId: req.params.idCliente,
                            data: obterDataAtual()
                        },
                    });

                    return res.status(200).json({ retorno: `Pagamento estornado - Inferior ao valor mínimo de R$: ${valorMinimo} para essa máquina.` });
                }

                // ATUALIZAR OS DADOS DA MÁQUINA
                await prismaClient.pix_Maquina.update({
                    where: {
                        id: maquina.id,
                    },
                    data: {
                        valorDoPix: transaction.netAmount[0].toString(),
                        ultimoPagamentoRecebido: new Date(Date.now()),
                    },
                });

                // REGISTRAR O PAGAMENTO
                const novoPagamento = await prismaClient.pix_Pagamento.create({
                    data: {
                        maquinaId: maquina.id,
                        valor: transaction.netAmount[0].toString(),
                        mercadoPagoId: transaction.code[0].toString(),
                        motivoEstorno: '',
                        tipo: paymentMethod.type[0].toString(),
                        taxas: creditorFees.intermediationRateAmount[0].toString(),
                        clienteId: req.params.idCliente,
                        estornado: false,
                        operadora: 'Pagbank',
                        data: obterDataAtual()
                    },
                });

                if (NOTIFICACOES_PAGAMENTOS) {
                    notificarDiscord(NOTIFICACOES_PAGAMENTOS, `Novo pagamento recebido no Pagbank. R$: ${transaction.netAmount[0].toString()}`, `Cliente ${cliente?.nome} Maquina: ${maquina?.nome}. Maquina: ${maquina?.descricao}`)
                }

                console.log('Pagamento inserido com sucesso:', novoPagamento);
            } else {
                console.log(`Nova maquininha detectada não cadastrada. Serial: ${serialNumber} - cliente: ${cliente?.nome}`);

                if (NOTIFICACOES_GERAL) {
                    notificarDiscord(NOTIFICACOES_GERAL, `Pagamento recebido em maquininha não cadastrada.`, `Cliente ${cliente?.nome} Serial: ${serialNumber}. Maquina: ${maquina?.nome}
            Maquina: ${maquina?.descricao}`)
                }

            }
        } else {
            console.log('Device Info não encontrado.');
        }

        // Retorna os dados da transação em JSON
        res.status(200).json(result);
    } catch (error: any) {
        console.error('Erro ao processar a requisição:', error.message);
        res.status(500).send('Erro ao processar a requisição');
    }
});

export { webHooksRoutes };