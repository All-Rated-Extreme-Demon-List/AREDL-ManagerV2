const { Events } = require('discord.js');
const { guildId } = require('../config.json');
const logger = require('log4js').getLogger();

module.exports = {
	name: Events.GuildMemberRemove,
	once: false,
	async execute(member) {

		if (member.guild.id != guildId) return;
		logger.info(`Member left: ${member.id}`);

		const { db } = require('../index.js');

		if (!(await db.dailyStats.findOne({ where: { date: Date.now() } }))) db.dailyStats.create({ date: Date.now(), nbMembersLeft: 1, nbRecordsPending: await db.pendingRecords.count() });
		else await db.dailyStats.update({ nbMembersLeft: (await db.dailyStats.findOne({ where: { date: Date.now() } })).nbMembersLeft + 1 }, { where: { date: Date.now() } });

	},
};
