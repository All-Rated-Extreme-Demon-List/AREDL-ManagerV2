const { SlashCommandBuilder } = require('discord.js');
const Sequelize = require('sequelize');

module.exports = {
	cooldown: 5,
	enabled: false,
	data: new SlashCommandBuilder()
		.setName('updatestats')
		.setDescription('Update the daily stats from the records database')
		.setDefaultMemberPermissions(0),
	async execute(interaction) {

		await interaction.deferReply({ ephemeral: true });
		const { dailyStats, dbAcceptedRecords, dbDeniedRecords } = require('../../index.js');

		const acceptedData = await dbAcceptedRecords.findAll({
			attributes: [
				[Sequelize.literal('DATE("createdAt")'), 'date'],
				[Sequelize.literal('COUNT(*)'), 'count'],
			],
			group: ['date'] },
		);
		const deniedData = await dbDeniedRecords.findAll({
			attributes: [
				[Sequelize.literal('DATE("createdAt")'), 'date'],
				[Sequelize.literal('COUNT(*)'), 'count'],
			],
			group: ['date'] },
		);

		for (const date of acceptedData) {
			if (!(await dailyStats.findOne({ where: { date: date.dataValues['date'] } }))) await dailyStats.create({ date: date.dataValues['date'], nbRecordsAccepted: date.dataValues['count'] });
			else await dailyStats.update({ nbRecordsAccepted: date.dataValues['count'] }, { where: { date: date.dataValues['date'] } });
		}

		for (const date of deniedData) {
			if ((!await dailyStats.findOne({ where: { date: date.dataValues['date'] } }))) await dailyStats.create({ date: date.dataValues['date'], nbRecordsDenied: date.dataValues['count'] });
			else await dailyStats.update({ nbRecordsDenied: date.dataValues['count'] }, { where: { date: date.dataValues['date'] } });
		}

		await interaction.editReply(':white_check_mark: Successfully updated internal daily stats database');

	},
};