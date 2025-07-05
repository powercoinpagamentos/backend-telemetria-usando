import { Router } from 'express';

import { verifyJWTPessoa } from '../middlewares/verifyJWTPessoa';
import { verifyJWT } from '../middlewares/verifyJWT';

import { tempoOffline } from '../helpers/tempoOffline';
import { sendDisabledEmail } from '../helpers/sendDisabledEmail';
import { sendEnableEmail } from '../helpers/sendEnableEmail';

import { prismaClient } from '../prismaClient/prismaClient';
import axios from "axios";

const machineRoutes = Router();

machineRoutes.post("/maquina", verifyJWTPessoa, async (req: any, res) => {
    try {
        req.body.pessoaId = req.userId;

        // Inicializa as condições com nome e clienteId, que são obrigatórios
        const condicoes: any[] = [
            {
                nome: req.body.nome,
                clienteId: req.body.clienteId
            }
        ];

        // Adicione condicionalmente o store_id se ele não for nulo ou undefined
        if (req.body.store_id) {
            condicoes.push({
                store_id: req.body.store_id,
                clienteId: req.body.clienteId
            });
        }

        // Adicione condicionalmente o maquininha_serial se ele não for nulo ou undefined
        if (req.body.maquininha_serial) {
            condicoes.push({
                maquininha_serial: req.body.maquininha_serial,
                clienteId: req.body.clienteId
            });
        }

        // Verifique se já existe uma máquina com os dados fornecidos
        const maquinaExistente = await prismaClient.pix_Maquina.findFirst({
            where: {
                OR: condicoes
            },
            select: {
                id: true, // Retorna o ID da máquina conflitante
                nome: true, // Retorna o nome da máquina conflitante
                store_id: true, // Retorna o store_id da máquina conflitante
                maquininha_serial: true // Retorna o maquininha_serial da máquina conflitante
            }
        });

        if (maquinaExistente) {
            return res.status(400).json({
                error: `Já existe uma máquina com o nome (${maquinaExistente.nome}), store_id (${maquinaExistente.store_id}) ou maquininha_serial (${maquinaExistente.maquininha_serial}) para este cliente.`,
            });
        }

        const maquina = await prismaClient.pix_Maquina.create({ data: req.body });

        return res.json(maquina);
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ error: `Erro ao criar a máquina: ${err.message}` });
    }
});

machineRoutes.post("/maquina-cliente", verifyJWT, async (req: any, res) => {
    try {
        req.body.clienteId = req.userId;
        // Busca o cliente e o pessoaId através da tabela Pix_Cliente
        const cliente = await prismaClient.pix_Cliente.findUnique({
            where: {
                id: req.body.clienteId, // Usando o clienteId passado no corpo da requisição
            },
            select: {
                pessoaId: true, // Seleciona o campo pessoaId relacionado
            },
        });

        // Verifica se o cliente foi encontrado
        if (!cliente) {
            return res.status(404).json({ error: "Cliente não encontrado." });
        }

        // Atribui o pessoaId ao corpo da requisição
        req.body.pessoaId = cliente.pessoaId;

        // Inicializa as condições com nome e clienteId, que são obrigatórios
        const condicoes: any[] = [
            {
                nome: req.body.nome,
                clienteId: req.body.clienteId
            }
        ];

        // Adicione condicionalmente o store_id se ele não for nulo ou undefined
        if (req.body.store_id) {
            condicoes.push({
                store_id: req.body.store_id,
                clienteId: req.body.clienteId
            });
        }

        // Adicione condicionalmente o maquininha_serial se ele não for nulo ou undefined
        if (req.body.maquininha_serial) {
            condicoes.push({
                maquininha_serial: req.body.maquininha_serial,
                clienteId: req.body.clienteId
            });
        }

        // Verifique se já existe uma máquina com os dados fornecidos
        const maquinaExistente = await prismaClient.pix_Maquina.findFirst({
            where: {
                OR: condicoes
            },
            select: {
                id: true, // Retorna o ID da máquina conflitante
                nome: true, // Retorna o nome da máquina conflitante
                store_id: true, // Retorna o store_id da máquina conflitante
                maquininha_serial: true // Retorna o maquininha_serial da máquina conflitante
            }
        });

        if (maquinaExistente) {
            return res.status(400).json({
                error: `Já existe uma máquina com o nome (${maquinaExistente.nome}), store_id (${maquinaExistente.store_id}) ou maquininha_serial (${maquinaExistente.maquininha_serial}) para este cliente.`,
            });
        }

        // Cria a nova máquina, caso não haja conflitos
        const maquina = await prismaClient.pix_Maquina.create({ data: req.body });

        return res.json(maquina);
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ error: `Erro ao criar a máquina: ${err.message}` });
    }
});

machineRoutes.put('/recuperar-id-maquina/:id', verifyJWTPessoa, async (req, res) => {
    const { id } = req.params;
    const { novoId } = req.body;

    try {
        // Verifica se a máquina com o ID atual existe
        const maquinaExistente = await prismaClient.pix_Maquina.findUnique({
            where: { id },
        });

        if (!maquinaExistente) {
            return res.status(404).json({ error: 'Máquina não encontrada' });
        }

        // Atualiza o ID da máquina
        const maquinaAtualizada = await prismaClient.pix_Maquina.update({
            where: { id },
            data: { id: novoId },
        });

        res.json({ message: 'ID da máquina atualizado com sucesso', maquina: maquinaAtualizada });
    } catch (error) {
        console.error('Erro ao alterar o ID da máquina:', error);
        res.status(500).json({ error: 'Erro ao alterar o ID da máquina' });
    }
});

machineRoutes.put("/maquina", verifyJWTPessoa, async (req: any, res) => {
    try {
        const maquinaAtualizada = await prismaClient.pix_Maquina.update({
            where: {
                id: req.body.id,
            },
            data: {
                nome: req.body.nome,
                descricao: req.body.descricao,
                store_id: req.body.store_id,
                maquininha_serial: req.body.maquininha_serial,
                valorDoPulso: req.body.valorDoPulso,
                estoque: req.body.estoque
            },
        });

        return res.status(200).json(maquinaAtualizada);
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ error: `Erro ao atualizar a máquina: ${err.message}` });
    }
});

machineRoutes.put("/maquina-cliente", verifyJWT, async (req: any, res) => {
    try {
        const {
            nome,
            store_id,
            id,
            descricao,
            valorDoPulso,
            estoque
        } = req.body;

        if (!id || !nome || !store_id || !descricao || !valorDoPulso) {
            return res.status(400).json({ error: "Todos os campos obrigatórios devem ser fornecidos." });
        }

        const maquinaExistente = await prismaClient.pix_Maquina.findFirst({
            where: {
                clienteId: req.userId,
                OR: [
                    { nome },
                    { store_id },
                ],
                NOT: { id }
            },
            select: {
                id: true,
                nome: true,
                store_id: true,
                maquininha_serial: true
            }
        });

        if (maquinaExistente) {
            const { nome: nomeExistente, store_id: storeIdExistente, maquininha_serial: serialExistente } = maquinaExistente;
            return res.status(400).json({
                error: `Já existe uma máquina com os mesmos dados: nome (${nomeExistente}), store_id (${storeIdExistente}), ou maquininha_serial (${serialExistente}).`
            });
        }

        const maquinaAtualizada = await prismaClient.pix_Maquina.update({
            where: { id },
            data: {
                nome,
                descricao,
                store_id,
                valorDoPulso,
                estoque
            },
        });

        return res.status(200).json(maquinaAtualizada);
    } catch (error: any) {
        console.error('Erro ao atualizar a máquina:', error);
        return res.status(500).json({
            error: "Erro interno do servidor ao tentar atualizar a máquina.",
            details: error.message
        });
    }
});

machineRoutes.delete("/maquina", verifyJWTPessoa, async (req: any, res) => {
    try {

        if (!req.body.id) {
            return res.status(500).json({ error: `>>:informe o id da máquina que deseja deletar` });
        }

        const deletedPagamento = await prismaClient.pix_Pagamento.deleteMany({
            where: {
                maquinaId: req.body.id,
            },
        });

        const deletedMaquina = await prismaClient.pix_Maquina.delete({
            where: {
                id: req.body.id,
            },
        });

        if (deletedMaquina) {
            console.log('Máquina removida com sucesso:', deletedMaquina.nome);
            return res.status(200).json(`Máquina: ${deletedMaquina.nome} removida.`);
        } else {
            return res.status(200).json(`Máquina não encontrada.`);
        }

    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ error: `>>:${err.message}` });
    }
});

machineRoutes.delete("/maquina-cliente", verifyJWT, async (req: any, res) => {
    try {

        if (!req.body.id) {
            return res.status(500).json({ error: `>>:informe o id da máquina que deseja deletar` });
        }

        const deletedPagamento = await prismaClient.pix_Pagamento.deleteMany({
            where: {
                maquinaId: req.body.id,
            },
        });

        const deletedMaquina = await prismaClient.pix_Maquina.delete({
            where: {
                id: req.body.id,
            },
        });

        if (deletedMaquina) {
            console.log('Máquina removida com sucesso:', deletedMaquina.nome);
            return res.status(200).json(`Máquina: ${deletedMaquina.nome} removida.`);
        } else {
            return res.status(200).json(`Máquina não encontrada.`);
        }

    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ error: `>>:${err.message}` });
    }
});

machineRoutes.get("/maquinas", verifyJWT, async (req: any, res) => {
    try {
        const [maquinas] = await prismaClient.$transaction([
            prismaClient.pix_Maquina.findMany({
                where: {
                    clienteId: req.userId,
                },
                orderBy: {
                    dataInclusao: 'desc',
                },
            }),
        ]);

        if (maquinas === null || !maquinas.length) {
            return res.status(200).json([]);
        }

        const maquinasComStatus = await Promise.all(maquinas.map(async (maquina) => {
            const {
                id,
                pessoaId,
                clienteId,
                nome,
                descricao,
                estoque,
                store_id,
                maquininha_serial,
                valorDoPix,
                dataInclusao,
                ultimoPagamentoRecebido,
                ultimaRequisicao,
                valorDoPulso,
                disabled
            } = maquina;

            let status = "OFFLINE";

            if (ultimaRequisicao) {
                const tempoDesdeUltimaRequisicao = tempoOffline(new Date(ultimaRequisicao));
                const tempoDesdeUltimoPagamento = ultimoPagamentoRecebido
                    ? tempoOffline(new Date(ultimoPagamentoRecebido))
                    : Infinity;

                status = tempoDesdeUltimaRequisicao > 15 ? "OFFLINE" : "ONLINE";

                if (status === "ONLINE" && tempoDesdeUltimoPagamento < 15) {
                    status = "PAGAMENTO_RECENTE";
                }
            }

            const pagamentosDaMaquina = await prismaClient.pix_Pagamento.findMany({
                where: {
                    maquinaId: id,
                    removido: false
                },
                orderBy: {
                    data: 'desc'
                }
            });

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
                id,
                pessoaId,
                clienteId,
                nome,
                descricao,
                estoque,
                store_id,
                maquininha_serial,
                valorDoPix,
                dataInclusao,
                ultimoPagamentoRecebido,
                ultimaRequisicao,
                status,
                pulso: valorDoPulso,
                totalSemEstorno,
                totalEspecie,
                totalComEstorno,
                disabled
            };
        }));

        return res.status(200).json(maquinasComStatus);
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ "retorno": "ERRO" });
    }
});

machineRoutes.get("/maquinas-adm", verifyJWTPessoa, async (req: any, res) => {
    try {

        const maquinas = await prismaClient.pix_Maquina.findMany({
            where: {
                clienteId: req.query.id,
            },
            orderBy: {
                dataInclusao: 'desc', // 'asc' para ordenação ascendente, 'desc' para ordenação descendente.
            },
        });

        if (maquinas != null) {

            const maquinasComStatus = [];

            for (const maquina of maquinas) {
                // 60 segundos sem acesso máquina já fica offline
                if (maquina.ultimaRequisicao) {
                    let status = (tempoOffline(new Date(maquina.ultimaRequisicao))) > 15 ? "OFFLINE" : "ONLINE";


                    if (status == "ONLINE" && maquina.ultimoPagamentoRecebido && tempoOffline(new Date(maquina.ultimoPagamentoRecebido)) < 15) {
                        status = "PAGAMENTO_RECENTE";
                    }

                    maquinasComStatus.push({
                        id: maquina.id,
                        pessoaId: maquina.pessoaId,
                        clienteId: maquina.clienteId,
                        nome: maquina.nome,
                        descricao: maquina.descricao,
                        estoque: maquina.estoque,
                        store_id: maquina.store_id,
                        maquininha_serial: maquina.maquininha_serial,
                        valorDoPix: maquina.valorDoPix,
                        dataInclusao: maquina.dataInclusao,
                        ultimoPagamentoRecebido: maquina.ultimoPagamentoRecebido,
                        ultimaRequisicao: maquina.ultimaRequisicao,
                        status: status,
                        pulso: maquina.valorDoPulso
                    });
                } else {
                    maquinasComStatus.push({
                        id: maquina.id,
                        pessoaId: maquina.pessoaId,
                        clienteId: maquina.clienteId,
                        nome: maquina.nome,
                        descricao: maquina.descricao,
                        estoque: maquina.estoque,
                        store_id: maquina.store_id,
                        maquininha_serial: maquina.maquininha_serial,
                        valorDoPix: maquina.valorDoPix,
                        dataInclusao: maquina.dataInclusao,
                        ultimoPagamentoRecebido: maquina.ultimoPagamentoRecebido,
                        ultimaRequisicao: maquina.ultimaRequisicao,
                        status: "OFFLINE",
                        pulso: maquina.valorDoPulso
                    });
                }
            }

            return res.status(200).json(maquinasComStatus);

        } else {
            console.log("não encontrou");
            return res.status(200).json("[]");
        }

    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ "retorno": "ERRO" });
    }
});

machineRoutes.post('/inserir-maquininha', verifyJWTPessoa, async (req, res) => {
    try {
        // Pegando os dados do corpo da requisição
        const {
            codigo,
            operacao,
            urlServidor,
            webhook01,
            webhook02,
            rotaConsultaStatusMaq,
            rotaConsultaAdimplencia,
            idMaquina,
            idCliente,
            valor1,
            valor2,
            valor3,
            valor4,
            textoEmpresa,
            corPrincipal,
            corSecundaria,
            minValue,
            maxValue,
            identificadorMaquininha,
            serialMaquininha,
            macaddressMaquininha,
            operadora
        } = req.body;

        // Inserindo no banco de dados via Prisma
        const novaMaquina = await prismaClient.configuracaoMaquina.create({
            data: {
                codigo,
                operacao,
                urlServidor,
                webhook01,
                webhook02,
                rotaConsultaStatusMaq,
                rotaConsultaAdimplencia,
                idMaquina,
                idCliente,
                valor1,
                valor2,
                valor3,
                valor4,
                textoEmpresa,
                corPrincipal,
                corSecundaria,
                minValue,
                maxValue,
                identificadorMaquininha,
                serialMaquininha,
                macaddressMaquininha,
                operadora
            },
        });

        res.json({ mensagem: 'Maquina inserida com sucesso', novaMaquina });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao inserir a máquina' });
    }
});

machineRoutes.get('/buscar-maquininha/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;

        // Busca a máquina pelo código
        const maquina = await prismaClient.configuracaoMaquina.findUnique({
            where: {
                codigo: codigo,
            },
        });

        if (!maquina) {
            return res.status(404).json({ mensagem: 'Maquina não encontrada' });
        }

        res.json({ maquina });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar a máquina' });
    }
});

machineRoutes.put('/alterar-maquininha/:codigo', verifyJWTPessoa, async (req, res) => {
    try {
        const { codigo } = req.params;  // Pega o código da URL
        const {
            operacao,
            urlServidor,
            webhook01,
            webhook02,
            rotaConsultaStatusMaq,
            rotaConsultaAdimplencia,
            idMaquina,
            idCliente,
            valor1,
            valor2,
            valor3,
            valor4,
            textoEmpresa,
            corPrincipal,
            corSecundaria,
            minValue,
            maxValue,
            identificadorMaquininha,
            serialMaquininha,
            macaddressMaquininha,
            operadora
        } = req.body;  // Pega os dados do corpo da requisição

        // Verifica se a máquina existe
        const maquinaExistente = await prismaClient.configuracaoMaquina.findUnique({
            where: { codigo },
        });

        if (!maquinaExistente) {
            return res.status(404).json({ mensagem: 'Maquina não encontrada' });
        }

        // Atualiza a máquina com os novos dados
        const maquinaAtualizada = await prismaClient.configuracaoMaquina.update({
            where: { codigo },
            data: {
                operacao,
                urlServidor,
                webhook01,
                webhook02,
                rotaConsultaStatusMaq,
                rotaConsultaAdimplencia,
                idMaquina,
                idCliente,
                valor1,
                valor2,
                valor3,
                valor4,
                textoEmpresa,
                corPrincipal,
                corSecundaria,
                minValue,
                maxValue,
                identificadorMaquininha,
                serialMaquininha,
                macaddressMaquininha,
                operadora
            },
        });

        res.json({ mensagem: 'Maquina atualizada com sucesso', maquinaAtualizada });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar a máquina' });
    }
});

machineRoutes.delete('/deletar-maquininha/:codigo', verifyJWTPessoa, async (req, res) => {
    try {
        const { codigo } = req.params;  // Pega o código da URL

        // Verifica se a máquina existe
        const maquinaExistente = await prismaClient.configuracaoMaquina.findUnique({
            where: { codigo },
        });

        if (!maquinaExistente) {
            return res.status(404).json({ mensagem: 'Maquina não encontrada' });
        }

        // Exclui a máquina
        await prismaClient.configuracaoMaquina.delete({
            where: { codigo },
        });

        res.json({ mensagem: 'Maquina excluída com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao excluir a máquina' });
    }
});

machineRoutes.get('/is-online/:idMaquina', async (req, res) => {
    try {
        const { idMaquina } = req.params;

        // Busca a máquina no banco de dados pelo id
        const maquina = await prismaClient.pix_Maquina.findUnique({
            where: {
                id: idMaquina,
            },
            include: {
                cliente: true,
            },
        });

        // Verificando se a máquina foi encontrada
        if (!maquina) {
            return res.status(404).json({ msg: 'Máquina não encontrada!' });
        }

        // Verifica o status da máquina com base na última requisição
        if (maquina.ultimaRequisicao) {
            const status = tempoOffline(new Date(maquina.ultimaRequisicao)) > 15 ? "OFFLINE" : "ONLINE";
            console.log(`Status da máquina: ${status}`);
            return res.status(200).json({ idMaquina, status });
        } else {
            console.log("Máquina sem registro de última requisição");
            return res.status(400).json({ msg: "MÁQUINA OFFLINE! Sem registro de última requisição." });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro ao verificar o status da máquina.' });
    }
});

machineRoutes.post('/mp-qrcode-generator/:id/:maquina', async (req, res) => {
    try {
        // Verifica se o valor foi passado no querystring
        const valor = req.query.valor;

        // Garantir que o valor seja uma string
        if (typeof valor !== 'string') {
            return res.status(400).json({ status: "Valor não informado ou inválido!" });
        }

        // Buscar token do cliente no banco de dados usando Prisma
        const cliente = await prismaClient.pix_Cliente.findUnique({
            where: {
                id: req.params.id,
            }
        });

        // Verifica se o cliente foi encontrado
        if (!cliente) {
            return res.status(404).json({ status: "Cliente não encontrado!" });
        }

        const tokenCliente = cliente.mercadoPagoToken ? cliente.mercadoPagoToken : "";

        if (!tokenCliente) {
            return res.status(403).json({ status: "Cliente sem token!" });
        }

        console.log("Token recuperado");

        // Configurar a requisição para criar a intenção de pagamento via PIX no Mercado Pago
        const mercadoPagoUrl = "https://api.mercadopago.com/v1/payments";
        const headers = {
            'Authorization': `Bearer ${tokenCliente}`,
            'Content-Type': 'application/json'
        };

        // Adicionando um identificador externo ao pagamento
        const externalReference = req.params.maquina;

        // Configurando os dados da intenção de pagamento, incluindo o identificador
        const pagamentoPix = {
            transaction_amount: parseFloat(valor),  // Usando o valor do query string
            description: "Pagamento via PIX",
            payment_method_id: "pix",  // Indicando que é um pagamento via PIX
            payer: { email: "email@gmail.com" },  // Informações do pagador (pode ser anônimo)
            external_reference: externalReference  // Identificador único para rastrear o pagamento
        };

        // Fazendo a requisição para criar a intenção de pagamento
        const response = await axios.post(mercadoPagoUrl, pagamentoPix, { headers });

        // Retornando os dados da intenção de pagamento, incluindo o QR code
        const paymentData = response.data;
        const qrCode = paymentData.point_of_interaction.transaction_data.qr_code;
        const qrCodeBase64 = paymentData.point_of_interaction.transaction_data.qr_code_base64;

        // Enviar os dados da transação para o cliente
        return res.status(200).json({
            status: "Pagamento PIX criado com sucesso",
            payment_data: paymentData,
            qr_code: qrCode,
            qr_code_base64: qrCodeBase64,
            external_reference: externalReference  // Retornando o identificador
        });

    } catch (error: any) {
        console.error("Erro ao processar a requisição: ", error);
        return res.status(500).json({ status: "Erro interno de servidor", error: error.message });
    }
});

machineRoutes.post('/disabled-machine-by-customer/:id', verifyJWTPessoa, async (req, res) => {
    try {
        const id = req.params.id;
        let disabled: boolean = false;

        const client = await prismaClient.pix_Cliente.findUnique({
            where: {
                id
            }
        });

        const records = await prismaClient.pix_Maquina.findMany({
            where: {
                clienteId: id
            }
        });

        const updates = records.map(record =>
            {
                disabled = !record.disabled;
                return prismaClient.pix_Maquina.update({
                    where: { id: record.id },
                    data: { disabled: !record.disabled }
                });
            }
        );

        await Promise.all(updates);

        if (disabled) {
            await sendDisabledEmail(client!.email, client!.nome);
        } else {
            await sendEnableEmail(client!.email, client!.nome)
        }

        return res.status(200).json({message: `Todas as máquinas foram ${disabled ? 'desabilitadas' : 'habilitadas'}`});
    } catch (e:any) {
        console.log(`Ocorreu um erro ao desabilitar as máquinas do cliente. ${e.message}`)
    }
});

machineRoutes.post('/delete-selected-payments', async (req, resp) => {
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);

    endDate.setUTCHours(23, 59, 0, 0);

    const deletedRecords = await prismaClient.pix_Pagamento.deleteMany({
        where: {
            maquinaId: req.body.machineId,
            data: {
                gte: startDate,
                lte: endDate,
            },
        },
    });

    return resp.status(200).json({
        message: `${deletedRecords.count} registros foram apagados.`,
    });
});
export { machineRoutes };