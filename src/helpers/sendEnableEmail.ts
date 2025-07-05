import nodemailer from 'nodemailer';

export async function sendEnableEmail (email: string, clientName: string) {
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
        subject: 'Comunicado de Liberação',
        html: `
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="text-align: center; color: #5cb85c;">Comunicado de Liberação</h2>
        <p>Prezado(a) <strong>${clientName}</strong>,</p>
        <p>Esperamos que esteja bem.</p>
        <p>
            Temos o prazer de informar que, após a confirmação do pagamento da sua fatura, 
            as máquinas fornecidas pela <strong>PIXCOIN</strong> foram reativadas e estão novamente disponíveis 
            para uso, conforme os termos estabelecidos em nosso contrato.
        </p>
        <p>
            Agradecemos pela pronta regularização e reforçamos nosso compromisso em oferecer um serviço de excelência.
            Caso precise de qualquer suporte ou tenha dúvidas, nossa equipe de atendimento está à disposição através do telefone 
            <a href="tel:+5521979832030" style="color: #0275d8;">(21) 97983-2030</a>.
        </p>
        <p style="text-align: center; color: #888; font-size: 0.9em;">
            Agradecemos por sua confiança e parceria. Estamos à disposição para continuar contribuindo com o seu sucesso.
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