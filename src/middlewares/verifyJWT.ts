import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const verifyJWT = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const SECRET = process.env.JWT_SECRET!;
    const token = req.headers['x-access-token'];

    jwt.verify(token as string, SECRET, (err: any, decoded: any) => {
        if (err) return res.status(401).end();
        req.userId = decoded.userId;
        next();
    });
};