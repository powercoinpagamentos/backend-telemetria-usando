import cron from 'node-cron';
import { prismaClient } from '../prismaClient/prismaClient';

export const limparFilaMercadoPagoCRON = () => {
    // Cron job para executar a cada 3 minutos
    cron.schedule('*/3 * * * *', async () => {
        try {
            const result = await prismaClient.fila_Mercado_Pago.deleteMany({});
            console.log(`${result.count} registros deletados da fila do mercado pago.`);
        } catch (error) {
            console.error('Erro ao executar a tarefa de limpeza:', error);
        }
    });

    console.log('Cron job configurado para rodar a cada 3 minutos.');
};