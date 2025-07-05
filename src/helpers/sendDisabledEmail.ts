import nodemailer from 'nodemailer';

export async function sendDisabledEmail (email: string, clientName: string) {
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'noreplypixcoin@gmail.com',
            pass: 'nsvt vddg faku vtwo',
        }
    });

    await transporter.sendMail({
        from: 'PIXCOIN <noreplypixcoin@gmail.com>',
        to: email,
        subject: 'Comunicado de Inadimplência',
        html: `
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="text-align: center; color: #d9534f;">Comunicado de Inadimplência</h2>
        <p>Prezado(a) <strong>${clientName}</strong>,</p>
        <p>Esperamos que esteja bem.</p>
        <p>
            Gostaríamos de informá-lo(a) que, devido à pendência no pagamento de sua fatura, 
            as máquinas fornecidas pela <strong>PIXCOIN</strong> foram temporariamente desabilitadas, 
            conforme os termos estabelecidos em nosso contrato. Esta medida foi adotada com o intuito 
            de regularizar a situação de inadimplência e garantir a continuidade dos serviços.
        </p>
        <p>
            Reforçamos que, para a reativação imediata dos serviços, solicitamos o pagamento da quantia devida. 
            Caso o pagamento já tenha sido efetuado, por gentileza, desconsidere esta mensagem e nos encaminhe 
            o comprovante para análise.
        </p>
        <p>
            A <strong>PIXCOIN</strong> se coloca à disposição para quaisquer esclarecimentos ou para auxiliá-lo(a) 
            no processo de regularização da pendência. Nossa equipe de atendimento está disponível através telefone 
            <a href="tel:+5521979832030" style="color: #0275d8;">(21) 97983-2030</a>.
        </p>
        <p style="text-align: center; color: #888; font-size: 0.9em;">
            Agradecemos pela compreensão e esperamos resolver a situação o mais breve possível.
        </p>
        <p style="text-align: right; font-weight: bold;">
            Atenciosamente,<br>
            <span style="color: #0275d8;">PIXCOIN</span>
        </p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        <p style="text-align: center; font-size: 0.8em; color: #666;">
            Este é um e-mail automático. Por favor, não responda a esta mensagem.
        </p>
    </div>
</body>
        `,
    })
        .then(() => console.log('E-mail de inadimplência enviado!'))
        .catch(err => console.log('Erro ao enviar o email ', err.message));
}