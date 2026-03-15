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

// Memória curta por canal
const conversationMemory = new Map();

// Quantas mensagens guardar por canal
const MAX_HISTORY = 12;

client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    // Só responde se o bot for mencionado
    if (!message.mentions.has(client.user)) return;

    const channelId = message.channel.id;

    // Remove a menção do texto
    const userMessage = message.content.replace(/<@!?\d+>/g, "").trim();

    if (!userMessage) {
      await message.reply("Diz-me o que queres que eu faça.");
      return;
    }

    // Buscar histórico do canal
    let history = conversationMemory.get(channelId) || [];

    // Prompt do sistema
    const messagesForOpenAI = [
      {
        role: "system",
        content: `Tu és o assistente estratégico pessoal do Pedro.

Responde sempre em português de Portugal.
Sê claro, prático, estruturado e útil.

O Pedro:
- explora frequentemente novas ideias e modelos de negócio
- muda de direção quando encontra melhores oportunidades
- valoriza estrutura, clareza, utilidade prática, simplicidade e eficácia
- não quer soluções caras sem necessidade
- não quer um assistente preso a uma única área
- quer ajuda para pensar, estruturar, decidir e organizar

Regras:
- mantém continuidade com base na conversa recente
- se ele fizer uma pergunta de seguimento, assume que o assunto continua, a menos que ele mude claramente de tema
- não repitas contexto desnecessariamente
- responde com foco no que acrescenta valor`
      },
      ...history,
      {
        role: "user",
        content: userMessage
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messagesForOpenAI
    });

    const reply = completion.choices[0].message.content || "Não consegui gerar resposta.";

    await message.reply(reply);

    // Guardar histórico atualizado
    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: reply });

    // Limitar tamanho do histórico
    if (history.length > MAX_HISTORY) {
      history = history.slice(-MAX_HISTORY);
    }

    conversationMemory.set(channelId, history);

  } catch (error) {
    console.error("Erro OpenAI/Discord:", error);

    if (error.status === 429) {
      await message.reply("A IA está ligada, mas a conta da API ficou sem quota ou limite disponível.");
      return;
    }

    await message.reply("Ocorreu um erro ao falar com a IA.");
  }
});

client.login(process.env.DISCORD_TOKEN);
