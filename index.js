const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    // Só responde se o bot for mencionado
    if (!message.mentions.has(client.user)) return;

    // Remove a menção do texto
    const userMessage = message.content.replace(/<@!?\d+>/g, "").trim();

    if (!userMessage) {
      await message.reply("Diz-me o que queres que eu faça.");
      return;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `Tu és um assistente prático de negócios para Discord.
Responde em português de Portugal.
Sê claro, direto e útil.
Ajuda com:
- produtos em tendência
- fornecedores
- preços de mercado
- concorrentes
- ideias para vending, pastelaria e revenda

Responde de forma estruturada e simples.`
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    const reply = completion.choices[0].message.content || "Não consegui gerar resposta.";

    await message.reply(reply);
  } catch (error) {
    console.error("Erro OpenAI/Discord:", error);
    await message.reply("Ocorreu um erro ao falar com a IA.");
  }
});

client.login(process.env.DISCORD_TOKEN);
