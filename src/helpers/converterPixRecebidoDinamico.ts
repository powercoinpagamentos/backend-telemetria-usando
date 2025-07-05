export const converterPixRecebidoDinamico = (valorPix: number, pulso: number) => {
    let valorAux = 0;
    const ticket = pulso;
    if (valorPix > 0 && valorPix >= ticket) {
        valorAux = valorPix;
        let credits = valorAux / ticket;
        credits = Math.floor(credits);

        return ("0000" + credits).slice(-4);
    }

    return "0000";
}