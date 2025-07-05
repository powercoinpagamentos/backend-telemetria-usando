import { estornarMP } from './estornarMP';
import { prismaClient } from '../prismaClient/prismaClient';
import { obterDataAtual } from './obterDataAtual';

export async function handleEstorno(
    motivo: string,
    maquinaId: string,
    valor: number,
    mercadoPagoId: string,
    clienteId: string,
    str_id: string,
    res: any,
    tokenCliente: string,
    tipoPagamento: string
) {
    const registroExistente = await prismaClient.pix_Pagamento.findFirst({
        where: {
            mercadoPagoId,
            estornado: true,
            clienteId,
        },
    });

    if (registroExistente) {
        console.log("Esse estorno já foi feito...");
        return res.status(200).json({ "retorno": `error.. ${motivo} - estorno duplicado!` });
    }

    // Realizar o estorno
    console.log(`Estornando: ${motivo}`);
    await estornarMP(mercadoPagoId, tokenCliente, motivo, maquinaId);

    await prismaClient.pix_Pagamento.create({
        data: {
            maquinaId,
            valor: valor.toString(),
            mercadoPagoId,
            motivoEstorno: motivo,
            estornado: true,
            tipo: tipoPagamento,
            data: obterDataAtual(),
        },
    });

    return res.status(200).json({ "retorno": `PAGAMENTO ESTORNADO - ${motivo}` });
}
