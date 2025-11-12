const { Events, EmbedBuilder } = require('discord.js');
const audit = require('../utils/audit');
const { sendLog, truncateText } = require('../utils/logger');

module.exports = {
  name: 'guildLoggers',
  once: false,
  async execute(client) {

    client.on(Events.GuildMemberAdd, async (member) => {
      try {
        const embed = new EmbedBuilder()
          .setTitle('Member Joined')
          .setDescription(`${member.user.tag} (${member.id}) joined the server.`)
          .addFields({ name: 'Joined At', value: `<t:${Math.floor(Date.now()/1000)}:f>` })
          .setColor(0x00FF00)
          .setTimestamp();
        await sendLog(member.guild, embed, 'members');
      } catch (error) {
        console.error('Error in GuildMemberAdd logger:', error);
      }
    });

    client.on(Events.GuildMemberRemove, async (member) => {
      try {
        const extra = await audit.findMemberRemoveExecutor(member.guild, member.id);
        const embed = new EmbedBuilder()
          .setTitle('Member Left')
          .setDescription(`${member.user.tag} (${member.id}) left the server.`)
          .addFields(
            { name: 'Time', value: `<t:${Math.floor(Date.now()/1000)}:f>` },
            { name: 'Reason', value: extra ? (extra.action === 'kick' ? 'Kicked' : 'Banned') : 'Left or unknown' },
            { name: 'By', value: extra?.executor ? `${extra.executor.tag} (${extra.executor.id})` : 'Unknown' }
          )
          .setColor(0xFF0000)
          .setTimestamp();
        await sendLog(member.guild, embed, 'members');
      } catch (error) {
        console.error('Error in GuildMemberRemove logger:', error);
      }
    });

    client.on(Events.ChannelCreate, async (channel) => {
      try {
        if (!channel.guild) return;
        const executor = await audit.findChannelActionExecutor(channel.guild, audit.AuditLogEvent.ChannelCreate, channel.id);
        const embed = new EmbedBuilder()
          .setTitle('Channel Created')
          .setDescription(`${channel} (${channel.id})`)
          .addFields({ name: 'Created By', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unknown' })
          .setColor(0x00BFFF)
          .setTimestamp();
        await sendLog(channel.guild, embed, 'channels');
      } catch (error) {
        console.error('Error in ChannelCreate logger:', error);
      }
    });

    client.on(Events.ChannelDelete, async (channel) => {
      try {
        if (!channel.guild) return;
        const executor = await audit.findChannelActionExecutor(channel.guild, audit.AuditLogEvent.ChannelDelete, channel.id);
        const embed = new EmbedBuilder()
          .setTitle('Channel Deleted')
          .setDescription(`${channel.name || 'Unknown'} (${channel.id})`)
          .addFields({ name: 'Deleted By', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unknown' })
          .setColor(0x1E90FF)
          .setTimestamp();
        await sendLog(channel.guild, embed, 'channels');
      } catch (error) {
        console.error('Error in ChannelDelete logger:', error);
      }
    });

    client.on(Events.GuildRoleCreate, async (role) => {
      try {
        const executor = await audit.findRoleActionExecutor(role.guild, audit.AuditLogEvent.RoleCreate, role.id);
        const embed = new EmbedBuilder()
          .setTitle('Role Created')
          .setDescription(`${role.name} (${role.id})`)
          .addFields({ name: 'Created By', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unknown' })
          .setColor(0x8A2BE2)
          .setTimestamp();
        await sendLog(role.guild, embed, 'roles');
      } catch (error) {
        console.error('Error in GuildRoleCreate logger:', error);
      }
    });

    client.on(Events.GuildRoleDelete, async (role) => {
      try {
        const executor = await audit.findRoleActionExecutor(role.guild, audit.AuditLogEvent.RoleDelete, role.id);
        const embed = new EmbedBuilder()
          .setTitle('Role Deleted')
          .setDescription(`${role.name} (${role.id})`)
          .addFields({ name: 'Deleted By', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unknown' })
          .setColor(0x9932CC)
          .setTimestamp();
        await sendLog(role.guild, embed, 'roles');
      } catch (error) {
        console.error('Error in GuildRoleDelete logger:', error);
      }
    });

    client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
      try {
        const guild = newRole.guild;
        const executor = await audit.findRoleActionExecutor(guild, audit.AuditLogEvent.RoleUpdate, newRole.id);

        const changes = [];
        if (oldRole.name !== newRole.name) {
          changes.push({ name: 'Name', value: `"${oldRole.name}" ➜ "${newRole.name}"` });
        }

        const oldPerms = new Set(oldRole.permissions.toArray());
        const newPerms = new Set(newRole.permissions.toArray());
        const addedPerms = [...newPerms].filter(p => !oldPerms.has(p));
        const removedPerms = [...oldPerms].filter(p => !newPerms.has(p));

        if (addedPerms.length > 0) {
          changes.push({ name: 'Permissions Added', value: truncateText(addedPerms.map(p => `+ ${p}`).join('\n')) });
        }
        if (removedPerms.length > 0) {
          changes.push({ name: 'Permissions Removed', value: truncateText(removedPerms.map(p => `- ${p}`).join('\n')) });
        }

        if (changes.length === 0) return; // nothing notable

        const embed = new EmbedBuilder()
          .setTitle('Role Updated')
          .setDescription(`${newRole.name} (${newRole.id})`)
          .addFields(
            ...changes,
            { name: 'Updated By', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unknown' },
            { name: 'Time', value: `<t:${Math.floor(Date.now()/1000)}:f>` }
          )
          .setColor(0xFFD700)
          .setTimestamp();
        await sendLog(guild, embed, 'roles');
      } catch (error) {
        console.error('Error in GuildRoleUpdate logger:', error);
      }
    });

    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
      try {
        const guild = newMember.guild;
        const changes = [];

        // Check nickname changes
        if (oldMember.nickname !== newMember.nickname) {
          changes.push({
            name: 'Nickname',
            value: `"${oldMember.nickname || 'None'}" ➜ "${newMember.nickname || 'None'}"`
          });
        }

        // Check role changes
        const oldRoleIds = new Set(oldMember.roles.cache.map(r => r.id));
        const newRoleIds = new Set(newMember.roles.cache.map(r => r.id));
        const added = [...newRoleIds].filter(id => !oldRoleIds.has(id));
        const removed = [...oldRoleIds].filter(id => !newRoleIds.has(id));

        if (added.length > 0) {
          changes.push({ name: 'Roles Added', value: added.map(id => `<@&${id}>`).join(', ') });
        }
        if (removed.length > 0) {
          changes.push({ name: 'Roles Removed', value: removed.map(id => `<@&${id}>`).join(', ') });
        }

        if (changes.length === 0) return;

        const executor = await audit.findMemberUpdateExecutor(guild, newMember.id);

        const embed = new EmbedBuilder()
          .setTitle('Member Updated')
          .setDescription(`${newMember.user.tag} (${newMember.id})`)
          .addFields(
            ...changes,
            { name: 'Updated By', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unknown' },
            { name: 'Time', value: `<t:${Math.floor(Date.now()/1000)}:f>` }
          )
          .setColor(0x20B2AA)
          .setTimestamp();
        // Route to members category for general updates
        await sendLog(guild, embed, 'members');
      } catch (error) {
        console.error('Error in GuildMemberUpdate logger:', error);
      }
    });

    client.on(Events.InviteCreate, async (invite) => {
      try {
        const embed = new EmbedBuilder()
          .setTitle('Invite Created')
          .setDescription(`Invite code: ${invite.code}`)
          .addFields(
            { name: 'Channel', value: `${invite.channel}`, inline: true },
            { name: 'Max Uses', value: invite.maxUses ? invite.maxUses.toString() : 'Unlimited', inline: true },
            { name: 'Expires', value: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime()/1000)}:R>` : 'Never', inline: true },
            { name: 'Created By', value: `<@${invite.inviter.id}> (${invite.inviter.tag})` }
          )
          .setColor(0x32CD32)
          .setTimestamp();
        await sendLog(invite.guild, embed, 'invites');
      } catch (error) {
        console.error('Error in InviteCreate logger:', error);
      }
    });

    client.on(Events.InviteDelete, async (invite) => {
      try {
        const embed = new EmbedBuilder()
          .setTitle('Invite Deleted')
          .setDescription(`Invite code: ${invite.code}`)
          .addFields(
            { name: 'Channel', value: `${invite.channel}`, inline: true },
            { name: 'Deleted By', value: 'Unknown (audit logs may show)' } // Could add audit if needed
          )
          .setColor(0xDC143C)
          .setTimestamp();
        await sendLog(invite.guild, embed, 'invites');
      } catch (error) {
        console.error('Error in InviteDelete logger:', error);
      }
    });

    client.on(Events.GuildEmojiCreate, async (emoji) => {
      try {
        const embed = new EmbedBuilder()
          .setTitle('Emoji Created')
          .setDescription(`${emoji} (${emoji.name})`)
          .addFields({ name: 'Animated', value: emoji.animated ? 'Yes' : 'No', inline: true })
          .setColor(0xFFD700)
          .setTimestamp();
        await sendLog(emoji.guild, embed, 'emojis');
      } catch (error) {
        console.error('Error in GuildEmojiCreate logger:', error);
      }
    });

    client.on(Events.GuildEmojiDelete, async (emoji) => {
      try {
        const embed = new EmbedBuilder()
          .setTitle('Emoji Deleted')
          .setDescription(`${emoji.name} (${emoji.id})`)
          .addFields({ name: 'Animated', value: emoji.animated ? 'Yes' : 'No', inline: true })
          .setColor(0xFF6347)
          .setTimestamp();
        await sendLog(emoji.guild, embed, 'emojis');
      } catch (error) {
        console.error('Error in GuildEmojiDelete logger:', error);
      }
    });

    client.on(Events.GuildBanAdd, async (ban) => {
      try {
        const embed = new EmbedBuilder()
          .setTitle('Member Banned')
          .setDescription(`${ban.user.tag} (${ban.user.id})`)
          .addFields(
            { name: 'Reason', value: ban.reason || 'No reason provided' },
            { name: 'Banned At', value: `<t:${Math.floor(Date.now()/1000)}:f>` }
          )
          .setColor(0x8B0000)
          .setTimestamp();
        await sendLog(ban.guild, embed, 'members');
      } catch (error) {
        console.error('Error in GuildBanAdd logger:', error);
      }
    });

    client.on(Events.GuildBanRemove, async (ban) => {
      try {
        const embed = new EmbedBuilder()
          .setTitle('Member Unbanned')
          .setDescription(`${ban.user.tag} (${ban.user.id})`)
          .addFields({ name: 'Unbanned At', value: `<t:${Math.floor(Date.now()/1000)}:f>` })
          .setColor(0x32CD32)
          .setTimestamp();
        await sendLog(ban.guild, embed, 'members');
      } catch (error) {
        console.error('Error in GuildBanRemove logger:', error);
      }
    });

    client.on(Events.ThreadCreate, async (thread) => {
      try {
        const embed = new EmbedBuilder()
          .setTitle('Thread Created')
          .setDescription(`${thread} (${thread.id})`)
          .addFields(
            { name: 'Parent Channel', value: `${thread.parent}`, inline: true },
            { name: 'Created By', value: thread.ownerId ? `<@${thread.ownerId}>` : 'Unknown', inline: true }
          )
          .setColor(0x00CED1)
          .setTimestamp();
        await sendLog(thread.guild, embed, 'channels');
      } catch (error) {
        console.error('Error in ThreadCreate logger:', error);
      }
    });

    client.on(Events.ThreadDelete, async (thread) => {
      try {
        const embed = new EmbedBuilder()
          .setTitle('Thread Deleted')
          .setDescription(`${thread.name} (${thread.id})`)
          .addFields({ name: 'Parent Channel', value: `${thread.parent}`, inline: true })
          .setColor(0xDC143C)
          .setTimestamp();
        await sendLog(thread.guild, embed, 'channels');
      } catch (error) {
        console.error('Error in ThreadDelete logger:', error);
      }
    });
  }
};

