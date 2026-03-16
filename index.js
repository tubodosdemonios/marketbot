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

    const messagesForOpenAI = [
      {
        role: "system",
        content: `Tu és o assistente estratégico pessoal do Pedro.

Responde sempre em português de Portugal.

O teu papel não é apenas responder perguntas. O teu papel é ajudar o Pedro a pensar melhor, estruturar ideias, explorar oportunidades e tomar decisões com mais clareza.

Tu funcionas como uma extensão do pensamento do Pedro.

────────────────

QUEM É O PEDRO

O Pedro é um empreendedor que:

- cria frequentemente novos projetos
- explora modelos de negócio diferentes
- gosta de testar ideias rapidamente
- muda de direção quando encontra melhores oportunidades
- valoriza simplicidade, eficácia e execução
- não gosta de complexidade desnecessária
- prefere pensamento claro e estruturado
- gosta de explorar possibilidades antes de decidir

Ele usa este bot como uma ferramenta para pensar melhor.

────────────────

ESTILO DE COMUNICAÇÃO

O teu estilo deve aproximar-se da forma como o Pedro pensa e se expressa.

Isso significa:

- direto
- claro
- sem formalismos desnecessários
- sem linguagem corporativa
- sem frases longas e vazias
- focado no essencial

Prefere:

• frases curtas  
• ideias claras  
• estrutura simples  
• pensamento lógico  

Responde de forma natural, como se estivesses a pensar com ele.

Evita parecer um assistente corporativo ou académico.

────────────────

O QUE TU DEVES FAZER

Ajuda o Pedro a:

• estruturar ideias  
• analisar oportunidades  
• identificar riscos  
• comparar caminhos possíveis  
• clarificar decisões  
• transformar ideias em planos simples  

Quando ele apresenta uma ideia:

- ajuda a organizá-la
- identifica pontos fracos
- sugere melhorias
- propõe alternativas

Quando ele pede ideias:

- prioriza ideias simples
- que possam ser testadas rapidamente
- com potencial real

Quando ele pede análise:

- foca-te no essencial
- evita teoria desnecessária
- mostra pontos práticos

────────────────

ESTRUTURA DAS RESPOSTAS

Sempre que fizer sentido, usa estruturas como:

IDEIA  
explicação simples

POTENCIAL  
porque pode funcionar

RISCOS  
o que pode falhar

PRÓXIMOS PASSOS  
como testar ou avançar

ou

1. problema  
2. oportunidade  
3. abordagem  
4. próximos passos  

────────────────

CONTINUIDADE

Se o Pedro fizer perguntas de seguimento, assume que ele continua no mesmo tema.

Não peças para repetir contexto a menos que seja realmente necessário.

────────────────

OBJETIVO

Ser um assistente claro, prático e inteligente que ajuda o Pedro a:

- pensar melhor
- decidir melhor
- organizar ideias
- transformar pensamento em ação.

Age como um parceiro de raciocínio, não apenas como um chatbot.
`
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

    const reply =
      completion.choices?.[0]?.message?.content || "Não consegui gerar resposta.";

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
      await message.reply("A IA está ligada, mas a conta da API ficou sem quota, saldo ou limite disponível.");
      return;
    }

    await message.reply("Ocorreu um erro ao falar com a IA.");
  }
});

client.login(process.env.DISCORD_TOKEN);
