const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;

  try {

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
Tu és um assistente de análise de negócios.
Ajuda a encontrar:
- produtos virais
- fornecedores
- tendências de mercado
- ideias para vender em vending ou pastelaria

Responde sempre de forma curta e estruturada.
          `,
        },
        {
          role: "user",
          content: message.content,
        },
      ],
    });

    const reply = response.choices[0].message.content;

    message.reply(reply);

  } catch (error) {

    console.error(error);
    message.reply("Erro ao contactar a IA.");

  }

});

client.login(process.env.DISCORD_TOKEN);
