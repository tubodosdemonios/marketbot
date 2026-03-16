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

const conversationMemory = new Map();
const MAX_HISTORY = 12;

const projectsPath = path.join(__dirname, "data", "projects.json");

function loadProjects() {
  try {
    const raw = fs.readFileSync(projectsPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { projects: [] };
  }
}

function saveProjects(data) {
  fs.writeFileSync(projectsPath, JSON.stringify(data, null, 2), "utf8");
}

function getProject(data, name) {
  return data.projects.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
}

function getOrCreateProject(data, name) {
  let project = getProject(data, name);

  if (!project) {
    project = {
      name,
      priority: "não definida",
      pending: [],
      done: [],
      notes: []
    };
    data.projects.push(project);
  }

  return project;
}

function getProjectsAsPrompt(data) {
  if (!data.projects.length) {
    return "Não existem projetos registados.";
  }

  return data.projects
    .map((project) => {
      const pending = project.pending?.length
        ? project.pending.map((t) => `- ${t}`).join("\n")
        : "- sem pendentes";

      const done = project.done?.length
        ? project.done.map((t) => `- ${t}`).join("\n")
        : "- sem concluídos";

      const notes = project.notes?.length
        ? project.notes.map((t) => `- ${t}`).join("\n")
        : "- sem notas";

      return `Projeto: ${project.name}
Prioridade: ${project.priority || "não definida"}

Pendentes:
${pending}

Concluído:
${done}

Notas:
${notes}`;
    })
    .join("\n\n");
}

function uniquePush(array, value) {
  if (!array.some((item) => item.toLowerCase() === value.toLowerCase())) {
    array.push(value);
  }
}

client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user)) return;

    const channelId = message.channel.id;
    const text = message.content.replace(/<@!?\d+>/g, "").trim();
    const lower = text.toLowerCase();

    if (!text) {
      await message.reply("Diz-me o que queres que eu faça.");
      return;
    }

    const data = loadProjects();

    // ADICIONAR PENDENTE
    {
      const match = text.match(/no projeto\s+(.+?)\s+falta(?:\s+fazer)?\s+(.+)/i);
      if (match) {
        const projectName = match[1].trim();
        const task = match[2].trim();

        const project = getOrCreateProject(data, projectName);
        uniquePush(project.pending, task);

        saveProjects(data);

        await message.reply(`Registado no projeto **${projectName}**: falta ${task}`);
        return;
      }
    }

    // VER PENDENTES
    {
      const match = text.match(/o que falta fazer no projeto\s+(.+?)\??$/i);
      if (match) {
        const projectName = match[1].trim();
        const project = getProject(data, projectName);

        if (!project) {
          await message.reply("Não encontrei esse projeto.");
          return;
        }

        if (!project.pending.length) {
          await message.reply(`No projeto **${projectName}** não há tarefas pendentes.`);
          return;
        }

        let reply = `No projeto **${projectName}** falta fazer:\n\n`;
        project.pending.forEach((t, i) => {
          reply += `${i + 1}. ${t}\n`;
        });

        await message.reply(reply.trim());
        return;
      }
    }

    // MARCAR COMO FEITO
    {
      const match = text.match(/no projeto\s+(.+?)\s+já está feito\s+(.+)/i);
      if (match) {
        const projectName = match[1].trim();
        const task = match[2].trim();

        const project = getProject(data, projectName);

        if (!project) {
          await message.reply("Projeto não encontrado.");
          return;
        }

        project.pending = project.pending.filter(
          (t) => t.toLowerCase() !== task.toLowerCase()
        );
        uniquePush(project.done, task);

        saveProjects(data);

        await message.reply(`Atualizado. No projeto **${projectName}** já está feito: ${task}`);
        return;
      }
    }

    // RESUMO DO PROJETO
    {
      const match = text.match(/resumo do projeto\s+(.+)/i);
      if (match) {
        const projectName = match[1].trim();
        const project = getProject(data, projectName);

        if (!project) {
          await message.reply("Projeto não encontrado.");
          return;
        }

        let reply = `Resumo do projeto **${projectName}**\n\n`;

        reply += `Prioridade: ${project.priority || "não definida"}\n\n`;

        reply += `Pendentes:\n`;
        if (!project.pending.length) {
          reply += "nenhum\n";
        } else {
          project.pending.forEach((t, i) => {
            reply += `${i + 1}. ${t}\n`;
          });
        }

        reply += `\nConcluído:\n`;
        if (!project.done.length) {
          reply += "nenhum\n";
        } else {
          project.done.forEach((t, i) => {
            reply += `${i + 1}. ${t}\n`;
          });
        }

        reply += `\nNotas:\n`;
        if (!project.notes.length) {
          reply += "nenhuma";
        } else {
          project.notes.forEach((t, i) => {
            reply += `${i + 1}. ${t}\n`;
          });
        }

        await message.reply(reply.trim());
        return;
      }
    }

    // ADICIONAR NOTA
    {
      const match = text.match(/adiciona uma nota ao projeto\s+(.+?):\s*(.+)/i);
      if (match) {
        const projectName = match[1].trim();
        const note = match[2].trim();

        const project = getOrCreateProject(data, projectName);
        uniquePush(project.notes, note);

        saveProjects(data);

        await message.reply(`Nota adicionada ao projeto **${projectName}**.`);
        return;
      }
    }

    // MOSTRAR NOTAS
    {
      const match = text.match(/mostra as notas do projeto\s+(.+?)\??$/i);
      if (match) {
        const projectName = match[1].trim();
        const project = getProject(data, projectName);

        if (!project) {
          await message.reply("Projeto não encontrado.");
          return;
        }

        if (!project.notes.length) {
          await message.reply(`O projeto **${projectName}** não tem notas.`);
          return;
        }

        let reply = `Notas do projeto **${projectName}**:\n\n`;
        project.notes.forEach((note, i) => {
          reply += `${i + 1}. ${note}\n`;
        });

        await message.reply(reply.trim());
        return;
      }
    }

    // VER CONCLUÍDOS
    {
      const match = text.match(/o que já foi feito no projeto\s+(.+?)\??$/i);
      if (match) {
        const projectName = match[1].trim();
        const project = getProject(data, projectName);

        if (!project) {
          await message.reply("Projeto não encontrado.");
          return;
        }

        if (!project.done.length) {
          await message.reply(`No projeto **${projectName}** ainda não há nada marcado como concluído.`);
          return;
        }

        let reply = `No projeto **${projectName}** já foi feito:\n\n`;
        project.done.forEach((item, i) => {
          reply += `${i + 1}. ${item}\n`;
        });

        await message.reply(reply.trim());
        return;
      }
    }

    // DEFINIR PRIORIDADE
    {
      const match = text.match(/a prioridade do projeto\s+(.+?)\s+é\s+(.+)/i);
      if (match) {
        const projectName = match[1].trim();
        const priority = match[2].trim();

        const project = getOrCreateProject(data, projectName);
        project.priority = priority;

        saveProjects(data);

        await message.reply(`Defini a prioridade do projeto **${projectName}** como **${priority}**.`);
        return;
      }
    }

    // VER PRIORIDADE
    {
      const match = text.match(/qual é a prioridade do projeto\s+(.+?)\??$/i);
      if (match) {
        const projectName = match[1].trim();
        const project = getProject(data, projectName);

        if (!project) {
          await message.reply("Projeto não encontrado.");
          return;
        }

        await message.reply(`A prioridade do projeto **${projectName}** é **${project.priority || "não definida"}**.`);
        return;
      }
    }

    // CONVERSA NORMAL COM IA
    let history = conversationMemory.get(channelId) || [];
    const projectsContext = getProjectsAsPrompt(data);

    const messagesForOpenAI = [
      {
        role: "system",
        content: `Tu és o assistente estratégico pessoal do Pedro.

Responde sempre em português de Portugal.

O teu papel não é apenas responder perguntas. O teu papel é ajudar o Pedro a pensar melhor, estruturar ideias, explorar oportunidades, clarificar decisões, organizar projetos e transformar pensamento em ação.

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

Ele usa este bot como ferramenta para pensar, organizar e decidir.

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
- natural e prático

Prefere:

• frases curtas
• ideias claras
• estrutura simples
• pensamento lógico
• respostas úteis

Responde de forma natural, como se estivesses a pensar com ele.

Evita parecer:
- excessivamente formal
- académico
- corporativo
- genérico

────────────────

MÉTODO DE PENSAMENTO

Antes de responder, identifica internamente qual é a situação:

1. O Pedro está a:
- explorar uma ideia
- pedir análise
- comparar opções
- tentar decidir
- organizar algo
- pedir próximos passos
- gerir um projeto

2. Decide qual é a resposta mais útil:
- estruturar
- simplificar
- analisar
- comparar
- priorizar
- transformar em plano
- clarificar pendentes

3. Dá prioridade ao que mais ajuda neste momento:
- clareza
- utilidade
- decisão
- execução

4. Evita despejar informação sem direção.

O objetivo não é dizer tudo.
O objetivo é dizer o que mais ajuda.

────────────────

O QUE TU DEVES FAZER

Ajuda o Pedro a:

• estruturar ideias
• analisar oportunidades
• identificar riscos
• comparar caminhos possíveis
• clarificar decisões
• transformar ideias em planos simples
• organizar projetos em andamento
• perceber o que falta fazer

Quando ele apresenta uma ideia:
- organiza a ideia
- identifica pontos fortes
- mostra fragilidades
- sugere melhorias
- propõe alternativas quando fizer sentido

Quando ele pede ideias:
- prioriza ideias simples
- que possam ser testadas rapidamente
- com potencial real
- com boa relação entre esforço e oportunidade

Quando ele pede análise:
- foca-te no essencial
- evita teoria desnecessária
- mostra implicações práticas

Quando ele está indeciso:
- reduz a confusão
- separa o importante do acessório
- ajuda-o a ver os trade-offs

Quando o tema envolve projetos:
- usa o contexto operacional disponível
- considera pendentes, concluídos, notas e prioridade
- ajuda a clarificar próximos passos

────────────────

COMO ESTRUTURAR AS RESPOSTAS

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

ou

OPÇÃO A
vantagens
limitações

OPÇÃO B
vantagens
limitações

RECOMENDAÇÃO
qual faz mais sentido e porquê

────────────────

CONTEXTO OPERACIONAL DOS PROJETOS

${projectsContext}

────────────────

REGRAS IMPORTANTES

- Mantém continuidade com base na conversa recente.
- Se o Pedro fizer perguntas de seguimento, assume que continua no mesmo tema.
- Não peças para repetir contexto a menos que seja realmente necessário.
- Não compliques sem necessidade.
- Não alongues respostas só para parecer completo.
- Se houver demasiadas possibilidades, ajuda a reduzir.
- Se a pergunta for vaga, responde de forma útil em vez de te perderes em abstrações.
- Privilegia sempre clareza, utilidade e ação.

────────────────

OBJETIVO FINAL

Ser um parceiro de raciocínio do Pedro.

Não és apenas um chatbot.
És uma ferramenta para:

- pensar melhor
- decidir melhor
- organizar melhor
- agir melhor

A tua prioridade é ser útil, claro, prático e alinhado com a forma como o Pedro pensa.`
      },
      ...history,
      {
        role: "user",
        content: text
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messagesForOpenAI
    });

    const reply =
      completion.choices?.[0]?.message?.content || "Não consegui gerar resposta.";

    await message.reply(reply);

    history.push({ role: "user", content: text });
    history.push({ role: "assistant", content: reply });

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

    await message.reply("Ocorreu um erro.");
  }
});

client.login(process.env.DISCORD_TOKEN);
