require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('setupticket')
    .setDescription('One-click setup: ticket category, support role, log channel, and the panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      opt.setName('category').setDescription('Existing category to use (skip to auto-create one)').addChannelTypes(ChannelType.GuildCategory).setRequired(false)
    )
    .addRoleOption((opt) => opt.setName('support_role').setDescription('Existing support role to use (skip to auto-create one)').setRequired(false))
    .addChannelOption((opt) =>
      opt.setName('log_channel').setDescription('Existing log channel to use (skip to auto-create one)').addChannelTypes(ChannelType.GuildText).setRequired(false)
    )
    .addChannelOption((opt) =>
      opt.setName('panel_channel').setDescription('Where to post the ticket panel (defaults to this channel)').addChannelTypes(ChannelType.GuildText).setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Post the VEX TICKET panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder().setName('help').setDescription('How to open a ticket'),
  new SlashCommandBuilder().setName('staffhelp').setDescription('Staff command cheat-sheet (staff only)'),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the staff ticket-claim leaderboard'),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show the VEX TICKET stats dashboard')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current ticket')
    .addStringOption((opt) => opt.setName('reason').setDescription('Why this ticket is being closed').setRequired(false)),

  new SlashCommandBuilder()
    .setName('ticket-add')
    .setDescription('Add a user to the current ticket (staff only)')
    .addUserOption((opt) => opt.setName('user').setDescription('User to add').setRequired(true)),

  new SlashCommandBuilder()
    .setName('ticket-remove')
    .setDescription('Remove a user from the current ticket (staff only)')
    .addUserOption((opt) => opt.setName('user').setDescription('User to remove').setRequired(true)),

  new SlashCommandBuilder()
    .setName('addstaff')
    .setDescription('Give a role or user staff access to tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((opt) => opt.setName('role').setDescription('Role to mark as staff').setRequired(false))
    .addUserOption((opt) => opt.setName('user').setDescription('Individual user to mark as staff').setRequired(false)),

  new SlashCommandBuilder()
    .setName('removestaff')
    .setDescription('Remove a role or user from staff access')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((opt) => opt.setName('role').setDescription('Role to unmark as staff').setRequired(false))
    .addUserOption((opt) => opt.setName('user').setDescription('Individual user to unmark as staff').setRequired(false)),

  new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Manage who is allowed to open tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Block a user from opening tickets')
        .addUserOption((opt) => opt.setName('user').setDescription('User to blacklist').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Allow a user to open tickets again')
        .addUserOption((opt) => opt.setName('user').setDescription('User to unblock').setRequired(true))
    ),

  new SlashCommandBuilder()
    .setName('cooldown-clear')
    .setDescription("Clear a user's ticket cooldown")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((opt) => opt.setName('user').setDescription('User to clear').setRequired(true)),
].map((c) => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log('✅ Slash commands registered for guild', process.env.GUILD_ID);
  } catch (err) {
    console.error(err);
  }
})();
