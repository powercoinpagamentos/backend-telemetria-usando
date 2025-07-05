import { Router } from 'express';
import axios from 'axios';

import { handleEstorno } from '../helpers/lidarComEstorno';
import { tempoOffline } from '../helpers/tempoOffline';
import { NOTIFICACOES_PAGAMENTOS } from '../helpers/staticConfig';
import { notificarDiscord } from '../helpers/notificarDiscord';

import { prismaClient } from '../prismaClient/prismaClient';
import { obterDataAtual } from '../helpers/obterDataAtual';

const receiptRoutes = Router();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

receiptRoutes.post("/rota-recebimento-mercado-pago-dinamica/:id", async (req: any, res: any) => {
    try {
        if (req.query.id === "123456") {
            return res.status(200).json({ "status": "ok" });
        }

        let valor = 0.00;
        let tipoPagamento = ``;
        let taxaDaOperacao = ``;
        let cliId = ``;
        let str_id = "";
        const mensagem = `MÁQUINA NÃO POSSUI store_id CADASTRADO > ALTERE O store_id dessa máquina para ${str_id} para poder receber pagamentos nela...`;

        console.log("Novo pix do Mercado Pago:");

        const url = `https://api.mercadopago.com/v1/payments/${req.query.id}`;
        const maxAttempts = 50;
        const delayBetweenAttempts = 2000; // 2 segundos
        let attempt = 0;
        let paymentData: any = null;

        // Obter informações do cliente
        const cliente = await prismaClient.pix_Cliente.findUnique({
            where: {
                id: req.params.id,
            }
        });

        const tokenCliente = cliente?.mercadoPagoToken || "";
        cliId = cliente?.id || "";

        if (!tokenCliente) {
            return res.status(400).json({ error: "Token do Mercado Pago não configurado para este cliente" });
        }

        // Função para verificar o status do pagamento
        const checkPaymentStatus = async () => {
            try {
                const response = await axios.get(url, {
                    headers: { Authorization: `Bearer ${tokenCliente}` }
                });
                paymentData = response.data;

                if (paymentData.status === 'approved') {
                    return true;
                }

                if (paymentData.status !== 'pending') {
                    return res.status(200).json({
                        message: `Pagamento com status: ${paymentData.status}`,
                        pago: false
                    });
                }

                return false;
            } catch (error) {
                console.error('Erro ao verificar pagamento:', error);
                return false;
            }
        };

        // Lógica de retentativas
        let isApproved = false;
        do {
            attempt++;
            const result = await checkPaymentStatus();

            if (result === true) {
                isApproved = true;
                break;
            }

            if (result !== false) {
                return; // Já respondeu com erro
            }

            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
            }
        } while (attempt < maxAttempts);

        if (!isApproved) {
            return res.status(200).json({
                message: "Pagamento ainda não aprovado após várias tentativas",
                pago: false
            });
        }

        str_id = paymentData.store_id;
        valor = paymentData.transaction_amount;
        tipoPagamento = paymentData.payment_type_id;

        if (paymentData.fee_details && Array.isArray(paymentData.fee_details) && paymentData.fee_details.length > 0) {
            taxaDaOperacao = paymentData.fee_details[0].amount + "";
        }

        const maquina = await prismaClient.pix_Maquina.findFirst({
            where: {
                store_id: str_id,
                clienteId: req.params.id
            },
            include: {
                cliente: true,
            },
        });

        if (maquina && maquina.disabled) {
            console.log('Estornando por máquina inadimplente!');
            return await handleEstorno(
                "Máquina inadimplente!",
                maquina.id,
                valor,
                req.query.id,
                req.params.id,
                str_id,
                res,
                tokenCliente,
                tipoPagamento
            );
        }

        if (!maquina || !maquina.store_id || maquina.store_id.length === 0) {
            console.log(mensagem);
            return res.status(200).json({ "retorno": mensagem });
        }

        if (!cliente || !cliente.ativo) {
            console.log(cliente ? "Cliente inativo - estornando..." : "error.. cliente nulo ou não encontrado!");
            return await handleEstorno(
                "cliente inativo",
                maquina.id,
                valor,
                req.query.id,
                req.params.id,
                str_id,
                res,
                tokenCliente,
                tipoPagamento
            );
        }

        if (cliente.dataVencimento) {
            const dataVencimento = new Date(cliente.dataVencimento);
            const dataAtual = new Date();
            const diferencaEmDias = Math.floor((dataAtual.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24));

            if (diferencaEmDias > 10) {
                console.log("Cliente MENSALIDADE atrasada - estornando...");
                return await handleEstorno(
                    "mensalidade com atraso",
                    maquina.id,
                    valor,
                    req.query.id,
                    req.params.id,
                    str_id,
                    res,
                    tokenCliente,
                    tipoPagamento
                );
            }
        } else {
            console.log("pulando etapa de verificar inadimplência... campo dataVencimento não cadastrado ou nulo!");
        }

        if (maquina.ultimaRequisicao instanceof Date && tempoOffline(maquina.ultimaRequisicao) > 60) {
            console.log("Máquina offline - estornando...");
            return await handleEstorno(
                "máquina offline",
                maquina.id,
                valor,
                req.query.id,
                req.params.id,
                str_id,
                res,
                tokenCliente,
                tipoPagamento
            );
        }

        const valorMinimo = parseFloat(maquina.valorDoPulso);
        if (valor < valorMinimo) {
            console.log("Valor inferior ao mínimo - estornando...");
            return await handleEstorno(
                `valor inferior ao mínimo de R$ ${valorMinimo}`,
                maquina.id,
                valor,
                req.query.id,
                req.params.id,
                str_id,
                res,
                tokenCliente,
                tipoPagamento
            );
        }

        const registroExistente = await prismaClient.pix_Pagamento.findFirst({
            where: { mercadoPagoId: req.query.id, clienteId: req.params.id },
        });
        if (registroExistente) {
            console.log("Esse pagamento já foi feito...");
            return res.status(200).json({ "retorno": "error.. Duplicidade de pagamento!" });
        }

        console.log(`Atualizando pagamento em ${tipoPagamento} com valor de R$ ${valor.toString()}`);

        const novoPagamento = await prismaClient.pix_Pagamento.create({
            data: {
                maquinaId: maquina.id,
                valor: valor.toString(),
                mercadoPagoId: req.query.id,
                motivoEstorno: ``,
                tipo: tipoPagamento,
                taxas: taxaDaOperacao,
                clienteId: cliId,
                estornado: false,
                operadora: `Mercado Pago`,
                data: obterDataAtual(),
            },
        });

        console.log(`Atualizando a máquina: ${maquina.id} do cliente ${cliente.id} `);
        await prismaClient.pix_Maquina.update({
            where: { id: maquina.id },
            data: { valorDoPix: valor.toString(), ultimoPagamentoRecebido: obterDataAtual() },
        });

        return res.status(200).json(novoPagamento);
    } catch (error: any) {
        console.error("OCORREU UM ERRO AO PROCESSAR O PAGAMENTO!!! ", error.message);
        return res.status(500).json({ "error": "error: " + error.message });
    }
});

receiptRoutes.post("/rota-recebimento-especie/:id", async (req: any, res: any) => {
    try {
        //BUSCAR QUAL MÁQUINA ESTÁ SENDO UTILIZADA (id da máquina)
        const maquina = await prismaClient.pix_Maquina.findUnique({
            where: {
                id: req.params.id,
            }
        });

        const value = req.query.valor;

        //PROCESSAR O PAGAMENTO (se eu tiver uma máquina com store_id cadastrado)
        if (maquina) {
            //REGISTRAR O PAGAMENTO
            const novoPagamento = await prismaClient.pix_Pagamento.create({
                data: {
                    maquinaId: maquina.id,
                    valor: value,
                    mercadoPagoId: "CASH",
                    motivoEstorno: ``,
                    tipo: "CASH",
                    estornado: false,
                    data: obterDataAtual()
                },
            });
            return res.status(200).json({ "pagamento registrado": "Pagamento registrado" });
        }
        else {
            console.log("error.. cliente nulo ou não encontrado!");
            return res.status(404).json({ "retorno": "error.. máquina nulo ou não encontrado!" });
        }
    } catch (error) {
        console.error(error);
        return res.status(402).json({ "error": "error: " + error });
    }
});

export { receiptRoutes };
