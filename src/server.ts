// import { limparFilaMercadoPagoCRON } from './crons/limparFilaMercadoPago';
// import { limparPagamentosMensalmenteCRON } from './crons/limparPagamentosMensalmente';

require('dotenv').config();

import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';

import routes from './routes';

const PORT: string | number = process.env.PORT || 5001;

const app = express();

// @TODO: TRAMOIA
// limparFilaMercadoPagoCRON();

// limparPagamentosMensalmenteCRON();

app.use(cors());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

routes.forEach(router => app.use(router));

app.listen(PORT, () => console.log(`Server running at port ${PORT} - complete URI: localhost:${PORT}`));