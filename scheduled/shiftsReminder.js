const { staffGuildId, enableShifts, scheduleShiftsReminder } = require('../config.json');
const { EmbedBuilder } = require('discord.js');
const Sequelize = require('sequelize');
const logger = require('log4js').getLogger();

module.exports = {
	name: 'shiftsReminder',
	cron: scheduleShiftsReminder,
	enabled: enableShifts,
	async execute() {
		logger.info('Running shift reminder');
		const { db, client } = require('../index.js');

		logger.info('Checking last shifts undone records..');
		const uncheckedAssignedRecords = await db.pendingRecords.findAll({
			attributes: [
				[Sequelize.literal('COUNT(*)'), 'count'],
				'assigned',
			],
			group: 'assigned',
			where: { assigned: { [Sequelize.Op.ne]: 'None' } },
		});

		if (uncheckedAssignedRecords.length != 0) {
			for (const modRecords of uncheckedAssignedRecords) {
				const modId = modRecords.dataValues['assigned'];
				const staff = await db.staffSettings.findOne({ where: {moderator: modId} });
				try {
					if (staff && staff.shiftReminder) await client.users.send(modId, `> ## Shift Reminder\n> Your shift ends in 2 hours, and you currently have ${modRecords.dataValues['count']} assigned records left`);
				} catch (_) {
					logger.info(`Couldn't DM a reminder to ${modId}`);
				}
			}
		}
		logger.info('Shift reminder executed successfully');
	},
};