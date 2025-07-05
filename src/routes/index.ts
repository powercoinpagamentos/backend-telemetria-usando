import { clientRoutes } from './clientRoutes';
import { machineRoutes } from './machineRoutes';
import { configRoutes } from './configRoutes';
import { creditRoutes } from './creditRoutes';
import { personRoutes } from './personRoutes';
import { receiptRoutes } from './receiptRoutes';
import { webHooksRoutes } from './webHooksRoutes';
import { stockRoutes } from './stockRoutes';
import { paymentRoutes } from './paymentRoutes';
import { signatureRoutes } from './signatureRoutes';
import { reportRoutes } from './reportRoutes';
import { consultMachineRouter } from './consultMachineRoute';

export default [
    clientRoutes,
    machineRoutes,
    configRoutes,
    creditRoutes,
    personRoutes,
    receiptRoutes,
    webHooksRoutes,
    stockRoutes,
    paymentRoutes,
    signatureRoutes,
    reportRoutes,
    consultMachineRouter
];