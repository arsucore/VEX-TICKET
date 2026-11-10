// Lightweight JSON-file "database". Good enough for a single-process ticket bot.
// Swap this out for SQLite/Mongo later without touching any handler code,
// as long as you keep the same function names/shapes.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'db.json');

const EMPTY_DB = { tickets: {}, leaderboard: {}, history: [], blacklist: [], cooldowns: {}, settings: {}, counter: 0 };

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY_DB, null, 2));
  }
}

function readDb() {
  ensureDb();
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  // Fill in any keys added by later versions of the bot
  return { ...EMPTY_DB, ...data };
}

function writeDb(data) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ---- Tickets ----

function nextTicketNumber() {
  const db = readDb();
  db.counter += 1;
  writeDb(db);
  return db.counter;
}

function saveTicket(channelId, ticket) {
  const db = readDb();
  db.tickets[channelId] = { ...db.tickets[channelId], ...ticket };
  writeDb(db);
  return db.tickets[channelId];
}

function getTicket(channelId) {
  const db = readDb();
  return db.tickets[channelId] || null;
}

function deleteTicket(channelId) {
  const db = readDb();
  delete db.tickets[channelId];
  writeDb(db);
}

function getAllTickets() {
  return readDb().tickets;
}

function countOpenTicketsByUser(userId) {
  const tickets = getAllTickets();
  return Object.values(tickets).filter((t) => t.opener === userId && t.status === 'open').length;
}

function countOpenTicketsByCategory(categoryId) {
  const tickets = getAllTickets();
  return Object.values(tickets).filter((t) => t.categoryId === categoryId && t.status === 'open').length;
}

// ---- Leaderboard ----

function addClaim(userId) {
  const db = readDb();
  db.leaderboard[userId] = (db.leaderboard[userId] || 0) + 1;
  writeDb(db);
  return db.leaderboard[userId];
}

function getLeaderboard(limit = 10) {
  const db = readDb();
  return Object.entries(db.leaderboard)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

// ---- History (used for /stats and ratings; survives ticket channel deletion) ----

function addHistory(entry) {
  const db = readDb();
  db.history.push(entry);
  if (db.history.length > 5000) db.history = db.history.slice(-5000); // keep the file from growing forever
  writeDb(db);
}

function getHistory() {
  return readDb().history;
}

function setRating(ticketNumber, rating) {
  const db = readDb();
  const entry = db.history.find((h) => h.ticketNumber === ticketNumber);
  if (entry) entry.rating = rating;
  writeDb(db);
  return !!entry;
}

// ---- Blacklist ----

function isBlacklisted(userId) {
  return readDb().blacklist.includes(userId);
}

function addBlacklist(userId) {
  const db = readDb();
  if (!db.blacklist.includes(userId)) db.blacklist.push(userId);
  writeDb(db);
}

function removeBlacklist(userId) {
  const db = readDb();
  db.blacklist = db.blacklist.filter((id) => id !== userId);
  writeDb(db);
}

// ---- Cooldowns ----

function getCooldownUntil(userId) {
  return readDb().cooldowns[userId] || 0;
}

function setCooldownUntil(userId, timestamp) {
  const db = readDb();
  db.cooldowns[userId] = timestamp;
  writeDb(db);
}

function clearCooldown(userId) {
  const db = readDb();
  delete db.cooldowns[userId];
  writeDb(db);
}

// ---- Settings (editable at runtime via /setupticket, /addstaff, /removestaff — no redeploy needed) ----
// Falls back to .env values until someone sets them with a command, so nothing breaks on first run.

function getSettings() {
  const db = readDb();
  return {
    ticketCategoryId: db.settings.ticketCategoryId || process.env.TICKET_CATEGORY_ID || null,
    logChannelId: db.settings.logChannelId || process.env.LOG_CHANNEL_ID || null,
    supportRoleId: db.settings.supportRoleId || process.env.SUPPORT_ROLE_ID || null,
    staffRoleIds: db.settings.staffRoleIds || [],
    staffUserIds: db.settings.staffUserIds || [],
  };
}

function updateSettings(patch) {
  const database = readDb();
  database.settings = { ...database.settings, ...patch };
  writeDb(database);
  return database.settings;
}

module.exports = {
  nextTicketNumber,
  saveTicket,
  getTicket,
  deleteTicket,
  getAllTickets,
  countOpenTicketsByUser,
  countOpenTicketsByCategory,
  addClaim,
  getLeaderboard,
  addHistory,
  getHistory,
  setRating,
  isBlacklisted,
  addBlacklist,
  removeBlacklist,
  getCooldownUntil,
  setCooldownUntil,
  clearCooldown,
  getSettings,
  updateSettings,
};
