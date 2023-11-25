const fs = require('node:fs');
const path = require('node:path');
const { token } = require('./config.json');
const Sequelize = require('sequelize');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Establish DB connection
const sequelize = new Sequelize({
	dialect: 'sqlite',
	logging: false,
	storage: './data/database.sqlite',
});

// Create tables models
const dbPendingRecords = sequelize.define('pendingRecords', {
	username: Sequelize.STRING,
	submitter: Sequelize.STRING,
	levelname: Sequelize.STRING,
	fps: Sequelize.INTEGER,
	device: Sequelize.STRING,
	completionlink: Sequelize.STRING,
	raw: Sequelize.STRING,
	ldm: Sequelize.INTEGER,
	additionalnotes: Sequelize.STRING,
	discordid: {
		type: Sequelize.STRING,
		unique: true,
	},
	embedDiscordid: {
		type: Sequelize.STRING,
	},
	priority: Sequelize.BOOLEAN,
});

const dbAcceptedRecords = sequelize.define('acceptedRecords', {
	username: Sequelize.STRING,
	submitter: Sequelize.STRING,
	levelname: Sequelize.STRING,
	fps: Sequelize.INTEGER,
	device: Sequelize.STRING,
	completionlink: Sequelize.STRING,
	raw: Sequelize.STRING,
	ldm: Sequelize.INTEGER,
	additionalnotes: Sequelize.STRING,
	priority: Sequelize.BOOLEAN,
	moderator: Sequelize.STRING,
});

const dbDeniedRecords = sequelize.define('deniedRecords', {
	username: Sequelize.STRING,
	submitter: Sequelize.STRING,
	levelname: Sequelize.STRING,
	fps: Sequelize.INTEGER,
	device: Sequelize.STRING,
	completionlink: Sequelize.STRING,
	raw: Sequelize.STRING,
	ldm: Sequelize.INTEGER,
	additionalnotes: Sequelize.STRING,
	discordid: {
		type: Sequelize.STRING,
		unique: true,
	},
	priority: Sequelize.BOOLEAN,
	denyReason: Sequelize.STRING,
	moderator: Sequelize.STRING,
});

const staffStats = sequelize.define('staffs', {
	moderator: Sequelize.STRING,
	nbRecords: Sequelize.INTEGER,
	nbAccepted: Sequelize.INTEGER,
	nbDenied: Sequelize.INTEGER,
});

const dbInfos = sequelize.define('infos', {
	status: {
		type: Sequelize.BOOLEAN,
		defaultValue: false,
	},
});

module.exports = { dbPendingRecords, dbAcceptedRecords, dbDeniedRecords, dbInfos, staffStats };

// Commands
client.commands = new Collection();
client.cooldowns = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`data : ${'data' in command} |execute : ${'execute' in command}`);
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// Log in to Discord
client.login(token);