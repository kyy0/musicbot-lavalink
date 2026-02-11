const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const { Manager } = require("erela.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ===== LAVALINK MANAGER =====
const manager = new Manager({
  nodes: [
    {
      host: process.env.LAVA_HOST,
      port: 443,
      password: process.env.LAVA_PASS,
      secure: true
    }
  ],
  send(id, payload) {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  }
});

// ===== DEBUG EVENTS =====
manager.on("nodeConnect", () => {
  console.log("✅ Lavalink Connected");
});

manager.on("nodeError", (node, error) => {
  console.log("❌ Lavalink Error:", error);
});

manager.on("trackStart", (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send(`🎵 Now Playing: **${track.title}**`);
});

client.once("clientReady", () => {
  console.log(`Login sebagai ${client.user.tag}`);
  manager.init(client.user.id);
});

client.on("raw", (d) => manager.updateVoiceState(d));


// ===== SLASH COMMAND REGISTER =====
const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Putar lagu")
    .addStringOption(option =>
      option.setName("lagu")
        .setDescription("Judul atau link")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop musik")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();


// ===== COMMAND HANDLER =====
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "play") {

    if (!interaction.member.voice.channel)
      return interaction.reply({ content: "Masuk VC dulu!", ephemeral: true });

    const player = manager.create({
      guild: interaction.guild.id,
      voiceChannel: interaction.member.voice.channel.id,
      textChannel: interaction.channel.id,
      selfDeafen: true
    });

    player.connect();

    const res = await manager.search(
      interaction.options.getString("lagu"),
      interaction.user
    );

    if (res.loadType === "NO_MATCHES")
      return interaction.reply("❌ Lagu tidak ditemukan.");

    player.queue.add(res.tracks[0]);

    if (!player.playing) player.play();

    interaction.reply(`🔍 Mencari lagu...`);
  }

  if (interaction.commandName === "stop") {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply("Tidak ada lagu.");
    player.destroy();
    interaction.reply("⏹️ Musik dihentikan.");
  }
});

client.login(TOKEN);
