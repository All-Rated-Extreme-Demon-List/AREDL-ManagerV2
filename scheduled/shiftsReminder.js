const { staffGuildId, enableShifts } = require('../config.json');
const { EmbedBuilder } = require('discord.js');
const Sequelize = require('sequelize');

module.exports = {
	name: 'shiftsReminder',
	cron: '5 22 * * *',
	enabled: enableShifts,
	async execute() {
		console.log('Running shift reminder');
		const { db, client } = require('../index.js');

		console.log('Checking last shifts undone records..');
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
					console.log(`Couldn't DM a reminder to ${modId}`);
				}
			}
		}
		console.log('Shift reminder executed successfully');
	},
};