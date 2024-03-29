const { Events } = require('discord.js');
const { guildId } = require('../config.json');

module.exports = {
	name: Events.GuildMemberRemove,
	once: false,
	async execute(member) {

		if (member.guild.id != guildId) return;
		console.log(`Member left: ${member.id}`);

		const { dailyStats, dbPendingRecords } = require('../index.js');

		if (!(await dailyStats.findOne({ where: { date: Date.now() } }))) dailyStats.create({ date: Date.now(), nbMembersLeft: 1, nbRecordsPending: await dbPendingRecords.count() });
		else await dailyStats.update({ nbMembersLeft: (await dailyStats.findOne({ where: { date: Date.now() } })).nbMembersLeft + 1 }, { where: { date: Date.now() } });

	},
};
