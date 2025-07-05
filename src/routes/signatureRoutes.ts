import { Router } from 'express'

const signatureRoutes = Router();

signatureRoutes.post("/assinatura", async (req: any, res) => {
    try {
        return res.status(200).json({ "status": "ok" });
    } catch (err: any) {
        return res.status(500).json({ "retorno": "ERRO", data: err });
    }
});

export { signatureRoutes };