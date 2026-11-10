require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const interactionCreate = require('./handlers/interactionCreate');
const { startScheduler } = require('./handlers/scheduler');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log(`⚡ VEX TICKET is online as ${client.user.tag}`);
  startScheduler(client);
});

client.on('interactionCreate', interactionCreate);

// Tracks last-activity time per ticket so the inactivity warn/auto-close system works.
client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  interactionCreate.updateActivity(message.channel.id);
});

client.login(process.env.DISCORD_TOKEN);
