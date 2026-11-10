// All the "look and feel" knobs for VEX TICKET live here.
// Tweak labels/emojis/colors freely — the handlers read everything from this file.

module.exports = {
  botName: 'VEX TICKET',
  panelTitle: '⚡ VEX TICKET ⚡',
  panelDescription:
    "Need something from the GrimVex team? Pick a category below and we'll pull up a private channel just for you.\n\n" +
    '`🟢` Normal · `🟡` Being looked at · `🔴` Urgent — every ticket shows its status right in the channel name.',
  embedColor: 0x39ff6a, // neon green, matches the GrimVex server branding
  footerText: 'GrimVex_MC • VEX TICKET',

  // Each category = one option in the ticket panel's select menu + one modal.
  ticketCategories: [
    {
      id: 'general',
      label: 'General Support',
      emoji: '⚔️',
      description: 'Questions, bugs, anything else',
      color: 0x39ff6a,
      fields: [
        { id: 'issue', label: 'Describe your issue', style: 'Paragraph', placeholder: 'Tell us what\'s going on...', required: true },
      ],
    },
    {
      id: 'apply',
      label: 'Staff Application',
      emoji: '📝',
      description: 'Apply for a staff role',
      color: 0x5865f2,
      fields: [
        { id: 'ign', label: 'In-game name / Discord tag', style: 'Short', required: true },
        { id: 'age', label: 'Age', style: 'Short', required: true },
        { id: 'role', label: 'Role you\'re applying for', style: 'Short', required: true },
        { id: 'issue', label: 'Why should we pick you?', style: 'Paragraph', required: true },
      ],
    },
    {
      id: 'collab',
      label: 'Collab / Partnership',
      emoji: '🤝',
      description: 'Brand deals, YouTube/content collabs',
      color: 0xf5a623,
      fields: [
        { id: 'brand', label: 'Brand / Channel name', style: 'Short', required: true },
        { id: 'platform', label: 'Platform & follower/subscriber count', style: 'Short', required: true },
        { id: 'issue', label: 'What are you offering / proposing?', style: 'Paragraph', required: true },
      ],
    },
    {
      id: 'report',
      label: 'Report Player',
      emoji: '🚨',
      description: 'Report a rule-breaker or bug abuser',
      color: 0xed4245,
      fields: [
        { id: 'target', label: 'Who are you reporting?', style: 'Short', required: true },
        { id: 'issue', label: 'What happened? Include proof/links', style: 'Paragraph', required: true },
      ],
    },
  ],

  // The 3-stage urgency system. Changing the key order changes cycle order on the button.
  urgencyLevels: {
    normal: { emoji: '🟢', label: 'Normal', color: 0x57f287 },
    review: { emoji: '🟡', label: 'In Progress', color: 0xfee75c },
    urgent: { emoji: '🔴', label: 'Urgent', color: 0xed4245 },
  },
  defaultUrgency: 'normal',

  ticketCategoryChannelId: process.env.TICKET_CATEGORY_ID,
  supportRoleId: process.env.SUPPORT_ROLE_ID,
  logChannelId: process.env.LOG_CHANNEL_ID,

  // ---- Limits & automation (all in milliseconds unless noted) ----

  maxOpenTicketsPerUser: 2, // how many tickets one person can have open at once (any category)
  categoryOpenLimit: 15, // how many open tickets one category can have at once

  cooldownAfterCloseMs: 5 * 60 * 1000, // 5 min — wait time before the same user can open another ticket

  inactivityWarnMs: 12 * 60 * 60 * 1000, // 12h with no messages -> post a "closing soon" warning
  inactivityCloseMs: 24 * 60 * 60 * 1000, // 24h with no messages -> auto-close
  escalationUnclaimedMs: 30 * 60 * 1000, // 30 min unclaimed -> auto-bump to 🔴 Urgent
  archiveRetentionMs: 60 * 60 * 1000, // 1h after close -> permanently delete (unless reopened)
  schedulerIntervalMs: 5 * 60 * 1000, // how often the background check runs

  transcriptsEnabled: true,
  ratingDmEnabled: true,
};
