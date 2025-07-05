import { Router } from 'express';
import { verifyJWT } from '../middlewares/verifyJWT';
import { verifyJWTPessoa } from '../middlewares/verifyJWTPessoa';
import { prismaClient } from '../prismaClient/prismaClient';
import transformPaymentsData, {paymentByPeriod, formatToBRL, retrieveDate} from "../helpers/relatorio";

const reportRoutes = Router();

reportRoutes.post("/relatorio-01-cash", verifyJWT, async (req, res) => {
    try {
        const { maquinaId, dataInicio, dataFim } = req.body;

        if (!maquinaId) {
            return res.status(400).json({ error: "Necessário informar maquinaId" });
        }

        if (!dataInicio || !dataFim) {
            return res.status(400).json({ error: "Datas de início e fim são obrigatórias" });
        }

        const dataInicioDate = new Date(dataInicio);
        const dataFimDate = new Date(dataFim);

        const pagamentos = await prismaClient.pix_Pagamento.findMany({
            where: {
                estornado: false,
                removido: false,
                mercadoPagoId: "CASH",
                maquinaId,
                data: {
                    gte: dataInicioDate,
                    lte: dataFimDate,
                },
            },
            select: {
                valor: true,
            },
        });

        const somatorio = pagamentos.reduce(
            (total, pagamento) => total + (parseFloat(pagamento.valor) || 0),
            0
        );

        return res.status(200).json({ valor: somatorio });
    } catch (error: any) {
        console.error("Erro ao gerar relatório CASH:", error);
        return res.status(500).json({ error: `Erro interno do servidor: ${error.message}` });
    }
});

reportRoutes.post("/relatorio-01-cash-adm", verifyJWTPessoa, async (req, res) => {
    try {

        console.log(`************** cash`);
        console.log(req.body);

        //return res.status(200).json({valor : "2"});
        const pagamentos = await prismaClient.pix_Pagamento.findMany({
            where: {
                estornado: false,
                mercadoPagoId: "CASH",
                maquinaId: req.body.maquinaId,
                data: {
                    gte: new Date(req.body.dataInicio),
                    lte: new Date(req.body.dataFim),
                }
            }
        });

        // Calculando o somatório dos valores dos pagamentos
        const somatorio = pagamentos.reduce((acc, pagamento) => acc + parseInt(pagamento.valor), 0);

        return res.status(200).json({ valor: somatorio });


    } catch (e) {
        res.json({ error: "error" + e });
    }
});

reportRoutes.post("/relatorio-02-taxas", verifyJWT, async (req, res) => {
    try {
        const { maquinaId, dataInicio, dataFim } = req.body;

        if (!maquinaId) {
            return res.status(400).json({ error: "Necessário informar maquinaId" });
        }

        if (!dataInicio || !dataFim) {
            return res.status(400).json({ error: "Datas de início e fim são obrigatórias" });
        }

        const dataInicioDate = new Date(dataInicio);
        const dataFimDate = new Date(dataFim);

        const calcularTotalTaxas = async (tipo: string) => {
            const pagamentos = await prismaClient.pix_Pagamento.findMany({
                where: {
                    maquinaId,
                    tipo,
                    estornado: false,
                    data: {
                        gte: dataInicioDate,
                        lte: dataFimDate,
                    },
                },
                select: {
                    taxas: true,
                },
            });

            return pagamentos.reduce(
                (total, pagamento) => total + parseFloat(pagamento.taxas || "0"),
                0
            );
        };

        const [totalTaxasPix, totalTaxasCredito, totalTaxasDebito, totalTaxaPIXQRCODE] = await Promise.all([
            calcularTotalTaxas("bank_transfer"),
            calcularTotalTaxas("credit_card"),
            calcularTotalTaxas("debit_card"),
            calcularTotalTaxas("account_money")
        ]);

        return res.status(200).json({
            pix: totalTaxasPix + (totalTaxaPIXQRCODE || 0),
            credito: totalTaxasCredito,
            debito: totalTaxasDebito,
        });
    } catch (error: any) {
        console.error("Erro ao gerar relatório de taxas:", error);
        return res.status(500).json({ error: `Erro interno do servidor: ${error.message}` });
    }
});

reportRoutes.post("/relatorio-02-taxas-adm", verifyJWTPessoa, async (req, res) => {
    try {

        console.log(`************** taxas`);
        console.log(req.body);

        if (req.body.maquinaId == null) {
            return res.status(500).json({ error: `necessário informar maquinaId` });
        }

        try {

            const pagamentos_pix = await prismaClient.pix_Pagamento.findMany({
                where: {
                    maquinaId: req.body.maquinaId,
                    tipo: { in: ["bank_transfer", "account_money"] },
                    estornado: false
                }
            });


            let totalTaxasPix = 0;
            for (const pagamento of pagamentos_pix) {
                const taxa = pagamento.taxas !== null ? pagamento.taxas : "0";
                totalTaxasPix += parseFloat(taxa) || 0;
            }



            const pagamentos = await prismaClient.pix_Pagamento.findMany({
                where: {
                    maquinaId: req.body.maquinaId,
                    tipo: "credit_card",
                    estornado: false
                }
            });


            let totalTaxasCredito = 0;
            for (const pagamento of pagamentos) {
                const taxa = pagamento.taxas !== null ? pagamento.taxas : "0";
                totalTaxasCredito += parseFloat(taxa) || 0;
            }

            const pagamentos_debito = await prismaClient.pix_Pagamento.findMany({
                where: {
                    maquinaId: req.body.maquinaId,
                    tipo: "debit_card",
                    estornado: false
                }
            });


            let totalTaxasDebito = 0;
            for (const pagamento of pagamentos_debito) {
                const taxa = pagamento.taxas !== null ? pagamento.taxas : "0";
                totalTaxasDebito += parseFloat(taxa) || 0;
            }


            return res.status(200).json({ pix: totalTaxasPix, credito: totalTaxasCredito, debito: totalTaxasDebito });


        } catch (e) {
            res.json({ error: "error" + e });
        }

    } catch (e) {
        res.json({ "error": "error" + e });
    }
});

reportRoutes.post("/relatorio-03-pagamentos", verifyJWT, async (req, res) => {
    try {
        const { maquinaId, dataInicio, dataFim } = req.body;

        if (!maquinaId) {
            return res.status(400).json({ error: "Necessário informar maquinaId" });
        }

        if (!dataInicio || !dataFim) {
            return res.status(400).json({ error: "Datas de início e fim são obrigatórias" });
        }

        const dataInicioDate = new Date(dataInicio);
        const dataFimDate = new Date(dataFim);

        const tiposPagamento = ["bank_transfer", "credit_card", "debit_card", "account_money"];

        const calcularTotalPorTipo = async (tipo: string) => {
            const pagamentos = await prismaClient.pix_Pagamento.findMany({
                where: {
                    maquinaId,
                    tipo,
                    estornado: false,
                    data: {
                        gte: dataInicioDate,
                        lte: dataFimDate,
                    },
                },
            });

            return pagamentos.reduce(
                (total, pagamento) => total + parseFloat(pagamento.valor || "0"),
                0
            );
        };

        const [pagamentosPix, pagamentosCredito, pagamentosDebito, PIXQrCODE] = await Promise.all(
            tiposPagamento.map((tipo) => calcularTotalPorTipo(tipo))
        );

        return res.status(200).json({
            pix: pagamentosPix + (PIXQrCODE || 0),
            especie: -1,
            credito: pagamentosCredito,
            debito: pagamentosDebito,
        });
    } catch (error: any) {
        console.error("Erro ao gerar relatório:", error);
        return res.status(500).json({ error: `Erro interno do servidor: ${error.message}` });
    }
});

reportRoutes.post("/relatorio-03-pagamentos-adm", verifyJWTPessoa, async (req, res) => {
    try {

        console.log(`************** pagamentos`);
        console.log(req.body);

        if (req.body.maquinaId == null) {
            return res.status(500).json({ error: `necessário informar maquinaId` });
        }

        const pagamentos_pix = await prismaClient.pix_Pagamento.findMany({
            where: {
                maquinaId: req.body.maquinaId,
                tipo: { in: ["bank_transfer", "account_money"] },
                estornado: false,
                data: {
                    gte: new Date(req.body.dataInicio),
                    lte: new Date(req.body.dataFim),
                }
            }
        });


        let pagamentosPix = 0;
        for (const pagamento of pagamentos_pix) {
            const valor = pagamento.valor !== null ? pagamento.valor : "0";
            pagamentosPix += parseFloat(valor) || 0;
        }

        const pagamentos_credito = await prismaClient.pix_Pagamento.findMany({
            where: {
                maquinaId: req.body.maquinaId,
                tipo: "credit_card",
                estornado: false,
                data: {
                    gte: new Date(req.body.dataInicio),
                    lte: new Date(req.body.dataFim),
                }
            }
        });


        let pagamentosCredito = 0;
        for (const pagamento of pagamentos_credito) {
            const valorCredito = pagamento.valor !== null ? pagamento.valor : "0";
            pagamentosCredito += parseFloat(valorCredito) || 0;
        }

        const pagamentos_debito = await prismaClient.pix_Pagamento.findMany({
            where: {
                maquinaId: req.body.maquinaId,
                tipo: "debit_card",
                estornado: false,
                data: {
                    gte: new Date(req.body.dataInicio),
                    lte: new Date(req.body.dataFim),
                }
            }
        });


        let pagamentosDebito = 0;
        for (const pagamento of pagamentos_debito) {
            const valorDebito = pagamento.valor !== null ? pagamento.valor : "0";
            pagamentosDebito += parseFloat(valorDebito) || 0;
        }

        return res.status(200).json({ pix: pagamentosPix, especie: -1, credito: pagamentosCredito, debito: pagamentosDebito });


    } catch (e) {
        res.json({ "error": "error" + e });
    }
});

reportRoutes.post("/relatorio-04-estornos", verifyJWT, async (req, res) => {
    try {
        const { maquinaId, dataInicio, dataFim } = req.body;

        if (!maquinaId) {
            return res.status(400).json({ error: "Necessário informar maquinaId" });
        }

        if (!dataInicio || !dataFim) {
            return res.status(400).json({ error: "Datas de início e fim são obrigatórias" });
        }

        const dataInicioDate = new Date(dataInicio);
        const dataFimDate = new Date(dataFim);

        const pagamentos = await prismaClient.pix_Pagamento.findMany({
            where: {
                maquinaId,
                estornado: true,
                data: {
                    gte: dataInicioDate,
                    lte: dataFimDate,
                },
            },
            select: {
                valor: true,
            },
        });

        const somatorioValores = pagamentos.reduce(
            (acc, pagamento) => acc + parseFloat(pagamento.valor || "0"),
            0
        );

        return res.status(200).json({ valor: somatorioValores });
    } catch (error: any) {
        console.error("Erro ao gerar relatório de estornos:", error);
        return res.status(500).json({ error: `Erro interno do servidor: ${error.message}` });
    }
});

reportRoutes.post("/relatorio-04-estornos-adm", verifyJWTPessoa, async (req, res) => {
    try {

        console.log(`************** estornos`);
        console.log(req.body);

        if (req.body.maquinaId == null) {
            return res.status(500).json({ error: `necessário informar maquinaId` });
        }

        const pagamentos = await prismaClient.pix_Pagamento.findMany({
            where: {
                maquinaId: req.body.maquinaId,
                estornado: true,
                data: {
                    gte: new Date(req.body.dataInicio),
                    lte: new Date(req.body.dataFim),
                },
            },
            select: {
                valor: true,
            },
        });

        // Calculando o somatório dos valores dos pagamentos
        const somatorioValores = pagamentos.reduce((acc, curr) => {
            return acc + parseFloat(curr.valor);
        }, 0);

        return res.status(200).json({ valor: somatorioValores });


    } catch (e) {
        res.json({ "error": "error" + e });
    }
});

reportRoutes.post('/relatorio-pagamento-pdf', async (req, res) => {
    const PDFDocument = require('pdfkit-table');

    let doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'portrait' });

    const maquina = await prismaClient.pix_Maquina.findUnique({
        where: {
            id: req.body.machineId,
        },
        include: {
            cliente: true,
        }
    });

    const {
        totalSemEstorno,
        totalComEstorno,
        totalEspecie,
        pagamentos
    } = await paymentByPeriod(req.body.startDate, req.body.endDate, req.body.machineId);

    doc.rect(0, 0, doc.page.width, 60).fill('#0853b2');

    doc.fillColor('white').fontSize(20).text('Relatório de pagamento', 20, 20, { align: 'left' });
    doc.fillColor('white').fontSize(20).text('PIXcoin', 20, 20, { align: 'right' });

    doc.fillColor('black').fontSize(14);
    doc.moveDown(2);
    doc.fontSize(15).text(`Máquina: ${maquina!.nome || 'Não informado'}`);
    doc.fontSize(15).text(`Responsável: ${maquina!.cliente!.nome}`);
    doc.fontSize(15).text(`Data: ${retrieveDate(req.body.startDate)} - ${retrieveDate(req.body.endDate)}`);

    doc.moveDown(2);
    doc.fontSize(15).text(`Soma total entre Pix, Débito e Crédito: R$ ${(totalSemEstorno - totalEspecie).toFixed(2)}`, { align: 'left' });
    doc.fontSize(15).text(`Soma total de espécie: R$ ${totalEspecie.toFixed(2)}`, { align: 'left' });
    doc.fontSize(15).text(`Soma total entre espécie, Pix, Débito e Crédito: R$ ${(totalSemEstorno).toFixed(2)}`, { align: 'left' });
    doc.fontSize(15).text(`Soma total de estornos em Pix, Débito e Crédito: R$ ${(totalComEstorno).toFixed(2)}`, { align: 'left' });
    doc.moveDown();

    const adjustedPayment = transformPaymentsData(pagamentos);
    const filteredValuesArray = adjustedPayment.map(item =>
        Object.values(item).filter(value => value !== '')
    );

    const tableArray = {
        headers: ['Data', 'Pagamento', 'Valor', 'Ident.MP', 'Estornado'],
        rows: filteredValuesArray,
    };

    doc.table(tableArray, {
        width: doc.page.width - 40,
        columnsSize: [150, 150, 150, 150, 150],
        prepareHeader: () => doc.fontSize(12).fillColor('#0853b2'),
        prepareRow: () => doc.fontSize(11).fillColor('black'),
        headerBackground: '#0853b2',
        headerOpacity: 0.9,
        rowBackground: ['#0853b2', '#0853b2'],
    });

    doc.rect(0, doc.page.height - 30, doc.page.width, 30).fill('#0853b2');

    doc.pipe(res);
    doc.end();
});
export { reportRoutes };
