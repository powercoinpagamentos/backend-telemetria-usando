export const tempoOffline = (data2: Date): number => {
    const currentDate = new Date();
    return Math.abs((data2.getTime() - currentDate.getTime()) / 1000);
}