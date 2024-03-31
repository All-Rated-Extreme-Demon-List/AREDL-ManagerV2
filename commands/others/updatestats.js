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
		const { db } = require('../../index.js');

		const acceptedData = await db.acceptedRecords.findAll({
			attributes: [
				[Sequelize.literal('DATE("createdAt")'), 'date'],
				[Sequelize.literal('COUNT(*)'), 'count'],
			],
			group: ['date'] },
		);
		const deniedData = await db.deniedRecords.findAll({
			attributes: [
				[Sequelize.literal('DATE("createdAt")'), 'date'],
				[Sequelize.literal('COUNT(*)'), 'count'],
			],
			group: ['date'] },
		);

		for (const date of acceptedData) {
			if (!(await db.dailyStats.findOne({ where: { date: date.dataValues['date'] } }))) await db.dailyStats.create({ date: date.dataValues['date'], nbRecordsAccepted: date.dataValues['count'] });
			else await db.dailyStats.update({ nbRecordsAccepted: date.dataValues['count'] }, { where: { date: date.dataValues['date'] } });
		}

		for (const date of deniedData) {
			if ((!await db.dailyStats.findOne({ where: { date: date.dataValues['date'] } }))) await db.dailyStats.create({ date: date.dataValues['date'], nbRecordsDenied: date.dataValues['count'] });
			else await db.dailyStats.update({ nbRecordsDenied: date.dataValues['count'] }, { where: { date: date.dataValues['date'] } });
		}

		await interaction.editReply(':white_check_mark: Successfully updated internal daily stats database');

	},
};