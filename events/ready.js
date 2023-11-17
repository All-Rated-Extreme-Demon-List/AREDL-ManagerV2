const { Events } = require('discord.js');
const { dbRecords, dbInfos, staffStats } = require('../index.js');
module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {

		console.log('Syncing database data...');

		await dbRecords.sync();
		await dbInfos.sync();
		await staffStats.sync();

		console.log('Done !');

		const isInfosAvailable = await dbInfos.count();
		if (!isInfosAvailable) {
			await dbInfos.create({
				status: 0,
			});
		}

		console.log(`Ready! Logged in as ${client.user.tag}`);
		return 1;
	},
};
