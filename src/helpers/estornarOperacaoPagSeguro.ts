import axios from "axios";

export const estornarOperacaoPagSeguro = async (email: String, token: String, idOperacao: String) => {
    let estornarOperacaoPagSeguroCount = 0;
    const url = `https://ws.pagseguro.uol.com.br/v2/transactions/refunds`;

    try {
        const response = await axios.post('https://ws.pagseguro.uol.com.br/v2/transactions/refunds', null, {
            params: {
                email: email,
                token: token,
                transactionCode: idOperacao // Usando o transactionCode diretamente como parâmetro
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.status === 200) {
            console.log('Tentativa: ', estornarOperacaoPagSeguroCount);
            console.log('Estorno realizado com sucesso:', response.data);
            return response.data;
        } else {
            console.log('Tentativa: ', estornarOperacaoPagSeguroCount);
            console.error('Falha ao realizar o estorno:', response.data);

            estornarOperacaoPagSeguroCount++;
            if (estornarOperacaoPagSeguroCount <= 20) {
                await estornarOperacaoPagSeguro(email, token, idOperacao);
            }else {
                console.log("Após 20 tentativas não conseguimos efetuar o estorno!");
            }

            return response.data;
        }
    } catch (error: any) {
        console.error('Erro ao tentar estornar operação:', error.response ? error.response.data : error.message);
        estornarOperacaoPagSeguroCount++;
        if (estornarOperacaoPagSeguroCount <= 20) {
            await estornarOperacaoPagSeguro(email, token, idOperacao);
        }else {
            console.log("Após 20 tentativas não conseguimos efetuar o estorno!");
        }
    }
}
