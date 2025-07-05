import { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient;

if (process.env.NODE_ENV === 'production') {
    // @ts-ignore
    globalThis.prisma = globalThis.prisma || new PrismaClient({
        log: ['error'],
    });
    // @ts-ignore
    prismaClient = globalThis.prisma;
} else {
    console.log("CRIANDO LOCAL");
    prismaClient = new PrismaClient();
}

export { prismaClient };
