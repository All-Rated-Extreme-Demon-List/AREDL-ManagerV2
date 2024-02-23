const fs = require('node:fs');
const path = require('node:path');
const { token } = require('./config.json');
const { githubToken } = require('./config.json');
const { websiteDataLink } = require('./config.json');
const Sequelize = require('sequelize');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { Octokit } = require('@octokit/rest');

require('log-timestamp');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// Establish DB connection
const sequelize = new Sequelize({
	dialect: 'sqlite',
	logging: false,
	storage: './data/database.sqlite',
});

// Establish Github connection
const octokit = new Octokit({ auth: githubToken });

// Cache all levels names and file names every hour
async function fetchListData() {
	const levels_dict = {};
	let list_data;
	try {
		list_data = await (await fetch(`${websiteDataLink}/_list.json`, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
			},
		})).json();
	} catch (fetchError) {
		console.log(`Failed to fetch list data: \n${fetchError}`);
		return -1;
	}

	for (const filename of list_data) {
		const file_data = await (await fetch(`${websiteDataLink}/${filename}.json`, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
			},
		})).json();
		levels_dict[file_data.name] = filename;
	}
	console.log('List data updated successfully');
	return levels_dict;
}


let levels_dict;
try {
	levels_dict = JSON.parse(fs.readFileSync('data/cached_list.json'));
} catch (err) {
	console.log('No cached list found. Fetching data...');
	fetchListData().then(data => {
		if (data === -1) return;
		fs.writeFile('data/cached_list.json', JSON.stringify(data, null, '\t'), function(err) {
			if (err) {
				console.log(err);
			}
		});
		levels_dict = data;
	});
}

const cron = require('node-cron');
cron.schedule('0 * * * *', () => {
	console.log('Fetching last list data...');
	fetchListData().then(data => {
		if (data === -1) return;
		fs.writeFile('data/cached_list.json', JSON.stringify(data, null, '\t'), function(err) {
			if (err) {
				console.log(err);
			}
		});
		levels_dict = data;
	});
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

const dbLevelsToPlace = sequelize.define('levelsToPlace', {
	filename: Sequelize.STRING,
	position: Sequelize.INTEGER,
	githubCode: Sequelize.STRING,
	discordid: Sequelize.STRING,
});

const dbRecordsToCommit = sequelize.define('recordsToCommit', {
	filename: Sequelize.STRING,
	githubCode: Sequelize.STRING,
	discordid: Sequelize.STRING,
	user: Sequelize.STRING,
});

const dbMessageLocks = sequelize.define('messageLocks', {
	discordid: Sequelize.STRING,
	locked: Sequelize.BOOLEAN,
	userdiscordid: Sequelize.STRING,
});

const staffStats = sequelize.define('staffs', {
	moderator: Sequelize.STRING,
	nbRecords: Sequelize.INTEGER,
	nbAccepted: Sequelize.INTEGER,
	nbDenied: Sequelize.INTEGER,
});

const dailyStats = sequelize.define('dailystats', {
	date: Sequelize.DATEONLY,
	nbRecordsSubmitted: { type: Sequelize.NUMBER, defaultValue: 0 },
	nbRecordsPending: { type: Sequelize.NUMBER, defaultValue: 0 },
	nbRecordsAccepted: { type: Sequelize.NUMBER, defaultValue: 0 },
	nbRecordsDenied: { type: Sequelize.NUMBER, defaultValue: 0 },
	nbMembersJoined: { type: Sequelize.NUMBER, defaultValue: 0 },
	nbMembersLeft: { type: Sequelize.NUMBER, defaultValue: 0 },
});

const staffSettings = sequelize.define('settings', {
	moderator: Sequelize.STRING,
	sendAcceptedInDM: {
		type: Sequelize.BOOLEAN,
		defaultValue: false,
	},
});

const dbInfos = sequelize.define('infos', {
	name: Sequelize.STRING,
	status: {
		type: Sequelize.BOOLEAN,
		defaultValue: false,
	},
});

module.exports = { dbPendingRecords, dbAcceptedRecords, dbDeniedRecords, dbInfos, staffStats, staffSettings, dbLevelsToPlace, dbRecordsToCommit, dbMessageLocks, dailyStats, octokit };
module.exports.getLevelsDict = function() {
	return levels_dict;
};

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
		if ('data' in command && 'execute' in command) {
			console.log(`  Loaded ${command.data.name} from ${filePath}`);
			client.commands.set(command.data.name, command);
		} else {
			console.log(`data : ${'data' in command} |execute : ${'execute' in command}`);
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
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