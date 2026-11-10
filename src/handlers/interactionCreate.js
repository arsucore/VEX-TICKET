const { PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../config');
const db = require('../utils/db');
const tb = require('../utils/ticketBuilder');
const { isStaff } = require('../utils/permissions');
const { closeTicketChannel } = require('./scheduler');

module.exports = async function interactionCreate(interaction) {
  try {
    if (interaction.isChatInputCommand()) return handleSlash(interaction);
    if (interaction.isStringSelectMenu() && interaction.customId === 'vex_ticket_category_select')
      return handleCategorySelect(interaction);
    if (interaction.isModalSubmit() && interaction.customId.startsWith('vex_ticket_modal_'))
      return handleModalSubmit(interaction);
    if (interaction.isButton() && interaction.customId === 'vex_ticket_claim') return handleClaim(interaction);
    if (interaction.isButton() && interaction.customId === 'vex_ticket_close') return handleCloseButton(interaction);
    if (interaction.isButton() && interaction.customId === 'vex_ticket_reopen') return handleReopen(interaction);
    if (interaction.isButton() && interaction.customId === 'vex_ticket_delete_now') return handleDeleteNow(interaction);
    if (interaction.isStringSelectMenu() && interaction.customId === 'vex_ticket_urgency_select')
      return handleUrgencyChange(interaction);
    if (interaction.isButton() && interaction.customId.startsWith('vex_rate_')) return handleRating(interaction);
  } catch (err) {
    console.error('Interaction error:', err);
    const payload = { content: '❌ Something went wrong. Check the bot logs.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
};

function fmtDuration(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  return `${(mins / 60).toFixed(1)} hr`;
}

function notStaffReply(interaction) {
  return interaction.reply({ content: '🚫 Staff only.', ephemeral: true });
}

// ---- Slash commands ----

async function handleSlash(interaction) {
  const { commandName } = interaction;

  if (commandName === 'ticket-panel') {
    const panel = tb.buildPanel();
    await interaction.channel.send(panel);
    return interaction.reply({ content: '✅ Panel posted.', ephemeral: true });
  }

  if (commandName === 'help') {
    return interaction.reply({ embeds: [tb.buildHelpEmbed()], ephemeral: true });
  }

  if (commandName === 'staffhelp') {
    if (!isStaff(interaction.member)) return notStaffReply(interaction);
    return interaction.reply({ embeds: [tb.buildStaffHelpEmbed()], ephemeral: true });
  }

  if (commandName === 'leaderboard') {
    const entries = db.getLeaderboard(10);
    return interaction.reply({ embeds: [tb.buildLeaderboardEmbed(entries)] });
  }

  if (commandName === 'stats') {
    const history = db.getHistory();
    const leaderboard = db.getLeaderboard(10);
    return interaction.reply({ embeds: [tb.buildStatsEmbed({ history, leaderboard })] });
  }

  if (commandName === 'close') {
    return closeTicket(interaction, interaction.user.id, interaction.options.getString('reason'));
  }

  if (commandName === 'ticket-add' || commandName === 'ticket-remove') {
    if (!isStaff(interaction.member)) return notStaffReply(interaction);
    const ticket = db.getTicket(interaction.channel.id);
    if (!ticket) return interaction.reply({ content: '⚠️ This is not a ticket channel.', ephemeral: true });
    const user = interaction.options.getUser('user');

    if (commandName === 'ticket-add') {
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      return interaction.reply({ content: `✅ Added <@${user.id}> to this ticket.` });
    }

    if (user.id === ticket.opener)
      return interaction.reply({ content: "⚠️ Can't remove the ticket opener. Close the ticket instead.", ephemeral: true });
    await interaction.channel.permissionOverwrites.delete(user.id).catch(() => {});
    return interaction.reply({ content: `✅ Removed <@${user.id}> from this ticket.` });
  }

  if (commandName === 'blacklist') {
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    if (sub === 'add') {
      db.addBlacklist(user.id);
      return interaction.reply({ content: `🚫 <@${user.id}> can no longer open tickets.`, ephemeral: true });
    }
    if (sub === 'remove') {
      db.removeBlacklist(user.id);
      return interaction.reply({ content: `✅ <@${user.id}> can open tickets again.`, ephemeral: true });
    }
  }

  if (commandName === 'cooldown-clear') {
    const user = interaction.options.getUser('user');
    db.clearCooldown(user.id);
    return interaction.reply({ content: `✅ Cleared <@${user.id}>'s ticket cooldown.`, ephemeral: true });
  }

  if (commandName === 'addstaff' || commandName === 'removestaff') {
    const role = interaction.options.getRole('role');
    const user = interaction.options.getUser('user');
    if (!role && !user) return interaction.reply({ content: '⚠️ Provide a role and/or a user.', ephemeral: true });

    const settings = db.getSettings();
    let staffRoleIds = settings.staffRoleIds;
    let staffUserIds = settings.staffUserIds;

    if (commandName === 'addstaff') {
      if (role && !staffRoleIds.includes(role.id)) staffRoleIds = [...staffRoleIds, role.id];
      if (user && !staffUserIds.includes(user.id)) staffUserIds = [...staffUserIds, user.id];
    } else {
      if (role) staffRoleIds = staffRoleIds.filter((id) => id !== role.id);
      if (user) staffUserIds = staffUserIds.filter((id) => id !== user.id);
    }

    db.updateSettings({ staffRoleIds, staffUserIds });
    const verb = commandName === 'addstaff' ? 'Added' : 'Removed';
    const who = [role ? `<@&${role.id}>` : null, user ? `<@${user.id}>` : null].filter(Boolean).join(' and ');
    return interaction.reply({ content: `✅ ${verb} ${who} ${commandName === 'addstaff' ? 'as' : 'from'} staff.`, ephemeral: true });
  }

  if (commandName === 'setupticket') {
    return handleSetupTicket(interaction);
  }
}

// ---- /setupticket: one-click (or customizable) setup ----

async function handleSetupTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const settings = db.getSettings();

  let categoryId = interaction.options.getChannel('category')?.id || settings.ticketCategoryId;
  if (!categoryId || !(await guild.channels.fetch(categoryId).catch(() => null))) {
    const cat = await guild.channels.create({ name: '🎫 VEX Tickets', type: ChannelType.GuildCategory });
    categoryId = cat.id;
  }

  let supportRoleId = interaction.options.getRole('support_role')?.id || settings.supportRoleId;
  if (!supportRoleId || !(await guild.roles.fetch(supportRoleId).catch(() => null))) {
    const role = await guild.roles.create({ name: 'VEX Support', color: 0x39ff6a, hoist: true, mentionable: true });
    supportRoleId = role.id;
  }

  let logChannelId = interaction.options.getChannel('log_channel')?.id || settings.logChannelId;
  if (!logChannelId || !(await guild.channels.fetch(logChannelId).catch(() => null))) {
    const logChannel = await guild.channels.create({
      name: '📄┃ticket-logs',
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });
    logChannelId = logChannel.id;
  }

  db.updateSettings({ ticketCategoryId: categoryId, supportRoleId, logChannelId });

  const panelChannel = interaction.options.getChannel('panel_channel') || interaction.channel;
  await panelChannel.send(tb.buildPanel());

  await interaction.editReply({
    embeds: [tb.buildSetupSummaryEmbed({ categoryId, logChannelId, supportRoleId, panelChannelId: panelChannel.id })],
  });
}

// ---- Select a category -> show modal (after blacklist/cooldown checks) ----

async function handleCategorySelect(interaction) {
  const userId = interaction.user.id;

  if (db.isBlacklisted(userId)) {
    return interaction.reply({ content: '🚫 You are not able to open tickets.', ephemeral: true });
  }

  const cooldownUntil = db.getCooldownUntil(userId);
  if (cooldownUntil > Date.now()) {
    return interaction.reply({
      content: `⏳ Please wait **${fmtDuration(cooldownUntil - Date.now())}** before opening another ticket.`,
      ephemeral: true,
    });
  }

  if (db.countOpenTicketsByUser(userId) >= config.maxOpenTicketsPerUser) {
    return interaction.reply({
      content: `⚠️ You already have the max of **${config.maxOpenTicketsPerUser}** open tickets. Please close one first.`,
      ephemeral: true,
    });
  }

  const categoryId = interaction.values[0];
  if (db.countOpenTicketsByCategory(categoryId) >= config.categoryOpenLimit) {
    return interaction.reply({
      content: `⚠️ This category is at capacity right now (${config.categoryOpenLimit} open tickets). Please try again shortly.`,
      ephemeral: true,
    });
  }

  const modal = tb.buildModal(categoryId);
  await interaction.showModal(modal);
}

// ---- Modal submitted -> create the ticket channel ----

async function handleModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const categoryId = interaction.customId.replace('vex_ticket_modal_', '');
  const category = tb.getCategory(categoryId);
  const answers = {};
  category.fields.forEach((f) => {
    answers[f.id] = interaction.fields.getTextInputValue(f.id);
  });

  const guild = interaction.guild;
  const settings = db.getSettings();
  const ticketNumber = db.nextTicketNumber();
  const urgencyKey = config.defaultUrgency;
  const channelName = tb.buildChannelName({ urgencyKey, categoryId, username: interaction.user.username });

  const overwrites = [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
  ];
  const staffAccess = [
    ...(settings.supportRoleId ? [settings.supportRoleId] : []),
    ...settings.staffRoleIds,
    ...settings.staffUserIds,
  ];
  for (const id of staffAccess) {
    overwrites.push({
      id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  if (!settings.ticketCategoryId) {
    await interaction.editReply({
      content: '⚠️ Tickets aren\'t set up yet. Ask an admin to run `/setupticket` first.',
    });
    return;
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: settings.ticketCategoryId,
    topic: tb.buildChannelTopic({ categoryId, urgencyKey, claimedBy: null, opener: interaction.user.id }),
    permissionOverwrites: overwrites,
  });

  const now = Date.now();
  db.saveTicket(channel.id, {
    categoryId,
    urgencyKey,
    opener: interaction.user.id,
    answers,
    claimedBy: null,
    claimedAt: null,
    ticketNumber,
    status: 'open',
    createdAt: now,
    lastActivityAt: now,
    inactivityWarned: false,
  });

  const embed = tb.buildTicketEmbed({ categoryId, urgencyKey, opener: interaction.user.id, answers, claimedBy: null, ticketNumber });
  const controls = tb.buildTicketControls({ claimedBy: null });

  const sent = await channel.send({
    content: `${settings.supportRoleId ? `<@&${settings.supportRoleId}> ` : ''}<@${interaction.user.id}>`,
    embeds: [embed],
    components: controls,
  });

  db.saveTicket(channel.id, { embedMessageId: sent.id });

  await interaction.editReply({ content: `✅ Your ticket is ready: ${channel}` });
}

// ---- Claim ----

async function handleClaim(interaction) {
  if (!isStaff(interaction.member)) return notStaffReply(interaction);

  const ticket = db.getTicket(interaction.channel.id);
  if (!ticket || ticket.status !== 'open') return interaction.reply({ content: '⚠️ This is not an active ticket.', ephemeral: true });
  if (ticket.claimedBy) return interaction.reply({ content: '⚠️ Already claimed.', ephemeral: true });

  const updated = db.saveTicket(interaction.channel.id, { claimedBy: interaction.user.id, claimedAt: Date.now() });
  db.addClaim(interaction.user.id);

  await refreshTicketMessage(interaction.channel, updated);
  await interaction.channel.setTopic(tb.buildChannelTopic(updated)).catch(() => {});
  await interaction.reply({ content: `🙋 Claimed by <@${interaction.user.id}>.` });
}

// ---- Urgency change ----

async function handleUrgencyChange(interaction) {
  if (!isStaff(interaction.member)) return notStaffReply(interaction);

  const ticket = db.getTicket(interaction.channel.id);
  if (!ticket || ticket.status !== 'open') return interaction.reply({ content: '⚠️ This is not an active ticket.', ephemeral: true });

  const newUrgency = interaction.values[0];
  const updated = db.saveTicket(interaction.channel.id, { urgencyKey: newUrgency });

  const username = (await interaction.guild.members.fetch(ticket.opener).catch(() => null))?.user.username || 'user';
  const newName = tb.buildChannelName({ urgencyKey: newUrgency, categoryId: ticket.categoryId, username });

  await interaction.channel.setName(newName).catch(() => {});
  await interaction.channel.setTopic(tb.buildChannelTopic(updated)).catch(() => {});
  await refreshTicketMessage(interaction.channel, updated);

  const u = tb.getUrgency(newUrgency);
  const settings = db.getSettings();
  const pingUrgent = newUrgency === 'urgent' && settings.supportRoleId ? `<@&${settings.supportRoleId}> ` : '';
  await interaction.reply({ content: `${pingUrgent}${u.emoji} Status set to **${u.label}**.` });
}

// ---- Close / Reopen / Delete now ----

async function handleCloseButton(interaction) {
  await interaction.reply({ content: '🔒 Closing this ticket...' });
  await closeTicketChannel(interaction.client, interaction.channel.id, { closedBy: interaction.user.id, reason: null });
}

async function closeTicket(interaction, closedBy, reason) {
  const ticket = db.getTicket(interaction.channel.id);
  if (!ticket || ticket.status !== 'open') return interaction.reply({ content: '⚠️ This is not an active ticket.', ephemeral: true });
  await interaction.reply({ content: '🔒 Closing this ticket...' });
  await closeTicketChannel(interaction.client, interaction.channel.id, { closedBy, reason });
}

async function handleReopen(interaction) {
  if (!isStaff(interaction.member)) return notStaffReply(interaction);

  const ticket = db.getTicket(interaction.channel.id);
  if (!ticket || ticket.status !== 'archived') return interaction.reply({ content: '⚠️ This ticket cannot be reopened.', ephemeral: true });

  const updated = db.saveTicket(interaction.channel.id, {
    status: 'open',
    lastActivityAt: Date.now(),
    inactivityWarned: false,
    deleteAt: null,
  });

  await interaction.channel.permissionOverwrites.edit(ticket.opener, { SendMessages: true }).catch(() => {});
  if (ticket.claimedBy) {
    await interaction.channel.permissionOverwrites.edit(ticket.claimedBy, { SendMessages: true }).catch(() => {});
  }

  const username = (await interaction.guild.members.fetch(ticket.opener).catch(() => null))?.user.username || 'user';
  const newName = tb.buildChannelName({ urgencyKey: updated.urgencyKey, categoryId: updated.categoryId, username });
  await interaction.channel.setName(newName).catch(() => {});

  await interaction.reply({ content: `🔓 Ticket reopened by <@${interaction.user.id}>.` });
}

async function handleDeleteNow(interaction) {
  if (!isStaff(interaction.member)) return notStaffReply(interaction);

  const ticket = db.getTicket(interaction.channel.id);
  if (!ticket || ticket.status !== 'archived') return interaction.reply({ content: '⚠️ This ticket is not archived.', ephemeral: true });

  await interaction.reply({ content: '🗑️ Deleting...' });
  db.deleteTicket(interaction.channel.id);
  setTimeout(() => interaction.channel.delete().catch(() => {}), 1500);
}

// ---- Rating (from DM buttons) ----

async function handleRating(interaction) {
  const [, , ticketNumberStr, starsStr] = interaction.customId.split('_');
  const ok = db.setRating(Number(ticketNumberStr), Number(starsStr));
  await interaction.update({
    content: ok ? `Thanks for the feedback! You rated us ${'⭐'.repeat(Number(starsStr))}` : 'Thanks for the feedback!',
    embeds: [],
    components: [],
  });
}

// ---- Shared: re-render the ticket embed/buttons after a state change ----

async function refreshTicketMessage(channel, ticket) {
  if (!ticket.embedMessageId) return;
  const message = await channel.messages.fetch(ticket.embedMessageId).catch(() => null);
  if (!message) return;
  const embed = tb.buildTicketEmbed({ ...ticket });
  const controls = tb.buildTicketControls({ claimedBy: ticket.claimedBy });
  await message.edit({ embeds: [embed], components: controls }).catch(() => {});
}

module.exports.updateActivity = function updateActivity(channelId) {
  const ticket = db.getTicket(channelId);
  if (ticket && ticket.status === 'open') {
    db.saveTicket(channelId, { lastActivityAt: Date.now(), inactivityWarned: false });
  }
};
