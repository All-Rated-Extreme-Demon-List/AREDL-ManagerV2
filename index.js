const fs = require('node:fs');
const path = require('node:path');
const { token, pb_instance } = require('./config.json');
const Sequelize = require('sequelize');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const PocketBase = require('pocketbase/cjs');
const cron = require('node-cron');
const { createDbSchema, createCacheDbSchema } =  require('./others/dbSchema.js');
require('log-timestamp');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences] });

// Establish DB connection
const sequelize = new Sequelize({
	dialect: 'sqlite',
	logging: false,
	storage: './data/database.sqlite',
});

const sequelize_cache = new Sequelize({
	dialect: 'sqlite',
	logging: false,
	storage: './data/cache.sqlite',
});

const db = createDbSchema(sequelize);
const cache = createCacheDbSchema(sequelize_cache);
const pb = new PocketBase(pb_instance);

module.exports = { db, cache, client, pb };



// Scheduled cron tasks
console.log('Loading scheduled tasks');
const scheduledPath = path.join(__dirname, 'scheduled');
const scheduledFiles = fs.readdirSync(scheduledPath).filter(file => file.endsWith('.js'));

for (const file of scheduledFiles) {
	const filePath = path.join(scheduledPath, file);
	const task = require(filePath);

	if (task.enabled) {
		cron.schedule(task.cron, task.execute);
		console.log(`  Loaded ${task.name}(${task.cron}) from ${filePath}`);
	} else {
		console.log(`  Ignored disabled ${task.name}(${task.cron}) from ${filePath}`);
	}
}

// Commands
client.commands = new Collection();
client.cooldowns = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

console.log('Loading commands');
for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command && 'enabled' in command) {
			if (command.enabled) {
				client.commands.set(command.data.name, command);
				console.log(`  Loaded ${command.data.name} from ${filePath}`);
			} else {
				console.log(`  Ignored disabled command ${filePath}`);
			}
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data", "execute" or "enabled" property.`);
		}
	}
}

// Buttons
console.log('Loading buttons');
client.buttons = new Collection();
const buttonsPath = path.join(__dirname, 'buttons');
const buttonsFiles = fs.readdirSync(buttonsPath).filter(file => file.endsWith('.js'));

for (const file of buttonsFiles) {
	const filePath = path.join(buttonsPath, file);
	const button = require(filePath);
	client.buttons.set(button.customId, button);
	console.log(`  Loaded ${button.customId} from ${filePath}`);
}

// Select Menus
console.log('Loading menus');
client.menus = new Collection();
const menusPath = path.join(__dirname, 'menus');
const menusFiles = fs.readdirSync(menusPath).filter(file => file.endsWith('.js'));

for (const file of menusFiles) {
	const filePath = path.join(menusPath, file);
	const menu = require(filePath);
	client.menus.set(menu.customId, menu);
	console.log(`  Loaded ${menu.customId} from ${filePath}`);
}

// Events
console.log('Loading events');
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
	console.log(`  Loaded ${event.name} from ${filePath}`);
}

// Log in to Discord
client.login(token);