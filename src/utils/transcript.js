const fs = require('fs');
const path = require('path');
const os = require('os');

// Pulls up to `limit` messages (oldest first) and writes them to a temp .txt file.
// Returns the file path, or null if there was nothing to write / it's disabled.
async function generateTranscript(channel, limit = 500) {
  const collected = [];
  let before;

  while (collected.length < limit) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    collected.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }

  if (!collected.length) return null;

  collected.reverse(); // oldest first

  const lines = collected.map((m) => {
    const time = new Date(m.createdTimestamp).toISOString().replace('T', ' ').slice(0, 19);
    const author = `${m.author.tag} (${m.author.id})`;
    const content = m.content || '[embed/attachment/component]';
    const attachments = m.attachments.size
      ? '\n  attachments: ' + [...m.attachments.values()].map((a) => a.url).join(', ')
      : '';
    return `[${time}] ${author}: ${content}${attachments}`;
  });

  const header = `Transcript for #${channel.name} (${channel.id})\nGenerated: ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`;
  const filePath = path.join(os.tmpdir(), `transcript-${channel.id}-${Date.now()}.txt`);
  fs.writeFileSync(filePath, header + lines.join('\n'));
  return filePath;
}

module.exports = { generateTranscript };
