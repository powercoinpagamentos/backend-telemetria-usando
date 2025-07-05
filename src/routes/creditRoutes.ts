import { Router } from 'express';

import { verifyJWTPessoa } from '../middlewares/verifyJWTPessoa';

import { prismaClient } from '../prismaClient/prismaClient';

import { tempoOffline } from '../helpers/tempoOffline';
import { NOTIFICACOES_CREDITO_REMOTO } from '../helpers/staticConfig';
import { notificarDiscord } from '../helpers/notificarDiscord';
import { verifyJWT } from '../middlewares/verifyJWT';

const creditRoutes = Router();

creditRoutes.post("/credito-remoto", verifyJWTPessoa, async (req: any, res) => {
    try {

        const maquina = await prismaClient.pix_Maquina.findUnique({
            where: {
                id: req.body.id,
            },
            include: {
                cliente: true,
            },
        });

        //VERIFICANDO SE A MÁQUINA PERTENCE A UM CIENTE ATIVO
        if (maquina != null) {
            if (maquina.cliente !== null && maquina.cliente !== undefined) {
                if (maquina.cliente.ativo) {
                    console.log("Cliente ativo - seguindo...");
                } else {
                    console.log("Cliente inativo - parando...");
                    return res.status(500).json({ "retorno": `CLIENTE ${maquina.cliente.nome} INATIVO` });
                }
            } else {
                console.log("error.. cliente nulo!");
            }

            //VERIFICAR SE A MAQUINA ESTA ONINE
            if (maquina.ultimaRequisicao) {
                var status = (tempoOffline(new Date(maquina.ultimaRequisicao))) > 15 ? "OFFLINE" : "ONLINE";
                console.log(status);
                if (status == "OFFLINE") {
                    return res.status(400).json({ "msg": "MÁQUINA OFFLINE!" });
                }
            } else {
                return res.status(400).json({ "msg": "MÁQUINA OFFLINE!" });
            }

            await prismaClient.pix_Maquina.update({
                where: {
                    id: req.body.id
                },
                data: {
                    valorDoPix: req.body.valor,
                    ultimoPagamentoRecebido: new Date(Date.now())
                }
            });

            if (NOTIFICACOES_CREDITO_REMOTO) {
                notificarDiscord(NOTIFICACOES_CREDITO_REMOTO, `CRÉDITO REMOTO DE R$: ${req.body.valor}`, `Enviado pelo adm.`)
            }

            return res.status(200).json({ "retorno": "CREDITO INSERIDO" });

        } else {
            console.log("não encontrou");
            return res.status(301).json({ "retorno": "ID NÃO ENCONTRADO" });
        }

    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ "retorno": "ERRO: see: console > view logs" });
    }
});

creditRoutes.post("/credito-remoto-cliente", verifyJWT, async (req: any, res) => {
    try {
        const maquina = await prismaClient.pix_Maquina.findUnique({
            where: {
                id: req.body.id,
            },
            include: {
                cliente: true,
            },
        });


        //VERIFICANDO SE A MÁQUINA PERTENCE A UM CIENTE ATIVO
        if (maquina != null) {
            if (maquina.cliente !== null && maquina.cliente !== undefined) {
                if (maquina.cliente.ativo) {
                    console.log("Cliente ativo - seguindo...");
                } else {
                    console.log("Cliente inativo - parando...");
                    return res.status(500).json({ "retorno": `CLIENTE ${maquina.cliente.nome} INATIVO` });
                }
            } else {
                console.log("error.. cliente nulo!");
            }

            //VERIFICAR SE A MAQUINA ESTA ONINE
            if (maquina.ultimaRequisicao) {
                var status = (tempoOffline(new Date(maquina.ultimaRequisicao))) > 15 ? "OFFLINE" : "ONLINE";
                console.log(status);
                if (status == "OFFLINE") {
                    return res.status(400).json({ "msg": "MÁQUINA OFFLINE!" });
                }
            } else {
                return res.status(400).json({ "msg": "MÁQUINA OFFLINE!" });
            }


            await prismaClient.pix_Maquina.update({
                where: {
                    id: req.body.id
                },
                data: {
                    valorDoPix: req.body.valor,
                    ultimoPagamentoRecebido: new Date(Date.now())
                }
            });

            if (NOTIFICACOES_CREDITO_REMOTO) {
                await notificarDiscord(NOTIFICACOES_CREDITO_REMOTO, `CRÉDITO REMOTO DE R$: ${req.body.valor}`, `Enviado pelo cliente.`)
            }

            return res.status(200).json({ "retorno": "CREDITO INSERIDO" });

        } else {
            console.log("não encontrou");
            return res.status(301).json({ "retorno": "ID NÃO ENCONTRADO" });
        }

    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ "retorno": "ERRO: see: console > view logs" });
    }
});

export { creditRoutes };

