import axios from 'axios';

import { gerarChaveIdempotente } from './gerarChaveIdempotente';

let numTentativasEstorno = 1;

export const estornarMP = async (id: string, token: string, motivoEstorno: string, maquinaId: string = '', tamanhoChave = 32) => {
    const url = `https://api.mercadopago.com/v1/payments/${id}/refunds`;

    try {
        console.log('********* estornando *****************');
        console.log(`********* Tentativa nª ${numTentativasEstorno} *****************`);
        if (maquinaId) {
            console.log('TENTATIVA DE ESTORNO NA MÁQUINA ' + maquinaId);
        }

        let idempotencyKey = gerarChaveIdempotente();
        const response = await axios.post(url, {}, {
            headers: {
                'X-Idempotency-Key': idempotencyKey,
                'Authorization': `Bearer ${token}`
            }
        });
        console.log("Estorno da operação: " + id + " efetuado com sucesso!")

        return response.data;
    } catch (error) {
        numTentativasEstorno++;
        if (numTentativasEstorno < 20) {
            await estornarMP(id, token, motivoEstorno, maquinaId, tamanhoChave);
        } else {
            console.log("Após 20 tentativas não conseguimos efetuar o estorno, VERIFIQUE O TOKEN DO CLIENTE!!", error);
        }
    }
}