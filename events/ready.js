const { Events } = require('discord.js');
const { dbInfos, staffStats, dbPendingRecords, dbDeniedRecords, dbAcceptedRecords, staffSettings, dbLevelsToPlace, dbRecordsToCommit, dbMessageLocks, dailyStats, dbShifts } = require('../index.js');
const { guildId, enableSeparateStaffServer, staffGuildId, pendingRecordsID, priorityRecordsID, enablePriorityRole } = require('../config.json');

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
		await staffSettings.sync({ alter: true });
		await dbLevelsToPlace.sync({ alter: true });
		await dbRecordsToCommit.sync({ alter: true });
		await dbMessageLocks.sync({ alter: true });
		await dailyStats.sync({ alter: true });
		await dbShifts.sync({ alter: true });

		if (!(await dbInfos.count({ where: { name: 'records' } }))) {
			await dbInfos.create({
				status: false,
				name: 'records',
			});
		}
		if (!(await dbInfos.count({ where: { name: 'shiftsLock' } }))) {
			await dbInfos.create({
				status: false,
				name: 'shiftsLock',
			});
		} else await dbInfos.update({status:false}, {where:{name:'shiftsLock'}});

		if (!(await dbInfos.count({ where: { name: 'commitdebug' } }))) {
			await dbInfos.create({
				status: 0,
				name: 'commitdebug',
			});
		}

		console.log('Checking pending record data...');

		const pendingRecords = await dbPendingRecords.findAll();
		let nbFound = 0;
		const guild = await client.guilds.fetch((enableSeparateStaffServer ? staffGuildId : guildId));
		const pendingChannel = await guild.channels.cache.get(pendingRecordsID);
		const priorityChannel = (enablePriorityRole ? await guild.channels.cache.get(priorityRecordsID) : pendingChannel);
		for (let i = 0; i < pendingRecords.length; i++) {
			try {
				if (enablePriorityRole && pendingRecords[i].priority) await priorityChannel.messages.fetch(pendingRecords[i].discordid);
				else await pendingChannel.messages.fetch(pendingRecords[i].discordid);
			} catch (_) {
				await dbPendingRecords.destroy({ where: { discordid: pendingRecords[i].discordid } });
				nbFound++;
				console.log(`Found an errored record : ${pendingRecords[i].discordid}`);

				// Try deleting the other message as well in case only the first one is missing smh
				try {
					if (enablePriorityRole && pendingRecords[i].priority) await (await priorityChannel.messages.fetch(pendingRecordsID[i].embedDiscordid)).delete();
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