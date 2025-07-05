export const criarSenha = () => {
    const caracteres = '0123456789abcdefghijklmnopqrstuvwxyz';
    let textoAleatorio = '';

    for (let i = 0; i < 8; i++) {
        const indiceAleatorio = Math.floor(Math.random() * caracteres.length);
        textoAleatorio += caracteres.charAt(indiceAleatorio);
    }

    return textoAleatorio;
}