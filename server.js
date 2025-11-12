const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const path = require("path");
const database = require("./utils/database");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Discord OAuth Strategy
passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/auth/discord/callback',
    scope: ['identify', 'guilds']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Store user info
        const user = {
            id: profile.id,
            username: profile.username,
            discriminator: profile.discriminator,
            avatar: profile.avatar,
            guilds: profile.guilds
        };
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Routes
app.get("/", (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/dashboard');
    } else {
        res.render('index', { user: req.user });
    }
});

// Auth routes
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/dashboard');
    }
);

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// Dashboard
app.get('/dashboard', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }
    res.render('dashboard', { user: req.user });
});

// Guild configuration page
app.get('/guild/:guildId', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }

    const { guildId } = req.params;

    // Check if user has permission for this guild
    const userGuild = req.user.guilds.find(g => g.id === guildId);
    if (!userGuild || (userGuild.permissions & 0x8) !== 0x8) {
        return res.status(403).render('error', { message: 'You do not have permission to manage this server.' });
    }

    try {
        const guildData = await database.getGuild(guildId) || {};
        res.render('guild-config', { user: req.user, guild: userGuild, config: guildData });
    } catch (error) {
        console.error('Error loading guild config:', error);
        res.status(500).render('error', { message: 'Error loading server configuration.' });
    }
});

// API routes
app.get('/api/user/guilds', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        // Get user's guilds from Discord API (stored in session)
        const userGuilds = req.user.guilds || [];

        // Filter guilds where user has admin permissions
        const adminGuilds = userGuilds.filter(guild =>
            (guild.permissions & 0x8) === 0x8 // ADMINISTRATOR permission
        );

        // Get additional info from database if needed
        const enrichedGuilds = await Promise.all(adminGuilds.map(async (guild) => {
            const guildData = await database.getGuild(guild.id);
            return {
                ...guild,
                configured: !!guildData
            };
        }));

        res.json(enrichedGuilds);
    } catch (error) {
        console.error('Error fetching user guilds:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save guild configuration
app.post('/api/guild/:guildId/config', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { guildId } = req.params;
    const configData = req.body;

    // Check if user has permission for this guild
    const userGuild = req.user.guilds.find(g => g.id === guildId);
    if (!userGuild || (userGuild.permissions & 0x8) !== 0x8) {
        return res.status(403).json({ error: 'No permission' });
    }

    try {
        // Remove guildId from config data
        delete configData.guildId;

        // Save to database
        const savedConfig = await database.saveGuild({
            _id: guildId,
            ...configData,
            updatedAt: new Date()
        });

        res.json({ success: true, config: savedConfig });
    } catch (error) {
        console.error('Error saving guild config:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`🌐 Web server running at http://localhost:${port}`);
});
