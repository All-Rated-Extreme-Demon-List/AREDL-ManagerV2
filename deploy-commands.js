const { REST, Routes } = require('discord.js');
const { clientId, guildId, staffGuildId, enableSeparateStaffServer, token } = require('./config.json');
const log4js = require('log4js');
const fs = require('node:fs');
const path = require('node:path');

// Logger
log4js.configure('./log4js.json');
const logger = log4js.getLogger();
const errorLogger = log4js.getLogger('error');

// Error logging
process.on('uncaughtException', (err) => {
	errorLogger.error('Uncaught Exception:', err);
});
  
process.on('unhandledRejection', (reason, promise) => {
	errorLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const commands = [];
// Grab all the command files from the commands directory
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	// Grab all the command files from the commands directory
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command && 'enabled' in command) {
			if (command.enabled) commands.push(command.data.toJSON());
			else logger.info(`Ignoring disabled command ${filePath}`);
		} else {
			logger.info(`[WARNING] The command at ${filePath} is missing a required "data", "execute" or "enabled" property.`);
		}
	}
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy commands
(async () => {
	try {
		logger.info(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);
		if (enableSeparateStaffServer) {
			await rest.put(
				Routes.applicationGuildCommands(clientId, staffGuildId),
				{ body: commands },
			);
		}

		logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		logger.error(error);
	}
})();
