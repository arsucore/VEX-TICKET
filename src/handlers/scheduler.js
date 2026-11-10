const config = require('../config');
const db = require('../utils/db');
const tb = require('../utils/ticketBuilder');

// Exported so interactionCreate.js can reuse the exact same close logic the scheduler uses.
async function closeTicketChannel(client, channelId, { closedBy, reason }) {
  const ticket = db.getTicket(channelId);
  if (!ticket || ticket.status !== 'open') return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    db.deleteTicket(channelId);
    return;
  }

  const settings = db.getSettings();

  // Transcript -> log channel
  if (config.transcriptsEnabled && settings.logChannelId) {
    const { generateTranscript } = require('../utils/transcript');
    const filePath = await generateTranscript(channel).catch(() => null);
    const logChannel = await client.channels.fetch(settings.logChannelId).catch(() => null);
    if (logChannel) {
      const category = tb.getCategory(ticket.categoryId);
      await logChannel
        .send({
          content:
            `🔒 **Ticket Closed** — #${ticket.ticketNumber} (${category.emoji} ${category.label})\n` +
            `Opened by: <@${ticket.opener}> | Claimed by: ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'nobody'} | ` +
            `Closed by: ${closedBy === 'system' ? 'Auto-close (inactivity)' : `<@${closedBy}>`}${reason ? ` — ${reason}` : ''}`,
          files: filePath ? [filePath] : [],
        })
        .catch(() => {});
    }
  }

  const now = Date.now();
  db.addHistory({
    ticketNumber: ticket.ticketNumber,
    categoryId: ticket.categoryId,
    opener: ticket.opener,
    claimedBy: ticket.claimedBy,
    createdAt: ticket.createdAt,
    claimedAt: ticket.claimedAt || null,
    closedAt: now,
    rating: null,
  });

  db.setCooldownUntil(ticket.opener, now + config.cooldownAfterCloseMs);

  // Rating DM
  if (config.ratingDmEnabled) {
    const opener = await client.users.fetch(ticket.opener).catch(() => null);
    if (opener) {
      await opener.send(tb.buildRatingDM(ticket.ticketNumber)).catch(() => {});
    }
  }

  // Archive: lock it down but don't delete yet, so staff can reopen if needed
  const deleteAt = now + config.archiveRetentionMs;
  db.saveTicket(channelId, { status: 'archived', closedAt: now, deleteAt, closedBy, closeReason: reason || null });

  await channel.permissionOverwrites.edit(ticket.opener, { SendMessages: false }).catch(() => {});
  if (ticket.claimedBy) {
    await channel.permissionOverwrites.edit(ticket.claimedBy, { SendMessages: false }).catch(() => {});
  }
  await channel
    .send({
      embeds: [tb.buildArchivedEmbed({ closedBy, reason, ticketNumber: ticket.ticketNumber, deleteAt })],
      components: tb.buildArchiveControls(),
    })
    .catch(() => {});
}

function startScheduler(client) {
  setInterval(() => runCheck(client).catch((e) => console.error('Scheduler error:', e)), config.schedulerIntervalMs);
}

async function runCheck(client) {
  const tickets = db.getAllTickets();
  const now = Date.now();

  for (const [channelId, ticket] of Object.entries(tickets)) {
    if (ticket.status === 'open') {
      // Escalate unclaimed tickets
      if (!ticket.claimedBy && ticket.urgencyKey !== 'urgent' && now - ticket.createdAt > config.escalationUnclaimedMs) {
        await escalate(client, channelId, ticket);
        continue;
      }

      // Inactivity warn
      const lastActivity = ticket.lastActivityAt || ticket.createdAt;
      if (!ticket.inactivityWarned && now - lastActivity > config.inactivityWarnMs) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) {
          await channel
            .send('⏰ This ticket has been quiet for a while — it will auto-close if there\'s no activity soon.')
            .catch(() => {});
        }
        db.saveTicket(channelId, { inactivityWarned: true });
      }

      // Inactivity auto-close
      if (now - lastActivity > config.inactivityCloseMs) {
        await closeTicketChannel(client, channelId, { closedBy: 'system', reason: 'Auto-closed due to inactivity' });
      }
    } else if (ticket.status === 'archived' && ticket.deleteAt && now > ticket.deleteAt) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (channel) await channel.delete().catch(() => {});
      db.deleteTicket(channelId);
    }
  }
}

async function escalate(client, channelId, ticket) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const updated = db.saveTicket(channelId, { urgencyKey: 'urgent' });
  const username = (await channel.guild.members.fetch(ticket.opener).catch(() => null))?.user.username || 'user';
  const newName = tb.buildChannelName({ urgencyKey: 'urgent', categoryId: ticket.categoryId, username });

  await channel.setName(newName).catch(() => {});
  await channel.setTopic(tb.buildChannelTopic(updated)).catch(() => {});
  const settings = db.getSettings();
  await channel
    .send(
      `${settings.supportRoleId ? `<@&${settings.supportRoleId}> ` : ''}🔴 This ticket has gone unclaimed for a while and was auto-escalated to **Urgent**.`
    )
    .catch(() => {});

  if (ticket.embedMessageId) {
    const msg = await channel.messages.fetch(ticket.embedMessageId).catch(() => null);
    if (msg) {
      await msg
        .edit({
          embeds: [tb.buildTicketEmbed({ ...updated })],
          components: tb.buildTicketControls({ claimedBy: updated.claimedBy }),
        })
        .catch(() => {});
    }
  }
}

module.exports = { startScheduler, closeTicketChannel };
