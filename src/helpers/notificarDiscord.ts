import axios from 'axios';

export const notificarDiscord = async (urlDiscordWebhook: string, titulo: string, detalhe: string) => {
    const embeds = [
        {
            title: titulo,
            color: 5174599,
            footer: {
                text: `📅 ${new Date()}`,
            },
            fields: [
                {
                    name: '',
                    value: detalhe
                },
            ],
        },
    ];

    const data = JSON.stringify({ embeds });
    const config = {
        method: "POST",
        url: urlDiscordWebhook,
        headers: {"Content-Type": "application/json"},
        data: data,
    };

    axios(config)
        .then((response: any) => {
            console.log("Webhook delivered successfully");
            return response;
        })
        .catch((error: any) => {
            console.log(error);
        });
}
