const { PermissionFlagsBits } = require('discord.js');
const db = require('./db');

// "Staff" = has Manage Server, OR holds the configured support role / any /addstaff role,
// OR was individually added with /addstaff.
function isStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;

  const settings = db.getSettings();
  if (settings.supportRoleId && member.roles.cache.has(settings.supportRoleId)) return true;
  if (settings.staffRoleIds.some((id) => member.roles.cache.has(id))) return true;
  if (settings.staffUserIds.includes(member.id)) return true;

  return false;
}

module.exports = { isStaff };
