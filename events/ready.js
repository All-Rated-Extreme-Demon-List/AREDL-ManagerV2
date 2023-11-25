const { Events } = require('discord.js');
const { dbInfos, staffStats, dbPendingRecords, dbDeniedRecords, dbAcceptedRecords } = require('../index.js');
const { guildId, pendingRecordsID, priorityRecordsID } = require('../config.json');

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {

		console.log('Syncing database data...');

		await dbPendingRecords.sync({ alter: true });
		await dbDeniedRecords.sync({ alter: true });
		await dbAcceptedRecords.sync({ alter: true });
		await dbInfos.sync({ alter: true });
		await staffStats.sync({ alter: true });

		const isInfosAvailable = await dbInfos.count();
		if (!isInfosAvailable) {
			await dbInfos.create({
				status: 0,
			});
		}

		console.log('Checking pending record data...');

		const pendingRecords = await dbPendingRecords.findAll();
		let nbFound = 0;
		const guild = await client.guilds.fetch(guildId);
		const pendingChannel = await guild.channels.cache.get(pendingRecordsID);
		const priorityChannel = await guild.channels.cache.get(priorityRecordsID);
		for (let i = 0; i < pendingRecords.length; i++) {
			try {
				if (pendingRecords[i].priority) await priorityChannel.messages.fetch(pendingRecords[i].discordid);
				else await pendingChannel.messages.fetch(pendingRecords[i].discordid);
			} catch (_) {
				await dbPendingRecords.destroy({ where: { discordid: pendingRecords[i].discordid } });
				nbFound++;
				console.log(`Found an errored record : ${pendingRecords[i].discordid}`);

				// Try deleting the other message as well in case only the first one is missing smh
				try {
					if (pendingRecords[i].priority) await (await priorityChannel.messages.fetch(pendingRecordsID[i].embedDiscordid)).delete();
					else await (await pendingChannel.messages.fetch(pendingRecords[i].embedDiscordid)).delete();
				} catch (__) {
					// Nothing to do
				}
			}
		}
		console.log(`Found a total of ${nbFound} errored records.`);

		console.log(`Ready! Logged in as ${client.user.tag}`);
		return 1;
	},
};
