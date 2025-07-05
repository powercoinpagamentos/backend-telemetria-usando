import { Router } from 'express';
import bcrypt from 'bcrypt';

import { prismaClient } from '../prismaClient/prismaClient';

const configRoutes = Router();

configRoutes.post("/config", async (req, res) => {
    try {
        const p = await prismaClient.pix_Pessoa.findFirst();

        if (p) {
            return res.status(500).json({ error: `Já existe adm cadastrado!` });
        }

        const salt = await bcrypt.genSalt(10);
        req.body.senha = await bcrypt.hash(req.body.senha, salt);

        const pessoa = await prismaClient.pix_Pessoa.create({ data: req.body });

        pessoa.senha = "";

        return res.status(200).json({ msg: "Cadastro efetuado com sucesso! Acesse o painel ADM V4" });

    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ error: `>>:${err.message}` });
    }
});

export { configRoutes };
