import cron from 'node-cron';
import { prismaClient } from '../prismaClient/prismaClient';

export const limparPagamentosMensalmenteCRON = () => {
    // Cron job para rodar todo dia 4 às 00:00
    cron.schedule('0 0 4 * *', async () => {
        try {
            const firstDayOfPreviousMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
            firstDayOfPreviousMonth.setHours(0, 0, 0, 0);

            const result = await prismaClient.pix_Pagamento.deleteMany({
                where: {
                    data: {
                        lt: firstDayOfPreviousMonth,
                    },
                },
            });

            console.log(`${result.count} registros apagados anteriores ao mês vigente.`);
        } catch (error) {
            console.error('Erro ao executar a tarefa de limpeza:', error);
        }
    });

    console.log('Cron job configurado para rodar no dia 4 de cada mês.');
};