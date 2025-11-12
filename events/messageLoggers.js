const { Events, EmbedBuilder } = require('discord.js');
const audit = require('../utils/audit');
const { sendLog, truncateText } = require('../utils/logger');

module.exports = {
  name: 'messageLoggers',
  once: false,
  async execute(client) {
    client.on(Events.MessageDelete, async (message) => {
      try {
        if (!message.guild || message.author?.bot) return;
        const executor = await audit.findMessageDeleteExecutor(message.guild, message.author?.id, message.channel?.id);
        const embed = new EmbedBuilder()
          .setTitle('Message Deleted')
          .setDescription(message.content ? truncateText(message.content, 2048) : '(no content)')
          .addFields(
            { name: 'Author', value: message.author ? `${message.author.tag} (${message.author.id})` : 'Unknown', inline: false },
            { name: 'Channel', value: `${message.channel}`, inline: false },
            { name: 'Deleted By', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unknown', inline: false },
            { name: 'Time', value: `<t:${Math.floor(Date.now()/1000)}:f>`, inline: false },
          )
          .setColor(0xFF0000)
          .setTimestamp();
        await sendLog(message.guild, embed, 'message');
      } catch (error) {
        console.error('Error in MessageDelete logger:', error);
      }
    });

    client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
      try {
        if (!newMsg.guild || newMsg.author?.bot) return;
        const before = oldMsg?.content || '(unknown)';
        const after = newMsg?.content || '(unknown)';
        if (before === after) return;
        const embed = new EmbedBuilder()
          .setTitle('Message Edited')
          .addFields(
            { name: 'Author', value: `${newMsg.author.tag} (${newMsg.author.id})`, inline: false },
            { name: 'Channel', value: `${newMsg.channel}`, inline: false },
            { name: 'Before', value: truncateText(before) || '(empty)', inline: false },
            { name: 'After', value: truncateText(after) || '(empty)', inline: false },
            { name: 'Edited At', value: `<t:${Math.floor(Date.now()/1000)}:f>`, inline: false },
          )
          .setColor(0xFFA500)
          .setTimestamp();
        await sendLog(newMsg.guild, embed, 'message');
      } catch (error) {
        console.error('Error in MessageUpdate logger:', error);
      }
    });

    client.on(Events.MessageReactionAdd, async (reaction, user) => {
      try {
        if (user.bot) return;
        const embed = new EmbedBuilder()
          .setTitle('Reaction Added')
          .setDescription(`${user.tag} reacted with ${reaction.emoji} to [message](${reaction.message.url})`)
          .addFields(
            { name: 'Channel', value: `${reaction.message.channel}`, inline: true },
            { name: 'Message Author', value: reaction.message.author ? `${reaction.message.author.tag}` : 'Unknown', inline: true }
          )
          .setColor(0xFFD700)
          .setTimestamp();
        await sendLog(reaction.message.guild, embed, 'message');
      } catch (error) {
        console.error('Error in MessageReactionAdd logger:', error);
      }
    });

    client.on(Events.MessageReactionRemove, async (reaction, user) => {
      try {
        if (user.bot) return;
        const embed = new EmbedBuilder()
          .setTitle('Reaction Removed')
          .setDescription(`${user.tag} removed reaction ${reaction.emoji} from [message](${reaction.message.url})`)
          .addFields(
            { name: 'Channel', value: `${reaction.message.channel}`, inline: true },
            { name: 'Message Author', value: reaction.message.author ? `${reaction.message.author.tag}` : 'Unknown', inline: true }
          )
          .setColor(0xFF6347)
          .setTimestamp();
        await sendLog(reaction.message.guild, embed, 'message');
      } catch (error) {
        console.error('Error in MessageReactionRemove logger:', error);
      }
    });
  }
};

