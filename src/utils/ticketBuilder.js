const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const config = require('../config');

function getCategory(id) {
  return config.ticketCategories.find((c) => c.id === id);
}

function getUrgency(key) {
  return config.urgencyLevels[key] || config.urgencyLevels[config.defaultUrgency];
}

// ---- Panel (posted once in a #open-a-ticket style channel) ----

function buildPanel() {
  const embed = new EmbedBuilder()
    .setTitle(config.panelTitle)
    .setDescription(config.panelDescription)
    .setColor(config.embedColor)
    .setFooter({ text: config.footerText });

  const select = new StringSelectMenuBuilder()
    .setCustomId('vex_ticket_category_select')
    .setPlaceholder('🎫 Open a ticket...')
    .addOptions(
      config.ticketCategories.map((c) => ({
        label: c.label,
        value: c.id,
        description: c.description,
        emoji: c.emoji,
      }))
    );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] };
}

// ---- Modal per category ----

function buildModal(categoryId) {
  const category = getCategory(categoryId);
  const modal = new ModalBuilder()
    .setCustomId(`vex_ticket_modal_${categoryId}`)
    .setTitle(`${category.emoji} ${category.label}`);

  const rows = category.fields.map((f) =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(f.id)
        .setLabel(f.label)
        .setStyle(f.style === 'Paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setPlaceholder(f.placeholder || '')
        .setRequired(f.required !== false)
        .setMaxLength(f.style === 'Paragraph' ? 1000 : 200)
    )
  );

  modal.addComponents(...rows);
  return modal;
}

// ---- Ticket channel name ----

function buildChannelName({ urgencyKey, categoryId, username }) {
  const urgency = getUrgency(urgencyKey);
  const category = getCategory(categoryId);
  const safeName = username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';
  return `${urgency.emoji}┃${category.id}-${safeName}`.slice(0, 100);
}

// ---- Ticket info embed + controls (posted inside the ticket channel) ----

function buildTicketEmbed({ categoryId, urgencyKey, opener, answers, claimedBy, ticketNumber }) {
  const category = getCategory(categoryId);
  const urgency = getUrgency(urgencyKey);

  const embed = new EmbedBuilder()
    .setTitle(`${category.emoji} ${category.label} — Ticket #${ticketNumber}`)
    .setColor(urgency.color)
    .setDescription(`Opened by <@${opener}>`)
    .addFields(
      Object.entries(answers).map(([key, value]) => {
        const field = category.fields.find((f) => f.id === key);
        return { name: field ? field.label : key, value: value.slice(0, 1024) || '—' };
      })
    )
    .addFields(
      { name: 'Status', value: `${urgency.emoji} ${urgency.label}`, inline: true },
      { name: 'Claimed by', value: claimedBy ? `<@${claimedBy}>` : 'Unclaimed', inline: true }
    )
    .setFooter({ text: config.footerText })
    .setTimestamp();

  return embed;
}

function buildTicketControls({ claimedBy }) {
  const claimButton = new ButtonBuilder()
    .setCustomId('vex_ticket_claim')
    .setLabel(claimedBy ? 'Claimed' : 'Claim Ticket')
    .setEmoji('🙋')
    .setStyle(ButtonStyle.Success)
    .setDisabled(!!claimedBy);

  const closeButton = new ButtonBuilder()
    .setCustomId('vex_ticket_close')
    .setLabel('Close Ticket')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  const urgencySelect = new StringSelectMenuBuilder()
    .setCustomId('vex_ticket_urgency_select')
    .setPlaceholder('Set urgency...')
    .addOptions(
      Object.entries(config.urgencyLevels).map(([key, u]) => ({
        label: u.label,
        value: key,
        emoji: u.emoji,
      }))
    );

  return [
    new ActionRowBuilder().addComponents(claimButton, closeButton),
    new ActionRowBuilder().addComponents(urgencySelect),
  ];
}

function buildChannelTopic({ categoryId, urgencyKey, claimedBy, opener }) {
  const category = getCategory(categoryId);
  const urgency = getUrgency(urgencyKey);
  return `Status: ${urgency.emoji} ${urgency.label} | Category: ${category.label} | Opener: <@${opener}> | Claimed by: ${
    claimedBy ? `<@${claimedBy}>` : 'nobody yet'
  }`.slice(0, 1024);
}

// ---- Leaderboard embed ----

function buildLeaderboardEmbed(entries) {
  const medals = ['🥇', '🥈', '🥉'];
  const embed = new EmbedBuilder()
    .setTitle('🏆 VEX TICKET — Claim Leaderboard')
    .setColor(config.embedColor)
    .setFooter({ text: config.footerText })
    .setTimestamp();

  if (!entries.length) {
    embed.setDescription('No tickets have been claimed yet.');
    return embed;
  }

  embed.setDescription(
    entries
      .map(([userId, count], i) => `${medals[i] || `**${i + 1}.**`} <@${userId}> — **${count}** claimed`)
      .join('\n')
  );
  return embed;
}

// ---- Archive controls (shown after a ticket is closed, replaces the normal controls) ----

function buildArchiveControls() {
  const reopenButton = new ButtonBuilder()
    .setCustomId('vex_ticket_reopen')
    .setLabel('Reopen')
    .setEmoji('🔓')
    .setStyle(ButtonStyle.Success);

  const deleteButton = new ButtonBuilder()
    .setCustomId('vex_ticket_delete_now')
    .setLabel('Delete Now')
    .setEmoji('🗑️')
    .setStyle(ButtonStyle.Danger);

  return [new ActionRowBuilder().addComponents(reopenButton, deleteButton)];
}

function buildArchivedEmbed({ closedBy, reason, ticketNumber, deleteAt }) {
  return new EmbedBuilder()
    .setTitle(`🔒 Ticket #${ticketNumber} Closed`)
    .setColor(0x5c5c5c)
    .setDescription(
      `Closed by <@${closedBy}>${reason ? ` — ${reason}` : ''}.\n` +
        `Auto-deletes <t:${Math.floor(deleteAt / 1000)}:R> unless reopened.`
    )
    .setFooter({ text: config.footerText });
}

// ---- Rating DM (sent to the ticket opener after close) ----

function buildRatingDM(ticketNumber) {
  const embed = new EmbedBuilder()
    .setTitle('⭐ How did we do?')
    .setColor(config.embedColor)
    .setDescription(`Your ticket #${ticketNumber} on **GrimVex_MC** was just closed. Rate the support you got:`)
    .setFooter({ text: config.footerText });

  const row = new ActionRowBuilder().addComponents(
    [1, 2, 3, 4, 5].map((n) =>
      new ButtonBuilder()
        .setCustomId(`vex_rate_${ticketNumber}_${n}`)
        .setLabel('⭐'.repeat(n))
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return { embeds: [embed], components: [row] };
}

// ---- Stats dashboard ----

function buildStatsEmbed({ history, leaderboard }) {
  const embed = new EmbedBuilder()
    .setTitle('📊 VEX TICKET — Stats Dashboard')
    .setColor(config.embedColor)
    .setFooter({ text: config.footerText })
    .setTimestamp();

  if (!history.length) {
    embed.setDescription('No closed tickets yet.');
    return embed;
  }

  const total = history.length;
  const byCategory = {};
  let claimTimes = [];
  let closeTimes = [];
  let ratings = [];

  for (const h of history) {
    byCategory[h.categoryId] = (byCategory[h.categoryId] || 0) + 1;
    if (h.claimedAt) claimTimes.push(h.claimedAt - h.createdAt);
    if (h.closedAt) closeTimes.push(h.closedAt - h.createdAt);
    if (typeof h.rating === 'number') ratings.push(h.rating);
  }

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const fmtDuration = (ms) => {
    if (ms === null) return 'n/a';
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    return `${(mins / 60).toFixed(1)}h`;
  };

  const categoryLines = Object.entries(byCategory)
    .map(([id, count]) => `${getCategory(id)?.emoji || '🎫'} ${getCategory(id)?.label || id}: **${count}**`)
    .join('\n');

  const topStaff = leaderboard
    .slice(0, 3)
    .map(([userId, count], i) => `${['🥇', '🥈', '🥉'][i]} <@${userId}> (${count})`)
    .join('\n') || 'No claims yet';

  const avgRating = avg(ratings);

  embed.addFields(
    { name: 'Total Tickets', value: `${total}`, inline: true },
    { name: 'Avg. Claim Time', value: fmtDuration(avg(claimTimes)), inline: true },
    { name: 'Avg. Resolution Time', value: fmtDuration(avg(closeTimes)), inline: true },
    { name: 'Avg. Rating', value: avgRating ? `⭐ ${avgRating.toFixed(1)} / 5 (${ratings.length} ratings)` : 'No ratings yet', inline: false },
    { name: 'By Category', value: categoryLines || '—', inline: true },
    { name: 'Top Staff', value: topStaff, inline: true }
  );

  return embed;
}

// ---- /help (anyone) ----

function buildHelpEmbed() {
  const categoryLines = config.ticketCategories.map((c) => `${c.emoji} **${c.label}** — ${c.description}`).join('\n');
  return new EmbedBuilder()
    .setTitle(`❓ ${config.botName} — Help`)
    .setColor(config.embedColor)
    .setDescription(
      'Use the ticket panel to open a private channel with the team. Pick the category that fits best:\n\n' +
        `${categoryLines}\n\n` +
        "Once it's open, fill out the form and the right staff will jump in. You can have a limited number " +
        'of tickets open at once, so close old ones when you\'re done.'
    )
    .setFooter({ text: config.footerText });
}

// ---- /staffhelp (staff only) ----

function buildStaffHelpEmbed() {
  return new EmbedBuilder()
    .setTitle(`🛠️ ${config.botName} — Staff Commands`)
    .setColor(config.embedColor)
    .addFields(
      {
        name: 'In a ticket',
        value:
          '🙋 **Claim** button — take ownership of the ticket\n' +
          '🚦 **Urgency dropdown** — 🟢 Normal / 🟡 In Progress / 🔴 Urgent\n' +
          '🔒 **Close** button or `/close [reason]`\n' +
          '`/ticket-add @user` / `/ticket-remove @user` — bring someone in or out',
      },
      {
        name: 'Setup & staff management',
        value:
          '`/setupticket` — one-click setup (category, log channel, support role, panel)\n' +
          '`/addstaff @role or @user` / `/removestaff` — manage who counts as staff\n' +
          '`/blacklist add|remove @user` — block/unblock someone from opening tickets\n' +
          '`/cooldown-clear @user` — clear their post-close cooldown early',
      },
      {
        name: 'Reporting',
        value: '`/leaderboard` — top ticket claimers\n`/stats` — full stats dashboard',
      }
    )
    .setFooter({ text: config.footerText });
}

// ---- /setupticket confirmation ----

function buildSetupSummaryEmbed({ categoryId, logChannelId, supportRoleId, panelChannelId }) {
  return new EmbedBuilder()
    .setTitle('✅ VEX TICKET is set up')
    .setColor(config.embedColor)
    .addFields(
      { name: 'Ticket category', value: `<#${categoryId}>`, inline: true },
      { name: 'Log channel', value: `<#${logChannelId}>`, inline: true },
      { name: 'Support role', value: `<@&${supportRoleId}>`, inline: true },
      { name: 'Panel posted in', value: `<#${panelChannelId}>`, inline: true }
    )
    .setDescription('Use `/addstaff` to add more staff roles/members, or `/setupticket` again with new options to change any of this.')
    .setFooter({ text: config.footerText });
}

module.exports = {
  getCategory,
  getUrgency,
  buildPanel,
  buildModal,
  buildChannelName,
  buildTicketEmbed,
  buildTicketControls,
  buildChannelTopic,
  buildLeaderboardEmbed,
  buildArchiveControls,
  buildArchivedEmbed,
  buildRatingDM,
  buildStatsEmbed,
  buildHelpEmbed,
  buildStaffHelpEmbed,
  buildSetupSummaryEmbed,
};
