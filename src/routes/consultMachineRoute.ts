import { Request, Response, Router } from 'express';

import { converterPixRecebidoDinamico } from '../helpers/converterPixRecebidoDinamico';

import { prismaClient } from '../prismaClient/prismaClient';
import {obterDataAtual} from "../helpers/obterDataAtual";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const consultMachineRouter = Router();

consultMachineRouter.get("/consultar-maquina/:id", async (req: Request, res: Response) => {
    try {
        const maquina = await prismaClient.pix_Maquina.findFirst({
            where: {
                id: req.params.id,
                disabled: false
            },
            select: {
                valorDoPulso: true,
                valorDoPix: true,
                clienteId: true,
                id: true,
            }
        });

        if (!maquina) {
            return res.status(200).json({ retorno: "0000" });
        }

        let pulso = "0000";

        if (maquina.valorDoPix !== '0') {
            pulso = converterPixRecebidoDinamico(parseFloat(maquina.valorDoPix), parseFloat(maquina.valorDoPulso));
        }

        if (pulso !== "0000") {
            console.log(
                `Novo crédito de ${pulso} entrando para o clienteId ${maquina.clienteId} na máquina ${maquina.id}`
            );
        }

        await prismaClient.pix_Maquina.update({
            where: { id: req.params.id },
            data: {
                valorDoPix: "0",
                ultimaRequisicao: obterDataAtual()
            }
        });
        return res
            .status(200)
            .json({retorno:pulso});
    } catch (err: any) {
        console.error(`Ocorreu um erro ao creditar na máquina: ${err.message}`);
        return res.status(500).json({ retorno: "0000" });
    }
});

export { consultMachineRouter };