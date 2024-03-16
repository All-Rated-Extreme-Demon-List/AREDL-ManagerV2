const { recordsPerWeek, pendingRecordsID, shiftsReminderID, guildId, enableSeparateStaffServer, staffGuildId, enableShifts } = require('../config.json');

module.exports = {
	name: 'shiftsReminder',
	cron: '50 11 * * *',
	enabled: enableShifts,
	async execute() {
		console.log('[DEBUG] Running shift reminder');
		const { dbShifts, dbPendingRecords, client } = require('../index.js');
		const day = new Date().toLocaleString('en-us', { weekday: 'long' });

		const shiftData = await dbShifts.findAll({ where: { day: day } });
		const pendingRecords = await dbPendingRecords.findAll({ where: {} });
		const nbPendingRecords = pendingRecords.length;

		let totalShiftRecords = 0;
		const shifts = {};

		for (const shift of shiftData) {
			const nbRecords = Math.floor(recordsPerWeek / (await dbShifts.count({ where: { moderator: shift.moderator } })));
			shifts[shift.moderator] = {
				'records': nbRecords,
			};
			totalShiftRecords += nbRecords;
		}

		console.log(`[DEBUG] Shifts 1: \n${shifts}`);
		let assignedRecords = 0;
		if (totalShiftRecords > nbPendingRecords) {
			for (const moderator of Object.keys(shifts)) {
				if (assignedRecords >= nbPendingRecords) {
					shifts[moderator].records = 0;
					continue;
				}
				let nbRecords = Math.floor((shifts[moderator].records / totalShiftRecords) * nbPendingRecords);
				if (assignedRecords + nbRecords > nbPendingRecords) nbRecords = nbPendingRecords - assignedRecords;

				shifts[moderator].records = nbRecords;
				assignedRecords += nbRecords;
			}
		}

		console.log(`[DEBUG] Shifts 2: \n${shifts}`);

		let shiftStr = '';
		let currentRecord = 0;

		for (const moderator of Object.keys(shifts)) {
			if (shifts[moderator].records == 0) {
				shiftStr += `\n> \n> <@${moderator}>:\n> No records assigned`;
				continue;
			}
			const startRecord = {
				'discordid': pendingRecords[currentRecord].discordid,
				'levelname': pendingRecords[currentRecord].levelname,
				'username': pendingRecords[currentRecord].username,
			};
			currentRecord += shifts[moderator].records - 1;
			const endRecord = {
				'discordid': pendingRecords[currentRecord].discordid,
				'levelname': pendingRecords[currentRecord].levelname,
				'username': pendingRecords[currentRecord].username,
			};
			currentRecord++;
			shiftStr += `\n> \n> <@${moderator}>:\n> From: https://discord.com/channels/${(enableSeparateStaffServer ? staffGuildId : guildId)}/${pendingRecordsID}/${startRecord.discordid} (${startRecord.levelname} for ${startRecord.username})\n>       to: https://discord.com/channels/${guildId}/${pendingRecordsID}/${endRecord.discordid} (${endRecord.levelname} for ${endRecord.username})\n> (${shifts[moderator].records} records)`;
		}

		console.log(`[DEBUG] shiftStr: \n{shiftStr}`);

		await (await client.channels.fetch(shiftsReminderID)).send(`> # ${new Date().toLocaleString('en-us', { weekday: 'long' })} Shifts\n> \n> Total pending records: ${nbPendingRecords}\n> Total assigned records: ${totalShiftRecords > nbPendingRecords ? assignedRecords : totalShiftRecords}\n\n> ## Assigned Records:${shiftStr}\n> \n> You have 24 hours to complete this shift. React to this message with a :white_check_mark: so we know that your shift has been completed`);

	},
};