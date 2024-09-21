const { token, githubToken } = require('./config.json');
const Sequelize = require('sequelize');
const { Client, GatewayIntentBits } = require('discord.js');
const { Octokit } = require('@octokit/rest');
const { createDbSchema, createCacheDbSchema } =  require('./others/dbSchema.js');
const { clientInit, sequelizeInit, checkGithubPermissions } = require('./startUtils.js');

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

// Establish Github connection
const octokit = new Octokit({ auth: githubToken });

// Create tables models
const db = createDbSchema(sequelize);
const cache = createCacheDbSchema(sequelize_cache);

module.exports = { db, cache, octokit, client, sequelize };

async function start() {
	console.log('-'.repeat(40));
	console.log('AREDL Manager starting...');
	console.log('-'.repeat(40));
	try {
		await sequelizeInit(db, cache);
	} catch (error) {
		console.error('Unable to sync database data: \n', error);
		process.exit(1);
	}
	try {
		await clientInit(client);
	} catch (error) {
		console.error('Unable to initialize client: \n', error);
		process.exit(1);
	}
	await checkGithubPermissions(octokit);
	try {
		console.log('Logging in client with discord...');
		await client.login(token);
		console.log(`Client logged in as ${client.user.tag}`);
	} catch (error) {
		console.error('Unable to login client: \n', error);
		process.exit(1);
	}
}

start();