import { prismaClient } from '../prismaClient/prismaClient';

export const paymentByPeriod = async (startDate: string, endDate: string, machineId: string) => {
    let totalEspecie = 0.0;
    const dataInicio = new Date(startDate);

    const dataFim = new Date(endDate);

    const pagamentos = await prismaClient.pix_Pagamento.findMany({
        where: {
            maquinaId: machineId,
            data: {
                gte: dataInicio,
                lte: dataFim,
            },
            removido: false,
        },
        orderBy: {
            data: 'desc',
        }
    });

    let totalSemEstorno = 0;
    let totalComEstorno = 0;

    for (const pagamento of pagamentos) {
        const valor = parseFloat(pagamento.valor);

        if (!pagamento.estornado) {
            totalSemEstorno += valor;
        } else {
            totalComEstorno += valor;
        }
    }

    const pagamentosEspecie = pagamentos.filter(pagamento => pagamento.mercadoPagoId === 'CASH');

    for (const e of pagamentosEspecie) {
        const valor = parseFloat(e.valor);
        totalEspecie += valor;
    }

    return {
        totalSemEstorno,
        totalComEstorno,
        totalEspecie,
        pagamentos
    }
}

export const retrieveFormattedDate = (
    isoDate: string,
    useUTC = false,
    format = "DD/MM/YYYY HH:mm:ss"
): string => {
    const date = new Date(isoDate);

    const pad = (num: number) => String(num).padStart(2, "0");

    const getDatePart = (method: string) =>
        useUTC ? (date as any)[`getUTC${method}`]() : (date as any)[`get${method}`]();

    const day = pad(getDatePart("Date"));
    const month = pad(getDatePart("Month") + 1);
    const year = getDatePart("FullYear");
    const hours = pad(getDatePart("Hours"));
    const minutes = pad(getDatePart("Minutes"));
    const seconds = pad(getDatePart("Seconds"));

    return format
        .replace("DD", day)
        .replace("MM", month)
        .replace("YYYY", String(year))
        .replace("HH", hours)
        .replace("mm", minutes)
        .replace("ss", seconds);
};

export const retrievePaymentForm = (currentPaymentForm: string): string => {
    const paymentFormMap: Record<string, string> = {
        bank_transfer: 'PIX',
        CASH: 'Especie',
        debit_card: 'Débito',
        credit_card: 'Crédito',
        account_money: '',
    };

    return paymentFormMap[currentPaymentForm] || '';
};

export const formatToBRL = (value: string): string => {
    const number = parseFloat(value);
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(number);
}

export const retrieveReversedText = (reversed: boolean): 'Recebido' | 'Estornado' => {
    if (reversed) {
        return 'Estornado';
    }

    return 'Recebido'
}

export default function transformPaymentsData(payments: any[]): any[] {
    return payments.map(payment => ({
        date: retrieveFormattedDate(payment.data),
        paymentForm: retrievePaymentForm(payment.tipo),
        value: formatToBRL(payment.valor),
        identifierMP: payment.mercadoPagoId,
        reversed: retrieveReversedText(payment.estornado),
    }));
}

export const retrieveDate = (isoDate: string): string => {
    const data = new Date(isoDate);

    const dia = String(data.getUTCDate()).padStart(2, '0');
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0'); // Janeiro é 0
    const ano = data.getUTCFullYear();

    return  `${dia}/${mes}/${ano}`;
}