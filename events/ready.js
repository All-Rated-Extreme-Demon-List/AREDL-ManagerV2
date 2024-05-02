const { Events } = require('discord.js');
const { db, cache } = require('../index.js');
const { guildId, enableSeparateStaffServer, staffGuildId, pendingRecordsID, priorityRecordsID, enablePriorityRole } = require('../config.json');

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {

		console.log('Syncing database data...');
		for (const table of Object.keys(db)) {
			if(db[table].hasOwnProperty('sync')) await db[table].sync({ alter: true});
		}

		for (const table of Object.keys(cache)) {
			if (cache[table].hasOwnProperty('sync')) await cache[table].sync({ alter: true});
		}
		cache.levels.sync({alter: true});

		if (!(await db.infos.count({ where: { name: 'records' } }))) {
			await db.infos.create({
				status: false,
				name: 'records',
			});
		}
		if (!(await db.infos.count({ where: { name: 'shifts' } }))) {
			await db.infos.create({
				status: false,
				name: 'shifts',
			});
		} else await db.infos.update({status:false}, {where:{name:'shifts'}});

		if (!(await db.infos.count({ where: { name: 'commitdebug' } }))) {
			await db.infos.create({
				status: 0,
				name: 'commitdebug',
			});
		}

		console.log('Checking pending record data...');

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