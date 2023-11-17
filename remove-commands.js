const { REST, Routes } = require('discord.js');
const { clientId, token } = require('./config.json');

const rest = new REST().setToken(token);

// for guild-based commands
rest.put(Routes.applicationGuildCommands(clientId, 379376350701551616), { body: [] })
	.then(() => console.log('Successfully deleted all guild commands.'))
	.catch(console.error);