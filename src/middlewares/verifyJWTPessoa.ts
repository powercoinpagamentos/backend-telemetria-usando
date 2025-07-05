import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { SECRET_PESSOA } from '../helpers/staticConfig';

export const verifyJWTPessoa = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const token = req.headers['x-access-token'];
    jwt.verify(token as string, SECRET_PESSOA, (err: any, decoded: any) => {
        if (err) return res.status(401).json({
            error: `Invalid or Expired Token. Make sure you add a Header 
    Parameter named x-access-token with the token provided when an email to reset password has been sent.` });
        req.userId = decoded.userId;
        next();
    });
}