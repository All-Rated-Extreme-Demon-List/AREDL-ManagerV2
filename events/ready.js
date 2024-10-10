const { Events } = require('discord.js');
const { db, cache } = require('../index.js');
const { guildId, enableSeparateStaffServer, staffGuildId, pendingRecordsID, priorityRecordsID, enablePriorityRole } = require('../config.json');
const { scheduledTasksInit } = require('../startUtils.js');
const logger = require('log4js').getLogger();

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {

		// Update levels cache
		await cache.updateLevels();
		// Update users cache
		await cache.updateUsers();

		logger.info('Checking pending record data...');

		const pendingRecords = await db.pendingRecords.findAll();
		let nbFound = 0;
		const guild = await client.guilds.fetch((enableSeparateStaffServer ? staffGuildId : guildId));
		const pendingChannel = await guild.channels.cache.get(pendingRecordsID);
		const priorityChannel = (enablePriorityRole ? await guild.channels.cache.get(priorityRecordsID) : pendingChannel);
		for (let i = 0; i < pendingRecords.length; i++) {
			try {
				if (enablePriorityRole && pendingRecords[i].priority) await priorityChannel.messages.fetch(pendingRecords[i].discordid);
				else await pendingChannel.messages.fetch(pendingRecords[i].discordid);
			} catch (_) {
				await db.pendingRecords.destroy({ where: { discordid: pendingRecords[i].discordid } });
				nbFound++;
				logger.info(`Found an errored record : ${pendingRecords[i].discordid}`);

				// Try deleting the other message as well in case only the first one is missing smh
				try {
					if (enablePriorityRole && pendingRecords[i].priority) await (await priorityChannel.messages.fetch(pendingRecordsID[i].embedDiscordid)).delete();
					else await (await pendingChannel.messages.fetch(pendingRecords[i].embedDiscordid)).delete();
				} catch (__) {
					// Nothing to do
				}
			}
		}
		logger.info(`Found a total of ${nbFound} errored records.`);

		await scheduledTasksInit();
		logger.info(`Initialization complete`);
		return 1;
	},
};
