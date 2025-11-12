const database = require('./database');

// Simple cache for guild data: Map<guildId, {data, timestamp}>
const guildCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached guild data or fetch from database
 * @param {string} guildId - The guild ID
 * @returns {Object|null} Guild data
 */
async function getCachedGuildData(guildId) {
  const cached = guildCache.get(guildId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const data = await database.getGuild(guildId);
  if (data) {
    guildCache.set(guildId, { data, timestamp: Date.now() });
  }
  return data;
}

/**
 * Get the log channel for a specific type from guild data
 * @param {Guild} guild - The Discord guild
 * @param {string} typeKey - The log type key (e.g., 'members', 'message')
 * @returns {TextChannel|null} The log channel or null
 */
async function getLogChannel(guild, typeKey) {
  try {
    const guildData = await getCachedGuildData(guild.id);
    if (!guildData) {
      console.warn(`Logger: No guild data found for guild ${guild.id}`);
      return null;
    }
    const perTypeId = guildData.logChannels?.[typeKey];
    const fallbackId = guildData.logChannelId;
    const targetId = perTypeId || fallbackId;
    if (!targetId) {
      console.warn(`Logger: No log channel configured for type ${typeKey} in guild ${guild.id}`);
      return null;
    }
    const channel = guild.channels.cache.get(targetId);
    if (!channel) {
      console.warn(`Logger: Log channel ${targetId} not found in guild ${guild.id}`);
      return null;
    }
    return channel;
  } catch (error) {
    console.error(`Logger: Error getting log channel for guild ${guild.id}, type ${typeKey}:`, error);
    return null;
  }
}

/**
 * Send a log embed to the appropriate channel if logging is enabled
 * @param {Guild} guild - The Discord guild
 * @param {EmbedBuilder} embed - The embed to send
 * @param {string} categoryKey - The log category key (e.g., 'members', 'message')
 */
async function sendLog(guild, embed, categoryKey) {
  try {
    const guildData = await getCachedGuildData(guild.id);
    if (!guildData?.logs?.[categoryKey]) {
      return; // Logging not enabled for this category
    }
    const logChannel = await getLogChannel(guild, categoryKey);
    if (!logChannel) {
      return;
    }
    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error(`Logger: Error sending log for guild ${guild.id}, category ${categoryKey}:`, error);
  }
}

/**
 * Truncate text to a maximum length, adding ellipsis if truncated
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 1024) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

module.exports = {
  getLogChannel,
  sendLog,
  truncateText,
};