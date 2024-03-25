const { Events } = require('discord.js');

const { submitRecord } = require('../others/pbRecordsSubmissions.js');
const { guildId, enableSeparateStaffServer, staffGuildId, pendingRecordsID, priorityRecordsID, enablePriorityRole, botPbUser, botPbPasswd } = require('../config.json');
//import eventsource from 'eventsource';
const eventsource = require('eventsource');
global.EventSource = eventsource;

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		const { db, pb } = require('../index.js');
		console.log('Syncing database data...');
		for (const table of Object.keys(db)) {
			await db[table].sync({ alter: true});
		}
		if (!(await db.dbInfos.count({ where: { name: 'records' } }))) {
			await db.dbInfos.create({
				status: 0,
				name: 'records',
			});
		}

		if (!(await db.dbInfos.count({ where: { name: 'commitdebug' } }))) {
			await db.dbInfos.create({
				status: 0,
				name: 'commitdebug',
			});
		}

		console.log(`Logging in to pocketbase...`);
		await pb.admins.authWithPassword(botPbUser, botPbPasswd);
		pb.collection('record_submissions').subscribe('*', submitRecord, { expand:  'submitted_by, level' });

		console.log('Checking pending record data...');

		const pendingRecords = await db.dbPendingRecords.findAll();
		let nbFound = 0;
		const guild = await client.guilds.fetch((enableSeparateStaffServer ? staffGuildId : guildId));
		const pendingChannel = await guild.channels.cache.get(pendingRecordsID);
		const priorityChannel = (enablePriorityRole ? await guild.channels.cache.get(priorityRecordsID) : pendingChannel);

		for (let i = 0; i < pendingRecords.length; i++) {
			try {
				if (enablePriorityRole && pendingRecords[i].priority) await priorityChannel.messages.fetch(pendingRecords[i].discordid);
				else await pendingChannel.messages.fetch(pendingRecords[i].discordid);
			} catch (_) {
				await db.dbPendingRecords.destroy({ where: { discordid: pendingRecords[i].discordid } });
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