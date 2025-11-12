const { Client, GatewayIntentBits, Collection, Partials } = require("discord.js");
const fs = require("fs");
const path = require("path");
const database = require("./utils/database");
const ReminderScheduler = require("./utils/reminderScheduler");
require("./server.js");

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildEmojisAndStickers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.Reaction],
});

// Create a collection for commands
client.commands = new Collection();

// Initialize reminder scheduler
const reminderScheduler = new ReminderScheduler(client);

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(
            `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
        );
    }
}

// Load events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Initialize database connection
async function initializeBot() {
    try {
        // Initialize MongoDB
        await database.init();
        console.log("Database connection established");

        // Login to Discord
        const token = process.env.DISCORD_TOKEN || "your_bot_token_here";
        await client.login(token);
        console.log("Bot logged in successfully");

        // Start reminder scheduler
        reminderScheduler.start();
        console.log("Reminder scheduler started");
    } catch (error) {
        console.error("Failed to initialize bot:", error);
        process.exit(1);
    }
}

// Error handling
process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    process.exit(1);
});

// Start the bot
initializeBot();

// Auto-role assignment on member join
const configPath = path.join(__dirname, 'data/config.json');

client.on('guildMemberAdd', async (member) => {
    const guildId = member.guild.id;
    let guildData = await database.getGuild(guildId);
    // Auto-role assignment
    if (guildData && guildData.autoRoleId) {
        const role = member.guild.roles.cache.get(guildData.autoRoleId);
        if (role && !member.user.bot && !member.roles.cache.has(role.id)) {
            try {
                await member.roles.add(role, 'Auto-role on join');
            } catch (e) {}
        }
    }
    // Onboarding tagging
    if (guildData && guildData.onboardConfig && guildData.onboardConfig.channelId) {
        const channel = member.guild.channels.cache.get(guildData.onboardConfig.channelId);
        const seconds = guildData.onboardConfig.seconds || 3;
        let message = guildData.onboardConfig.message || '{user}';
        message = message.replace('{user}', `${member}`);
        if (channel && channel.isTextBased()) {
            try {
                const msg = await channel.send({ content: message });
                setTimeout(() => {
                    msg.delete().catch(() => {});
                }, seconds * 1000);
            } catch (e) {}
        }
    }
});
