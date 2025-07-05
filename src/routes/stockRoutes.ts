import { Router } from 'express'

const stockRoutes = Router();

import { prismaClient } from '../prismaClient/prismaClient';

stockRoutes.post("/decrementar-estoque/:id/", async (req: any, res: any) => {
    try {
        const value = req.query.valor;

        const maquina = await prismaClient.pix_Maquina.findUnique({
            where: {
                id: req.params.id,
            },
        });

        if (!maquina) {
            return res.status(404).json({ "retorno": "error.. máquina nulo ou não encontrado!" });
        }

        let novoEstoque: number | null = maquina.estoque !== null ? maquina.estoque - Number(value) : -1;

        await prismaClient.pix_Maquina.update({
            where: {
                id: req.params.id,
            },
            data: {
                estoque: novoEstoque,
            },
        });

        console.log("Estoque atualizado");
        return res.status(200).json({ "Estoque atual": `${novoEstoque}` });
    } catch (error) {
        console.error("Error updating stock:", error);
        return res.status(404).json({ "retorno": "Erro ao tentar atualizar estoque" });
    }
});

stockRoutes.post('/setar-estoque/:id', async (req, res) => {
    try {
        const maquinaId = req.params.id;
        const estoque = req.query.valor;

        let val = Number(estoque);

        // Find the Pix_Maquina by id
        const maquina = await prismaClient.pix_Maquina.findUnique({
            where: {
                id: maquinaId,
            },
        });

        if (!maquina) {
            return res.status(404).json({ error: 'Maquina não encontrada!' });
        }

        // Perform the update
        await prismaClient.pix_Maquina.update({
            where: {
                id: maquinaId,
            },
            data: {
                estoque: val,
            },
        });

        return res.status(200).json({ "novo estoque:": `${val}` });
    } catch (error) {
        console.error('Error updating stock:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

export { stockRoutes };
