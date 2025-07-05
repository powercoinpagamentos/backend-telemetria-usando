import { toZonedTime } from 'date-fns-tz';

export const obterDataAtual = (date: Date = new Date(), timeZone: string = 'America/Sao_Paulo'): Date => {
    return toZonedTime(date, timeZone);
};