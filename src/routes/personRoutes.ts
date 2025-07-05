import { Router } from 'express'
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { NOTIFICACOES_LOGINS, SECRET_PESSOA } from '../helpers/staticConfig';
import { notificarDiscord } from '../helpers/notificarDiscord';

import { prismaClient } from '../prismaClient/prismaClient';

const personRoutes = Router();

personRoutes.post("/login-pessoa", async (req, res) => {
    try {
        const user = await prismaClient.pix_Pessoa.findUnique({
            where: {
                email: req.body.email
            },
        })

        if (!user) {
            return res.status(400).json({ error: 'Password or Email Invalid' });
        }

        // check user password with hashed password stored in the database
        const validPassword = await bcrypt.compare(req.body.senha, user.senha);

        if (!validPassword) {
            return res.status(400).json({ error: 'Password or Email Invalid' });
        }

        await prismaClient.pix_Pessoa.update({
            where: {
                email: req.body.email
            },
            data: { ultimoAcesso: new Date(Date.now()) }
        })

        //explicação top sobre jwt https://www.youtube.com/watch?v=D0gpL8-DVrc
        const token = jwt.sign({ userId: user.id }, SECRET_PESSOA, { expiresIn: 3600 }); //5min = 300 para 1h = 3600

        if (NOTIFICACOES_LOGINS) {
            await notificarDiscord(NOTIFICACOES_LOGINS, "Novo login efetuado", `ADM ${user.nome} acabou de fazer login.`)
        }


        return res.json({ email: user.email, id: user.id, type: "pessoa", key: "ADMIN", name: user.nome, lastLogin: user.ultimoAcesso, token });
    } catch (error) {

        const { message } = error as Error;

        return res.status(403).json({ error: message });
    }
});

personRoutes.post('/cliente/:id/add-warning', async (req, res) => {
    try {
        const { id } = req.params;
        const { message, showForAll } = req.body;

        if (showForAll !== 'null') {
            await prismaClient.pix_Cliente.updateMany({
                data: { aviso: message },
            });

            console.log('TODOS OS CLIENTES RECEBERAM A MENSAGEM: ', message ? message : 'LIMPEZA DE MSG');
            return res.json({ message: `Todos os clientes receberam a mensagem ${message ? message : 'LIMPEZA DE MSG'}` });
        }

        const cliente = await prismaClient.pix_Cliente.findUnique({
            where: { id },
        });

        if (!cliente) {
            return res.status(404).json({ status: null });
        }

        await prismaClient.pix_Cliente.update({
            where: { id },
            data: { aviso: message },
        });

        return res.json({ message: `Mensagem adicionada ao cliente ${cliente.nome}` });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: null });
    }
});

export { personRoutes };
