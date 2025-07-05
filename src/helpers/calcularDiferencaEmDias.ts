export const calcularDiferencaEmDias = (dataVencimento: Date): number => {
    const hoje = new Date();
    const diferencaEmMilissegundos = hoje.getTime() - new Date(dataVencimento).getTime();
    const diferencaEmDias = diferencaEmMilissegundos / (1000 * 60 * 60 * 24);
    return Math.floor(diferencaEmDias);
}