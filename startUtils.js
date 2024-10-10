const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');
const cron = require('node-cron');
const { githubOwner, githubRepo } = require('./config.json');
const logger = require('log4js').getLogger();

module.exports = {
	async clientInit(client) {
		logger.info('Initializing client...');
		// Commands
		client.commands = new Collection();
		client.cooldowns = new Collection();
		logger.info('  Loading commands');
		const parentCommandPath = path.join(__dirname, 'commands');

		if (fs.existsSync(parentCommandPath)) {
			const commandFolders = fs.readdirSync(parentCommandPath);
			for (const folder of commandFolders) {
				const commandsPath = path.join(parentCommandPath, folder);
				const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
				for (const file of commandFiles) {
					const filePath = path.join(commandsPath, file);
					const command = require(filePath);
					// Set a new item in the Collection with the key as the command name and the value as the exported module
					if ('data' in command && 'execute' in command && 'enabled' in command) {
						if (command.enabled) {
							client.commands.set(command.data.name, command);
							logger.info(`    Loaded ${command.data.name} from ${filePath}`);
						} else {
							logger.info(`    Ignored disabled command ${filePath}`);
						}
					} else {
						logger.info(`  [WARNING] The command at ${filePath} is missing a required "data", "execute" or "enabled" property.`);
					}
				}
			}
		}

		// Buttons
		logger.info('  Loading buttons');
		client.buttons = new Collection();
		const buttonsPath = path.join(__dirname, 'buttons');

		if (fs.existsSync(buttonsPath)) {
			const buttonsFiles = fs.readdirSync(buttonsPath).filter(file => file.endsWith('.js'));
			for (const file of buttonsFiles) {
				const filePath = path.join(buttonsPath, file);
				const button = require(filePath);
				client.buttons.set(button.customId, button);
				logger.info(`    Loaded ${button.customId} from ${filePath}`);
			}
		}

		// Select Menus
		logger.info('  Loading menus');
		client.menus = new Collection();
		const menusPath = path.join(__dirname, 'menus');

		if (fs.existsSync(menusPath)) {
			const menusFiles = fs.readdirSync(menusPath).filter(file => file.endsWith('.js'));
			for (const file of menusFiles) {
				const filePath = path.join(menusPath, file);
				const menu = require(filePath);
				client.menus.set(menu.customId, menu);
				logger.info(`    Loaded ${menu.customId} from ${filePath}`);
			}
		}

		// Modals
		logger.info('  Loading modals');
		client.modals = new Collection();
		const modalsPath = path.join(__dirname, 'modals');
		if (fs.existsSync(modalsPath)) {
			const modalsFiles = fs.readdirSync(modalsPath).filter(file => file.endsWith('.js'));
			for (const file of modalsFiles) {
				const filePath = path.join(modalsPath, file);
				const modal = require(filePath);
				client.modals.set(modal.customId, modal);
				logger.info(`    Loaded ${modal.customId} from ${filePath}`);
			}
		}

		// Events
		logger.info('  Loading events');
		const eventsPath = path.join(__dirname, 'events');

		if (fs.existsSync(eventsPath)) {
		const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
			for (const file of eventFiles) {
				const filePath = path.join(eventsPath, file);
				const event = require(filePath);
				if (event.once) {
					client.once(event.name, (...args) => event.execute(...args));
				} else {
					client.on(event.name, (...args) => event.execute(...args));
				}
				logger.info(`    Loaded ${event.name} from ${filePath}`);
			}
		}

		logger.info('Client initialization done');
	},

	// Sequelize sync init
	async sequelizeInit(db, cache) {
		logger.info('Syncing database data...');
		for (const table of Object.keys(db)) await db[table].sync({ alter: true});
		for (const table of Object.keys(cache)) {
			if (table !== 'updateLevels' && table !== 'updateUsers') await cache[table].sync({ alter: true});
		}

		// Create infos if they don't exist
		if (!(await db.infos.count({ where: { name: 'records' } }))) {
			logger.info('Records status not found, creating...');
			await db.infos.create({
				status: false,
				name: 'records',
			});
		}
		if (!(await db.infos.count({ where: { name: 'shifts' } }))) {
			logger.info('Shifts status not found, creating...');
			await db.infos.create({
				status: false,
				name: 'shifts',
			});
		} else await db.infos.update({status:false}, {where:{name:'shifts'}});

		if (!(await db.infos.count({ where: { name: 'commitdebug' } }))) {
			logger.info('Commit debug status not found, creating');
			await db.infos.create({
				status: 0,
				name: 'commitdebug',
			});
		}
		logger.info('Database sync done');
	},

	// Scheduled cron tasks
	async scheduledTasksInit() {
		
		logger.info('Setting up scheduled tasks');
		const scheduledPath = path.join(__dirname, 'scheduled');
		const scheduledFiles = fs.readdirSync(scheduledPath).filter(file => file.endsWith('.js'));

		for (const file of scheduledFiles) {
			const filePath = path.join(scheduledPath, file);
			const task = require(filePath);

			if (task.enabled) {
				cron.schedule(task.cron, task.execute);
				logger.info(`  Started ${task.name}(${task.cron}) from ${filePath}`);
			} else {
				logger.info(`  Ignored disabled ${task.name}(${task.cron}) from ${filePath}`);
			}
		}
		logger.info('Scheduled tasks setup done');
	},

	async checkGithubPermissions(octokit) {
		logger.info(`Checking github token permissions for ${githubOwner}/${githubRepo}...`);
		try {
			const { data } = await octokit.rest.repos.get({
				owner: githubOwner,
				repo: githubRepo
			});

			if (data.permissions.push) {
				logger.info(`Found push access to ${githubOwner}/${githubRepo}`);
			} else {
				logger.info(`Couldn't find push access to ${githubOwner}/${githubRepo}`);
			}
		} catch (error) {
			logger.info(`Error fetching repository information: ${error}`);
		}
	}
}