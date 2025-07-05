import { Router } from 'express';
import axios from "axios";

import { verifyJWT } from '../middlewares/verifyJWT';
import { verifyJWTPessoa } from '../middlewares/verifyJWTPessoa';

import { prismaClient } from '../prismaClient/prismaClient';
import { estornarMP } from '../helpers/estornarMP';
import {tempoOffline} from '../helpers/tempoOffline';
import { NOTIFICACOES_PAGAMENTOS } from '../helpers/staticConfig';
import { notificarDiscord } from '../helpers/notificarDiscord';
import { paymentByPeriod } from '../helpers/relatorio';
import { obterDataAtual } from '../helpers/obterDataAtual';

const paymentRoutes = Router();

paymentRoutes.get("/pagamentos/:maquinaId", verifyJWT, async (req: any, res) => {
    try {
        const pagamentos = await prismaClient.pix_Pagamento.findMany({
            where: {
                maquinaId: req.params.maquinaId,
                removido: false
            },
            orderBy: {
                data: 'desc'
            }
        });

        const maquina = await prismaClient.pix_Maquina.findUnique({
            where: {
                id: req.params.maquinaId
            }
        });

        if (!maquina) {
            return res.status(404).json({ error: 'Máquina não encontrada' });
        }

        const estoque = maquina.estoque ?? '--';

        let totalSemEstorno = 0;
        let totalComEstorno = 0;
        let totalEspecie = 0;

        pagamentos.forEach((pagamento) => {
            const valor = parseFloat(pagamento.valor) || 0;

            if (pagamento.estornado) {
                totalComEstorno += valor;
            } else {
                totalSemEstorno += valor;
            }

            if (pagamento.mercadoPagoId === 'CASH') {
                totalEspecie += valor;
            }
        });

        return res.status(200).json({
            total: totalSemEstorno,
            estornos: totalComEstorno,
            cash: totalEspecie,
            estoque,
            pagamentos
        });

    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ "retorno": "Ocorreu um erro ao obter os pagamentos da máquina " + req.params.maquinaId });
    }
});

paymentRoutes.get("/pagamentos-adm/:maquinaId", verifyJWTPessoa, async (req: any, res) => {
    console.log(`${req.params.maquinaId} acessou a rota de pagamentos na visão ADM.`);
    try {
        let totalEspecie = 0.0;

        const pagamentos = await prismaClient.pix_Pagamento.findMany({
            where: {
                maquinaId: req.params.maquinaId,
                removido: false
            },
            orderBy: {
                data: 'desc', // 'desc' para ordem decrescente (da mais recente para a mais antiga)
            }
        });

        const maquina = await prismaClient.pix_Maquina.findUnique({
            where: {
                id: req.params.maquinaId
            }
        });

        if (!maquina) {
            return res.status(404).json({ error: 'Máquina não encontrada' });
        }

        // Verifica se o estoque está definido e retorna seu valor
        const estoque = maquina.estoque !== null ? maquina.estoque : '--';


        let totalSemEstorno = 0;
        let totalComEstorno = 0;

        for (const pagamento of pagamentos) {
            const valor = parseFloat(pagamento.valor);

            if (pagamento.estornado === false) {
                totalSemEstorno += valor;
            } else {
                totalComEstorno += valor;
            }
        }

        const especie = await prismaClient.pix_Pagamento.findMany({
            where: {
                maquinaId: req.params.maquinaId,
                removido: false,
                mercadoPagoId: `CASH`
            }
        });

        for (const e of especie) {
            const valor = parseFloat(e.valor);
            totalEspecie += valor;

        }

        return res.status(200).json({ "total": totalSemEstorno, "estornos": totalComEstorno, "cash": totalEspecie, "estoque": estoque, "pagamentos": pagamentos });
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ "retorno": "ERRO" });
    }
});

paymentRoutes.post("/pagamentos-periodo/:maquinaId", verifyJWT, async (req: any, res) => {
    try {
        const {
            totalSemEstorno,
            totalComEstorno,
            totalEspecie,
            pagamentos
        } = await paymentByPeriod(req.body.dataInicio, req.body.dataFim, req.params.maquinaId)

        return res.status(200).json({ "total": totalSemEstorno, "estornos": totalComEstorno, "cash": totalEspecie, "pagamentos": pagamentos });
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ "retorno": "ERRO" });
    }
});

paymentRoutes.post("/pagamentos-periodo-adm/:maquinaId", verifyJWTPessoa, async (req: any, res) => {
    try {
        let totalEspecie = 0.0;

        const dataInicio = new Date(req.body.dataInicio);

        const dataFim = new Date(req.body.dataFim);

        const pagamentos = await prismaClient.pix_Pagamento.findMany({
            where: {
                maquinaId: req.params.maquinaId,
                data: {
                    gte: dataInicio,
                    lte: dataFim,
                },
            },
            orderBy: {
                data: 'desc', // 'desc' para ordem decrescente (da mais recente para a mais antiga)
            }
        });

        let totalSemEstorno = 0;
        let totalComEstorno = 0;

        for (const pagamento of pagamentos) {
            const valor = parseFloat(pagamento.valor);

            if (pagamento.estornado === false) {
                totalSemEstorno += valor;
            } else {
                totalComEstorno += valor;
            }
        }

        const especie = await prismaClient.pix_Pagamento.findMany({
            where: {
                maquinaId: req.params.maquinaId,
                removido: false,
                mercadoPagoId: `CASH`
            }
        });

        for (const e of especie) {
            const valor = parseFloat(e.valor);
            totalEspecie += valor;

        }

        return res.status(200).json({ "total": totalSemEstorno, "estornos": totalComEstorno, "cash": totalEspecie, "pagamentos": pagamentos });
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ "retorno": "ERRO" });
    }
});

paymentRoutes.delete('/delete-pagamentos/:maquinaId', verifyJWT, async (req, res) => {
    const maquinaId = req.params.maquinaId;

    try {
        // Deletar todos os pagamentos com base no maquinaId
        const updatePagamentos = await prismaClient.pix_Pagamento.updateMany({
            where: {
                maquinaId: maquinaId
            },
            data: {
                removido: true
            }
        });

        res.status(200).json({ message: `Todos os pagamentos para a máquina com ID ${maquinaId} foram removidos.` });
    } catch (error) {
        console.error('Erro ao deletar os pagamentos:', error);
        res.status(500).json({ error: 'Erro ao deletar os pagamentos.' });
    }
});

paymentRoutes.delete('/delete-pagamentos-adm/:maquinaId', verifyJWTPessoa, async (req, res) => {
    const maquinaId = req.params.maquinaId;

    try {
        // Deletar todos os pagamentos com base no maquinaId
        const updatePagamentos = await prismaClient.pix_Pagamento.updateMany({
            where: {
                maquinaId: maquinaId
            },
            data: {
                removido: true
            }
        });

        res.status(200).json({ message: `Todos os pagamentos para a máquina com ID ${maquinaId} foram removidos.` });
    } catch (error) {
        console.error('Erro ao deletar os pagamentos:', error);
        res.status(500).json({ error: 'Erro ao deletar os pagamentos.' });
    }
});

paymentRoutes.get('/verificar-pagamento/:idCliente/:idPagamento', async (req, res) => {
    try {
        // Buscar token do cliente no banco de dados usando Prisma
        const cliente = await prismaClient.pix_Cliente.findUnique({
            where: {
                id: req.params.idCliente,
            }
        });

        // Verifica se o cliente foi encontrado
        if (!cliente) {
            return res.status(404).json({ status: "Cliente não encontrado!" });
        }

        // Verifica se o cliente possui um token do Mercado Pago
        const tokenCliente = cliente.mercadoPagoToken ? cliente.mercadoPagoToken : "";
        if (!tokenCliente) {
            return res.status(403).json({ status: "Cliente sem token!" });
        }

        console.log("Token obtido.");

        // ID do pagamento a ser verificado
        const idPagamento = req.params.idPagamento;

        // URL da API do Mercado Pago para consultar o status do pagamento
        const mercadoPagoUrl = `https://api.mercadopago.com/v1/payments/${idPagamento}`;

        // Faz a requisição GET para a API do Mercado Pago com o token de autorização
        const headers = {
            'Authorization': `Bearer ${tokenCliente}`,
            'Content-Type': 'application/json'
        };

        // Fazendo a requisição para verificar o status do pagamento
        const response = await axios.get(mercadoPagoUrl, { headers });

        // Extrair o status do pagamento da resposta
        const statusPagamento = response.data.status;

        // Verificar se o status é 'approved' (pagamento realizado)
        if (statusPagamento === 'approved') {
            //processar pagamento
            //processamento do pagamento
            var valor = 0.00;
            var tipoPagamento = ``;
            var taxaDaOperacao = ``;
            var cliId = ``;
            var str_id = "";
            var mensagem = `MÁQUINA NÃO ENCONTRADA`;


            console.log("Novo pix do Mercado Pago:");
            console.log(req.body);

            console.log("id");
            console.log(req.query['data.id']);

            const { resource, topic } = req.body;

            // Exibe os valores capturados
            console.log('Resource:', resource);
            console.log('Topic:', topic);

            var url = "https://api.mercadopago.com/v1/payments/" + req.query['data.id'];

            console.log(cliente?.ativo);


            console.log('storetransaction_amount_id', response.data.transaction_amount);

            console.log('payment_method_id', response.data.payment_type_id);

            valor = response.data.transaction_amount;

            tipoPagamento = response.data.payment_type_id;

            console.log('external_reference', response.data.external_reference);

            if (response.data.fee_details && Array.isArray(response.data.fee_details) && response.data.fee_details.length > 0) {
                console.log('Amount:', response.data.fee_details[0].amount);
                taxaDaOperacao = response.data.fee_details[0].amount + "";
            }

            //BUSCAR QUAL MÁQUINA ESTÁ SENDO UTILIZADA (store_id)
            const maquina = await prismaClient.pix_Maquina.findFirst({
                where: {
                    id: response.data.external_reference,
                },
                include: {
                    cliente: true,
                },
            });

            //PROCESSAR O PAGAMENTO (se eu tiver uma máquina com store_id cadastrado)
            if (maquina && maquina.descricao) {
                //VERIFICANDO SE A MÁQUINA PERTENCE A UM CIENTE ATIVO
                if (cliente != null) {
                    if (cliente !== null && cliente !== undefined) {
                        if (cliente.ativo) {
                            console.log("Cliente ativo - seguindo...");

                            //VERIFICAÇÃO DA DATA DE VENCIMENTO:
                            if (cliente.dataVencimento) {
                                if (cliente.dataVencimento != null) {
                                    console.log("verificando inadimplência...");
                                    const dataVencimento: Date = cliente.dataVencimento;
                                    const dataAtual = new Date();
                                    const diferencaEmMilissegundos = dataAtual.getTime() - dataVencimento.getTime();
                                    const diferencaEmDias = Math.floor(diferencaEmMilissegundos / (1000 * 60 * 60 * 24));
                                    console.log(diferencaEmDias);
                                    if (diferencaEmDias > 10) {
                                        console.log("Cliente MENSALIDADE atrasada - estornando...");

                                        //EVITAR ESTORNO DUPLICADO
                                        const registroExistente = await prismaClient.pix_Pagamento.findFirst({
                                            where: {
                                                mercadoPagoId: req.params.idPagamento,
                                                estornado: true,
                                                clienteId: req.params.idCliente
                                            },
                                        });

                                        if (registroExistente) {
                                            console.log("Esse estorno ja foi feito...");
                                            // return res.status(200).json({ "retorno": "error.. cliente ATRASADO - mais de 10 dias sem pagamento!" });
                                            return res.status(200).json({ pago: false });

                                        } else {
                                            console.log("Seguindo...");
                                        }
                                        //FIM EVITANDO ESTORNO DUPLICADO

                                        estornarMP(req.params.idPagamento, tokenCliente, "mensalidade com atraso");
                                        //REGISTRAR O PAGAMENTO

                                        const novoPagamento = await prismaClient.pix_Pagamento.create({
                                            data: {
                                                maquinaId: maquina.id,
                                                valor: valor.toString(),
                                                mercadoPagoId: req.params.idPagamento,
                                                motivoEstorno: `01- mensalidade com atraso. str_id: ${str_id}`,
                                                estornado: true,
                                                data: obterDataAtual()
                                            },
                                        });
                                        // return res.status(200).json({ "retorno": "error.. cliente ATRASADO - mais de 10 dias sem pagamento!" });
                                        return res.status(200).json({ pago: false });

                                    }
                                }
                                else {
                                    console.log("pulando etapa de verificar inadimplência... campo dataVencimento não cadastrado ou nulo!")
                                }
                            }
                            //FIM VERIFICAÇÃO VENCIMENTO

                        } else {
                            console.log("Cliente inativo - estornando...");

                            //EVITAR ESTORNO DUPLICADO
                            const registroExistente = await prismaClient.pix_Pagamento.findFirst({
                                where: {
                                    mercadoPagoId: req.params.idPagamento,
                                    estornado: true,
                                    clienteId: req.params.idCliente
                                },
                            });

                            if (registroExistente) {
                                console.log("Esse estorno ja foi feito...");
                                //  return res.status(200).json({ "retorno": "error.. cliente ATRASADO - mais de 10 dias sem pagamento!" });
                                return res.status(200).json({ pago: false });

                            } else {
                                console.log("Seguindo...");
                            }
                            //FIM EVITANDO ESTORNO DUPLICADO

                            estornarMP(req.params.idPagamento, tokenCliente, "cliente inativo");
                            //REGISTRAR O PAGAMENTO

                            const novoPagamento = await prismaClient.pix_Pagamento.create({
                                data: {
                                    maquinaId: maquina.id,
                                    valor: valor.toString(),
                                    mercadoPagoId: req.params.idPagamento,
                                    motivoEstorno: `02- cliente inativo. str_id: ${str_id}`,
                                    estornado: true,
                                    data: obterDataAtual()
                                },
                            });
                            // return res.status(200).json({ "retorno": "error.. cliente INATIVO - pagamento estornado!" });
                            return res.status(200).json({ pago: false });

                        }
                    } else {
                        console.log("error.. cliente nulo ou não encontrado!");
                        // return res.status(200).json({ "retorno": "error.. cliente nulo ou não encontrado!" });
                        return res.status(200).json({ pago: false });

                    }
                }
                //FIM VERIFICAÇÃO DE CLIENTE ATIVO.

                //VERIFICANDO SE A MÁQUINA ESTÁ OFFLINE
                if (maquina.ultimaRequisicao instanceof Date) {
                    const diferencaEmSegundos = tempoOffline(maquina.ultimaRequisicao);
                    if (diferencaEmSegundos > 60) {
                        console.log("estornando... máquina offline.");

                        //EVITAR ESTORNO DUPLICADO
                        const registroExistente = await prismaClient.pix_Pagamento.findFirst({
                            where: {
                                mercadoPagoId: req.params.idPagamento,
                                estornado: true,
                            },
                        });

                        if (registroExistente) {
                            console.log("Esse estorno ja foi feito...");
                            //return res.status(200).json({ "retorno": "error.. cliente ATRASADO - mais de 10 dias sem pagamento!" });
                            return res.status(200).json({ pago: false });

                        } else {
                            console.log("Seguindo...");
                        }
                        //FIM EVITANDO ESTORNO DUPLICADO

                        estornarMP(req.params.idPagamento, tokenCliente, "máquina offline");
                        //evitando duplicidade de estorno:
                        const estornos = await prismaClient.pix_Pagamento.findMany({
                            where: {
                                mercadoPagoId: req.params.idPagamento,
                                estornado: true,
                                clienteId: req.params.idCliente
                            },
                        });

                        if (estornos) {
                            if (estornos.length > 0) {
                                // return res.status(200).json({ "retorno": "PAGAMENTO JÁ ESTORNADO! - MÁQUINA OFFLINE" });
                                return res.status(200).json({ pago: false });
                            }
                        }
                        //FIM envitando duplicidade de estorno
                        //REGISTRAR ESTORNO

                        const novoPagamento = await prismaClient.pix_Pagamento.create({
                            data: {
                                maquinaId: maquina.id,
                                valor: valor.toString(),
                                mercadoPagoId: req.params.idPagamento,
                                motivoEstorno: `03- máquina offline. str_id: ${str_id}`,
                                estornado: true,
                                data: obterDataAtual()
                            },
                        });
                        // return res.status(200).json({ "retorno": "PAGAMENTO ESTORNADO - MÁQUINA OFFLINE" });
                        return res.status(200).json({ pago: false });

                    }
                } else {
                    console.log("estornando... máquina offline.");

                    //EVITAR ESTORNO DUPLICADO
                    const registroExistente = await prismaClient.pix_Pagamento.findFirst({
                        where: {
                            mercadoPagoId: req.params.idPagamento,
                            estornado: true,
                            clienteId: req.params.idCliente
                        },
                    });

                    if (registroExistente) {
                        console.log("Esse estorno ja foi feito...");
                        // return res.status(200).json({ "retorno": "error.. cliente ATRASADO - mais de 10 dias sem pagamento!" });
                        return res.status(200).json({ pago: false });

                    } else {
                        console.log("Seguindo...");
                    }
                    //FIM EVITANDO ESTORNO DUPLICADO

                    estornarMP(req.params.idPagamento, tokenCliente, "máquina offline");
                    //REGISTRAR O PAGAMENTO

                    const novoPagamento = await prismaClient.pix_Pagamento.create({
                        data: {
                            maquinaId: maquina.id,
                            valor: valor.toString(),
                            mercadoPagoId: req.params.idPagamento,
                            motivoEstorno: `04- máquina offline. str_id: ${str_id}`,
                            estornado: true,
                            data: obterDataAtual()
                        },
                    });
                    // return res.status(200).json({ "retorno": "PAGAMENTO ESTORNADO - MÁQUINA OFFLINE" });
                    return res.status(200).json({ pago: false });

                }
                //FIM VERIFICAÇÃO MÁQUINA OFFLINE

                //VERIFICAR SE O VALOR PAGO É MAIOR QUE O VALOR MÍNIMO

                const valorMinimo = parseFloat(maquina.valorDoPulso);
                if (valor < valorMinimo) {
                    console.log("iniciando estorno...")

                    //EVITAR ESTORNO DUPLICADO
                    const registroExistente = await prismaClient.pix_Pagamento.findFirst({
                        where: {
                            mercadoPagoId: req.params.idPagamento,
                            estornado: true,
                            clienteId: req.params.idCliente
                        },
                    });

                    if (registroExistente) {
                        console.log("Esse estorno ja foi feito...");
                        // return res.status(200).json({ "retorno": "error.. cliente ATRASADO - mais de 10 dias sem pagamento!" });
                        return res.status(200).json({ pago: false });

                    } else {
                        console.log("Seguindo...");
                    }
                    //FIM EVITANDO ESTORNO DUPLICADO


                    //REGISTRAR O PAGAMENTO

                    const novoPagamento = await prismaClient.pix_Pagamento.create({
                        data: {
                            maquinaId: maquina.id,
                            valor: valor.toString(),
                            mercadoPagoId: req.params.idPagamento,
                            motivoEstorno: `05- valor inferior ao mínimo. str_id: ${str_id}`,
                            estornado: true,
                            data: obterDataAtual()
                        },
                    });
                    console.log("estornando valor inferior ao mínimo...");

                    estornarMP(req.params.idPagamento, tokenCliente, "valor inferior ao mínimo");
                    return res.status(200).json({
                        "retorno": `PAGAMENTO ESTORNADO - INFERIOR AO VALOR 
            MÍNIMO DE R$: ${valorMinimo} PARA ESSA MÁQUINA.`
                    });
                } else {
                    console.log("valor permitido finalizando operação...");
                }

                if (response.data.status != "approved") {
                    console.log("pagamento não aprovado!");
                    return;
                }

                //VERIFICAR SE ESSE PAGAMENTO JÁ FOI EFETUADO
                const registroExistente = await prismaClient.pix_Pagamento.findFirst({
                    where: {
                        mercadoPagoId: req.params.idPagamento,
                        clienteId: req.params.idCliente
                    },
                });

                if (registroExistente) {
                    console.log("Esse pagamento ja foi feito...");
                    // return res.status(200).json({ "retorno": "error.. Duplicidade de pagamento!" });
                    return res.status(200).json({ pago: true });

                } else {
                    console.log("Seguindo...");
                }
                //VERIFICAR SE ESSE PAGAMENTO JÁ FOI EFETUADO

                //ATUALIZAR OS DADOS DA MÁQUINA QUE ESTAMOS RECEBENDO O PAGAMENTO
                await prismaClient.pix_Maquina.update({
                    where: {
                        id: maquina.id,
                    },
                    data: {
                        valorDoPix: valor.toString(),
                        ultimoPagamentoRecebido: new Date(Date.now())
                    }
                });

                //REGISTRAR O PAGAMENTO;
                const novoPagamento = await prismaClient.pix_Pagamento.create({
                    data: {
                        maquinaId: maquina.id,
                        valor: valor.toString(),
                        mercadoPagoId: req.params.idPagamento,
                        motivoEstorno: ``,
                        tipo: tipoPagamento,
                        taxas: taxaDaOperacao,
                        clienteId: req.params.idCliente,
                        estornado: false,
                        operadora: `Mercado Pago`,
                        data: obterDataAtual()
                    },
                }).catch(() => {
                    console.log("Ocorreu um erro ao registrar o pagamento no no Mercado Pago via APP")
                });

                if (NOTIFICACOES_PAGAMENTOS) {
                    notificarDiscord(NOTIFICACOES_PAGAMENTOS, `Novo pagamento recebido no Mercado Pago. Via APP. R$: ${valor.toString()}`, `Cliente ${cliente?.nome} Maquina: ${maquina?.nome}. Maquina: ${maquina?.descricao}`)
                }

                console.log('[2] - Pagamento inserido com sucesso:', novoPagamento);
                // return res.status(200).json(novoPagamento);
                return res.status(200).json({ pago: true });
            } else {

                //PROCESSAMENTO DE EVENTOS QUE NÃO SAO PAYMENTS DE LOJAS E CAIXAS


                console.log("Máquina não encontrada");
                // return res.status(200).json({ "retorno": mensagem });
                return res.status(404).json({ pago: false });

            }





            //fim procesar pagamento
        } else {
            return res.status(200).json({ pago: false });
        }

    } catch (error: any) {
        console.error("Erro ao verificar o pagamento: ", error);
        return res.status(500).json({ status: "Erro ao verificar o pagamento", error: error.message });
    }
});


export { paymentRoutes };