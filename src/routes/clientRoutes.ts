import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { NOTIFICACOES_GERAL, NOTIFICACOES_LOGINS, SECRET } from '../helpers/staticConfig';
import { notificarDiscord } from '../helpers/notificarDiscord';
import { calcularDiferencaEmDias } from '../helpers/calcularDiferencaEmDias';
import { criarSenha } from '../helpers/criarSenha';

import { prismaClient } from '../prismaClient/prismaClient';
import { verifyJWTPessoa } from '../middlewares/verifyJWTPessoa';
import {tempoOffline} from "../helpers/tempoOffline";

const clientRoutes = Router();

clientRoutes.post("/cliente", verifyJWTPessoa, async (req: any, res) => {
    try {
        const salt = await bcrypt.genSalt(10);

        req.body.senha = await bcrypt.hash(req.body.senha, salt);

        req.body.pessoaId = req.userId;

        const cliente = await prismaClient.pix_Cliente.create({data: req.body});

        cliente.senha = "";

        return res.json(cliente);
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({error: `>>:${err.message}`});
    }
});

clientRoutes.put("/cliente", verifyJWTPessoa, async (req: any, res) => {
    try {
        req.body.pessoaId = req.userId;
        const clienteAtualizado = await prismaClient.pix_Cliente.update({
            where: {
                id: req.body.id,
            },
            data: {
                nome: req.body.nome,
                mercadoPagoToken: req.body.mercadoPagoToken,
                dataVencimento: req.body.dataVencimento,
                pagbankToken: req.body.pagbankToken,
                pagbankEmail: req.body.pagbankEmail,
                cellphone: req.body.cellphone,
            },
            select: {
                id: true,
                nome: true,
                mercadoPagoToken: false,
                dataVencimento: true,
                cellphone: true,
            },
        });
        return res.json(clienteAtualizado);
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({error: `>>:${err.message}`});
    }
});

clientRoutes.delete('/cliente/:id', verifyJWTPessoa, async (req, res) => {
    const clienteId = req.params.id;

    try {
        const cliente = await prismaClient.pix_Cliente.findUnique({
            where: {
                id: clienteId,
            },
        });

        if (!cliente) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        await prismaClient.pix_Cliente.delete({
            where: {
                id: clienteId,
            },
        });
        res.json({ message: 'Cliente excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir o cliente:', error);
        res.status(500).json({ error: 'Erro ao excluir o cliente' });
    }
});

clientRoutes.put('/alterar-cliente-adm-new/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, mercadoPagoToken, pagbankToken, dataVencimento, pagbankEmail, cellphone } = req.body;

    try {
        const updatedCliente = await prismaClient.pix_Cliente.update({
            where: { id },
            data: {
                nome,
                mercadoPagoToken,
                pagbankToken,
                pagbankEmail,
                dataVencimento,
                cellphone
            },
        });

        const protectedCliente = { ...updatedCliente };

        if (protectedCliente.mercadoPagoToken) {
            protectedCliente.mercadoPagoToken = protectedCliente.mercadoPagoToken.slice(-3).padStart(protectedCliente.mercadoPagoToken.length, '*');
        }

        if (protectedCliente.pagbankToken) {
            protectedCliente.pagbankToken = protectedCliente.pagbankToken.slice(-3).padStart(protectedCliente.pagbankToken.length, '*');
        }

        if (protectedCliente.senha) {
            protectedCliente.senha = '***';
        }

        res.json(protectedCliente);
    } catch (error) {
        console.error('Erro ao alterar o cliente:', error);
        res.status(500).json({ "message": 'Erro ao alterar o cliente' });
    }
});

clientRoutes.put("/cliente-sem-token", verifyJWTPessoa, async (req: any, res) => {
    try {
        req.body.pessoaId = req.userId;
        const clienteAtualizado = await prismaClient.pix_Cliente.update({
            where: {
                id: req.body.id,
            },
            data:
                {
                    nome: req.body.nome,
                    dataVencimento: req.body.dataVencimento
                },
            select: {
                id: true,
                nome: true,
                mercadoPagoToken: false,
                dataVencimento: true
            },
        });
        return res.json(clienteAtualizado);
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ error: `>>:${err.message}` });
    }
});

clientRoutes.put("/cliente-trocar-senha", verifyJWTPessoa, async (req: any, res) => {
    let novaSenha = "";
    let senhaCriptografada = "";
    try {
        novaSenha = criarSenha();

        const salt = await bcrypt.genSalt(10);

        senhaCriptografada = await bcrypt.hash(novaSenha, salt);

        const clienteAtualizado = await prismaClient.pix_Cliente.update({
            where: { email: req.body.email },
            data: { senha: senhaCriptografada },
        });

        if (clienteAtualizado) {
            if (NOTIFICACOES_GERAL) {
                await notificarDiscord(NOTIFICACOES_GERAL, "Troca de senha efetuada", `Cliente ${clienteAtualizado.nome} acabou de ter sua senha redefinida.`)
            }

            return res.json({ "newPassword": novaSenha });
        } else {
            return res.status(301).json({ error: `>>:cliente não encontrado` });
        }
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ error: `>:cliente não encontrado` });
    }
});

clientRoutes.get("/clientes", verifyJWTPessoa, async (req: any, res) => {
    console.log(`${req.userId} acessou a rota que busca todos os clientes e suas máquinas.`);
    try {
        const clientesComMaquinas = await prismaClient.pix_Cliente.findMany({
            where: {
                pessoaId: req.userId,
            },
            select: {
                id: true,
                nome: true,
                email: true,
                dataInclusao: true,
                ultimoAcesso: true,
                ativo: true,
                senha: false,
                mercadoPagoToken: true,
                pagbankEmail: true,
                pagbankToken: true,
                dataVencimento: true,
                cellphone: true,
                Maquina: {
                    select: {
                        id: true,
                        nome: true,
                        descricao: true,
                        store_id: true,
                        dataInclusao: true,
                        ultimoPagamentoRecebido: true,
                        ultimaRequisicao: true,
                        maquininha_serial: true,
                    },
                },
            },
            orderBy: {
                dataInclusao: 'desc',
            },
        });

        if (clientesComMaquinas != null) {
            const clientesModificados = clientesComMaquinas.map(cliente => ({
                ...cliente,
                mercadoPagoToken: cliente.mercadoPagoToken ? "***********" + cliente.mercadoPagoToken.slice(-3) : null,
                pagbankToken: cliente.pagbankToken ? "***********" + cliente.pagbankToken.slice(-3) : null, // Oculta o pagbankToken
            }));

            return res.status(200).json(clientesModificados);
        } else {
            console.log("não encontrou");
            return res.status(200).json("[]");
        }
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ "retorno": "ERRO" });
    }
});

clientRoutes.get("/cliente", verifyJWTPessoa, async (req: any, res) => {
    console.log('[ADM]: Obtendo cliente ' + req.query.id);
    try {
        const clienteComMaquinas = await prismaClient.pix_Cliente.findFirst({
            where: {
                id: req.query.id,
            },
            select: {
                id: true,
                nome: true,
                email: true,
                dataInclusao: true,
                ultimoAcesso: true,
                ativo: true,
                senha: false,
                mercadoPagoToken: true,
                pagbankEmail: true,
                pagbankToken: true,
                dataVencimento: true,
                Maquina: true,
                aviso: true,
                cellphone: true,
            },
        });

        if (clienteComMaquinas != null) {
            const maquinasComTotais = await Promise.all(
                clienteComMaquinas.Maquina.map(async (maquina) => {
                    const pagamentosDaMaquina = await prismaClient.pix_Pagamento.findMany({
                        where: {
                            maquinaId: maquina.id,
                            removido: false
                        },
                        orderBy: {
                            data: 'desc'
                        }
                    });

                    let status = "OFFLINE";

                    if (maquina.ultimaRequisicao) {
                        const tempoDesdeUltimaRequisicao = tempoOffline(new Date(maquina.ultimaRequisicao));
                        const tempoDesdeUltimoPagamento = maquina.ultimoPagamentoRecebido
                            ? tempoOffline(new Date(maquina.ultimoPagamentoRecebido))
                            : Infinity;

                        status = tempoDesdeUltimaRequisicao > 15 ? "OFFLINE" : "ONLINE";

                        if (status === "ONLINE" && tempoDesdeUltimoPagamento < 15) {
                            status = "PAGAMENTO_RECENTE";
                        }
                    }

                    let totalSemEstorno = 0;
                    let totalComEstorno = 0;
                    let totalEspecie = 0;

                    pagamentosDaMaquina.forEach((pagamento) => {
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

                    return {
                        ...maquina,
                        totalSemEstorno,
                        totalComEstorno,
                        totalEspecie,
                        pulso: maquina.valorDoPulso,
                        status
                    };
                })
            );

            const clientesModificados = {
                ...clienteComMaquinas,
                Maquina: maquinasComTotais
            };

            return res.status(200).json(clientesModificados);
        } else {
            console.log("não encontrou");
            return res.status(200).json("[]");
        }
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ "retorno": "ERRO" });
    }
});

clientRoutes.post("/ativar-cliente", verifyJWTPessoa, async (req, res) => {
    try {
        const cliente = await prismaClient.pix_Cliente.findUnique({
            where: {
                id: req.body.clienteId
            },
        })

        if (!cliente) {
            return res.status(404).json({ error: "Client not found" });
        }

        await prismaClient.pix_Cliente.update({
            where: {
                id: req.body.clienteId
            },
            data: {
                ativo: true
            }
        });

        return res.status(200).json({ "retorno": `CLIENTE ${cliente.nome} DESBLOQUEADO` });
    } catch (error) {

        const { message } = error as Error;

        return res.status(403).json({ error: message });
    }
});

clientRoutes.post("/inativar-cliente", verifyJWTPessoa, async (req, res) => {
    try {
        const cliente = await prismaClient.pix_Cliente.findUnique({
            where: {
                id: req.body.clienteId
            },
        })

        if (!cliente) {
            return res.status(404).json({ error: 'Client not found' });
        }

        await prismaClient.pix_Cliente.update({
            where: {
                id: req.body.clienteId
            },
            data: {
                ativo: false
            }
        });

        return res.status(200).json({ "retorno": `CLIENTE ${cliente.nome} BLOQUEADO` });
    } catch (error) {

        const { message } = error as Error;

        return res.status(403).json({ error: message });
    }
});

clientRoutes.post("/login-cliente", async (req, res) => {
    try {
        const user = await prismaClient.pix_Cliente.findUnique({
            where: {
                email: req.body.email
            },
        })

        if (!user) {
            return res.status(400).json({ error: 'Password or Email Invalid' });
        }

        const validPassword = await bcrypt.compare(req.body.senha, user.senha);

        if (!validPassword) {
            return res.status(400).json({ error: 'Password or Email Invalid' });
        }

        await prismaClient.pix_Cliente.update({
            where: {
                email: req.body.email
            },
            data: { ultimoAcesso: new Date(Date.now()) }
        })

        const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: 3600 }); //5min = 300 para 1h = 3600

        let warningMsg = "";

        if (user) {
            if (user.dataVencimento) {
                const diferencaEmMilissegundos = new Date().getTime() - user.dataVencimento.getTime();
                const diferencaEmDias = Math.floor(diferencaEmMilissegundos / (1000 * 60 * 60 * 24));
                console.log("atraso: " + diferencaEmDias);
                if (diferencaEmDias > 0 && diferencaEmDias <= 5) {
                    warningMsg = `Atenção! Regularize seu pagamento!`
                }
                if (diferencaEmDias > 5 && diferencaEmDias <= 10) {
                    warningMsg = `seu plano será bloqueado em  ${diferencaEmDias} dia(s), efetue pagamento e evite o bloqueio.`
                }
                if (diferencaEmDias > 10) {
                    warningMsg = `seu plano está bloqueado, entre em contato com o setor financeiro!`
                }
            }
        }

        if (NOTIFICACOES_LOGINS) {
            await notificarDiscord(NOTIFICACOES_LOGINS, "Novo login efetuado", `Cliente ${user.nome} acabou de fazer login.`)
        }

        return res.json({ email: user.email, id: user.id, type: "pessoa", key: "CLIENT", name: user.nome, lastLogin: user.ultimoAcesso, ativo: user.ativo, warningMsg: warningMsg, vencimento: user.dataVencimento, token });
    } catch (error) {

        const { message } = error as Error;

        return res.status(403).json({ error: message });
    }
});

clientRoutes.get('/is-client-ok/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Busca o cliente pelo ID
        const cliente = await prismaClient.pix_Cliente.findUnique({
            where: { id },
        });

        if (!cliente) {
            return res.status(404).json({ status: null });
        }

        // Verifica se o cliente está ativo
        if (!cliente.ativo) {
            return res.status(400).json({ status: null });
        }

        // Verifica se a data de vencimento está definida e calcula a diferença em dias
        if (cliente.dataVencimento) {
            const diferencaEmDias = calcularDiferencaEmDias(cliente.dataVencimento);

            if (diferencaEmDias > 10) {
                return res.json({ status: false });
            } else {
                return res.json({ status: true });
            }
        } else {
            return res.status(400).json({ status: null });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: null });
    }
});

clientRoutes.get('/warning/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const cliente = await prismaClient.pix_Cliente.findUnique({
            where: { id },
        });

        if (!cliente) {
            return res.status(404).json({ status: null });
        }

        return res.json({ message: cliente.aviso });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: null });
    }
});

export { clientRoutes };