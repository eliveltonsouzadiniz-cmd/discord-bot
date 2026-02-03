const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField
} = require("discord.js");

const config = require("./config.json");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const LIMIT = 2;
const filas = {};

client.once("ready", async () => {
  console.log(`✅ Bot ligado como ${client.user.tag}`);

  for (const mode of config.modes) {
    const channel = await client.channels.fetch(mode.channelId);
    if (!channel) continue;

    await channel.bulkDelete(10).catch(() => {});

    for (const price of config.prices) {
      const filaId = `${mode.mode}_${price}`;
      filas[filaId] = [];

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle(mode.mode)
        .setDescription(
          `💰 **Valor:** R$${price}\n` +
          `👥 **Jogadores:** 0/${LIMIT}`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`entrar_${filaId}`)
          .setLabel("Entrar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`sair_${filaId}`)
          .setLabel("Sair")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [embed], components: [row] });
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [acao, ...rest] = interaction.customId.split("_");
  const filaId = rest.join("_");
  const fila = filas[filaId];
  if (!fila) return;

  if (acao === "entrar") {
    if (fila.includes(interaction.user.id))
      return interaction.reply({ content: "❌ Você já entrou.", ephemeral: true });

    if (fila.length >= LIMIT)
      return interaction.reply({ content: "❌ Fila cheia.", ephemeral: true });

    fila.push(interaction.user.id);
  }

  if (acao === "sair") {
    const i = fila.indexOf(interaction.user.id);
    if (i !== -1) fila.splice(i, 1);
  }

  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setDescription(
      `💰 **Valor:** R$${filaId.split("_").pop()}\n` +
      `👥 **Jogadores:** ${fila.length}/${LIMIT}`
    );

  await interaction.update({ embeds: [embed] });

  // 🔒 CRIA SALA QUANDO BATER 2
  if (fila.length === LIMIT) {
    const guild = interaction.guild;

    const privateChannel = await guild.channels.create({
      name: `🔒-${filaId}`,
      type: ChannelType.GuildText,
      parent: config.categoryPrivate,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        ...fila.map(id => ({
          id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages
          ]
        }))
      ]
    });

    const roomEmbed = new EmbedBuilder()
      .setColor("#2ecc71")
      .setTitle("🎮 Sala Privada Criada")
      .setDescription(
        `📌 **Modo:** ${filaId.split("_")[0]}\n\n` +
        `👥 **Jogadores:**\n${fila.map(id => `<@${id}>`).join("\n")}\n\n` +
        `💳 **Pix:**\n${config.pix}`
      );

    await privateChannel.send({ embeds: [roomEmbed] });

    filas[filaId] = [];
  }
});

client.login(config.token);
