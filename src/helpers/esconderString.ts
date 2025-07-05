export const esconderString = (string: string) => {
    const tamanho = string.length;
    let resultado = '';

    for (let i = 0; i < tamanho - 3; i++) {
        resultado += '*';
    }

    resultado += string.substring(tamanho - 3, tamanho);
    return resultado;
}