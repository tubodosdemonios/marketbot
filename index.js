const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

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

const memoryPath = path.join(__dirname, "memory", "pedro.json");

// Memória curta por canal
const conversationMemory = new Map();
const MAX_HISTORY = 12;

function loadPedroMemory() {
  try {
    const raw = fs.readFileSync(memoryPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Erro ao ler memória:", error);
    return {
      preferences: [],
      principles: [],
      context: [],
      notes: []
    };
  }
}

function savePedroMemory(memory) {
  try {
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2), "utf8");
  } catch (error) {
    console.error("Erro ao guardar memória:", error);
  }
}

function formatPedroMemory(memory) {
  return `
Preferências:
${memory.preferences.length ? memory.preferences.map((x, i) => `${i + 1}. ${x}`).join("\n") : "Sem itens"}

Princípios:
${memory.principles.length ? memory.principles.map((x, i) => `${i + 1}. ${x}`).join("\n") : "Sem itens"}

Contexto:
${memory.context.length ? memory.context.map((x, i) => `${i + 1}. ${x}`).join("\n") : "Sem itens"}

Notas:
${memory.notes.length ? memory.notes.map((x, i) => `${i + 1}. ${x}`).join("\n") : "Sem itens"}
`.trim();
}

function getMemoryAsPrompt(memory) {
  return `
Memória do Pedro:

Preferências:
${memory.preferences.length ? memory.preferences.map((x) => `- ${x}`).join("\n") : "- sem dados"}

Princípios:
${memory.principles.length ? memory.principles.map((x) => `- ${x}`).join("\n") : "- sem dados"}

Contexto:
${memory.context.length ? memory.context.map((x) => `- ${x}`).join("\n") : "- sem dados"}

Notas:
${memory.notes.length ? memory.notes.map((x) => `- ${x}`).join("\n") : "- sem dados"}
`.trim();
}

function detectMemoryCategory(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes("prefiro") ||
    lower.includes("gosto de") ||
    lower.includes("quero respostas") ||
    lower.includes("evito")
  ) {
    return "preferences";
  }

  if (
    lower.includes("valorizo") ||
    lower.includes("importante para mim") ||
    lower.includes("princípio") ||
    lower.includes("principio")
  ) {
    return "principles";
  }

  if (
    lower.includes("estou a") ||
    lower.includes("neste momento") ||
    lower.includes("foco atual") ||
    lower.includes("foco actual")
  ) {
    return "context";
  }

  return "notes";
}

client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user)) return;

    const channelId = message.channel.id;
    const rawUserMessage = message.content.replace(/<@!?\d+>/g, "").trim();

    if (!rawUserMessage) {
      await message.reply("Diz-me o que queres que eu faça.");
      return;
    }

    const lowerMessage = rawUserMessage.toLowerCase();
    const pedroMemory = loadPedroMemory();

    // GUARDAR MEMÓRIA
    if (
      lowerMessage.startsWith("guarda isto na tua memória:") ||
      lowerMessage.startsWith("guarda isto na tua memoria:") ||
      lowerMessage.startsWith("lembra-te disto:") ||
      lowerMessage.startsWith("adiciona à tua memória:") ||
      lowerMessage.startsWith("adiciona a tua memoria:")
    ) {
      const item = rawUserMessage.split(":").slice(1).join(":").trim();

      if (!item) {
        await message.reply("Não encontrei nada para guardar.");
        return;
      }

      const category = detectMemoryCategory(item);
      pedroMemory[category].push(item);
      savePedroMemory(pedroMemory);

      await message.reply(`Guardado na memória em **${category}**.`);
      return;
    }

    // MOSTRAR MEMÓRIA
    if (
      lowerMessage === "mostra a tua memória" ||
      lowerMessage === "mostra a tua memoria" ||
      lowerMessage === "mostra-me a tua memória" ||
      lowerMessage === "mostra-me a tua memoria"
    ) {
      const formattedMemory = formatPedroMemory(pedroMemory);
      await message.reply(`🧠 **Memória atual**\n\n${formattedMemory}`);
      return;
    }

    // ESQUECER MEMÓRIA
    if (
      lowerMessage.startsWith("esquece isto da tua memória:") ||
      lowerMessage.startsWith("esquece isto da tua memoria:") ||
      lowerMessage.startsWith("remove da tua memória:") ||
      lowerMessage.startsWith("remove da tua memoria:")
    ) {
      const itemToRemove = rawUserMessage.split(":").slice(1).join(":").trim();

      if (!itemToRemove) {
        await message.reply("Não encontrei nada para remover.");
        return;
      }

      let removed = false;

      for (const key of ["preferences", "principles", "context", "notes"]) {
        const originalLength = pedroMemory[key].length;
        pedroMemory[key] = pedroMemory[key].filter(
          (item) => item.toLowerCase() !== itemToRemove.toLowerCase()
        );
        if (pedroMemory[key].length < originalLength) {
          removed = true;
        }
      }

      if (removed) {
        savePedroMemory(pedroMemory);
        await message.reply("Removi isso da memória.");
      } else {
        await message.reply("Não encontrei esse item na memória.");
      }
      return;
    }

    // HISTÓRICO CURTO
    let history = conversationMemory.get(channelId) || [];

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
- quer ajuda para pensar, estruturar, decidir e organizar

Usa também esta memória persistente:
${getMemoryAsPrompt(pedroMemory)}

Regras:
- mantém continuidade com base na conversa recente
- se ele fizer uma pergunta de seguimento, assume que o assunto continua, a menos que ele mude claramente de tema
- não repitas contexto desnecessariamente
- responde com foco no que acrescenta valor`
      },
      ...history,
      {
        role: "user",
        content: rawUserMessage
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messagesForOpenAI
    });

    const reply = completion.choices[0].message.content || "Não consegui gerar resposta.";

    await message.reply(reply);

    history.push({ role: "user", content: rawUserMessage });
    history.push({ role: "assistant", content: reply });

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
