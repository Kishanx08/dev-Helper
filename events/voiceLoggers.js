const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'voiceLoggers',
  once: false,
  async execute(client) {
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      try {
        const guild = newState.guild || oldState.guild;
        if (!guild) return;
        const member = newState.member || oldState.member;

        let action = null;
        let channelText = '';

        if (!oldState.channelId && newState.channelId) {
          action = 'Joined VC';
          channelText = `${newState.channel}`;
        } else if (oldState.channelId && !newState.channelId) {
          action = 'Left VC';
          channelText = `${oldState.channel}`;
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
          action = 'Switched VC';
          channelText = `${oldState.channel} ➜ ${newState.channel}`;
        }

        if (!action) return;

        const embed = new EmbedBuilder()
          .setTitle(action)
          .setDescription(`${member.user.tag} (${member.id})`)
          .addFields(
            { name: 'Channel', value: channelText },
            { name: 'Time', value: `<t:${Math.floor(Date.now()/1000)}:f>` }
          )
          .setColor(0x00CED1)
          .setTimestamp();
        await sendLog(guild, embed, 'voice');
      } catch (error) {
        console.error('Error in VoiceStateUpdate logger:', error);
      }
    });
  }
};

