const { recordsPerWeek, pendingRecordsID, shiftsReminderID, shiftsLogsID, guildId, enableSeparateStaffServer, staffGuildId, enableShifts } = require('../config.json');
const { EmbedBuilder } = require('discord.js');
const Sequelize = require('sequelize');

module.exports = {
	name: 'shiftsReminder',
	cron: '5 0 * * *',
	enabled: enableShifts,
	async execute() {
		console.log('Running shift reminder');
		const { db, client } = require('../index.js');

		// Past shift recap
		console.log('Checking last shifts undone records..');
		const uncheckedAssignedRecords = await db.dbPendingRecords.findAll({
			attributes: [
				[Sequelize.literal('COUNT(*)'), 'count'],
				'assigned',
			],
			group: 'assigned',
			where: { assigned: { [Sequelize.Op.ne]: 'None' } },
		});
		let yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		let recapStr = `> # ${yesterday.toLocaleString('en-us', { weekday: 'long' })} shifts recap`;

		if (uncheckedAssignedRecords.length == 0) {
			 recapStr += '\n> - None';
		} else {
			for (const modRecords of uncheckedAssignedRecords) {
				recapStr += `\n> - <@${modRecords.dataValues['assigned']}> (${modRecords.dataValues['count']} missed records)`;
			}
		}

		await (await client.channels.fetch(shiftsLogsID)).send(recapStr);
		console.log('Clearing unchecked assigned records..');
		// Reset other assigned records
		const rawUncheckedAssignedRecords = await db.dbPendingRecords.findAll({
			attributes: [
				'embedDiscordid',
				'assigned',
			],
			where: { assigned: { [Sequelize.Op.ne]: 'None' } },
		});
		for (record of rawUncheckedAssignedRecords) {
			try {
				const recordId = record.dataValues['embedDiscordid'];
				const embedMessage = await (await client.channels.fetch(pendingRecordsID)).messages.fetch(recordId);
				const newEmbed = EmbedBuilder.from(embedMessage.embeds[0]).setDescription(`Unassigned`);
				await new Promise(r => setTimeout(r, 5000));
				console.log(`Clearing ${recordId} (${record.dataValues['assigned']})`)
				embedMessage.edit({ embeds: [newEmbed]});
			} catch (err) {
				console.log(`Couldn't clear ${recordId} (${record.dataValues['assigned']})`)
			}
		}
		db.dbPendingRecords.update({ assigned: 'None' }, { where: { assigned: { [Sequelize.Op.ne]: 'None' } }});

		// Assign new records
		console.log('Assigning new records..');
		const day = new Date().toLocaleString('en-us', { weekday: 'long' });

		const shiftData = await db.dbShifts.findAll({ where: { day: day } });
		const pendingRecords = await db.dbPendingRecords.findAll({ where: {}, order:[['createdAt', 'ASC']] });
		const nbPendingRecords = pendingRecords.length;

		let totalShiftRecords = 0;
		const shifts = {};

		for (const shift of shiftData) {
			const nbRecords = Math.floor(recordsPerWeek / (await db.dbShifts.count({ where: { moderator: shift.moderator } })));
			shifts[shift.moderator] = {
				'records': nbRecords,
			};
			totalShiftRecords += nbRecords;
		}

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
		const totalAssignedRecords = totalShiftRecords > nbPendingRecords ? assignedRecords : totalShiftRecords;
		await (await client.channels.fetch(shiftsReminderID)).send(`> # ${new Date().toLocaleString('en-us', { weekday: 'long' })} Shifts\n> \n> Total pending records: ${nbPendingRecords}\n> Total assigned records: ${totalAssignedRecords}`);

		let currentRecord = 0;
		try {
			for (const moderator of Object.keys(shifts)) {
				if (shifts[moderator].records == 0) {
					shiftStr += `\n> \n> <@${moderator}>:\n> No records assigned`;
					continue;
				}

				for (let record = currentRecord; record < currentRecord + shifts[moderator].records; record++) {
					const recordId = pendingRecords[record].embedDiscordid;
					const embedMessage = await (await client.channels.fetch(pendingRecordsID)).messages.fetch(recordId);
					const newEmbed = EmbedBuilder.from(embedMessage.embeds[0]).setDescription(`Assigned to: <@${moderator}>`);
					await new Promise(r => setTimeout(r, 5000));
					console.log(`(${record+1}/${totalAssignedRecords}) Assigning ${recordId} (${moderator})`)
					embedMessage.edit({ embeds: [newEmbed]});
					dbPendingRecords.update({ assigned: moderator }, { where: { embedDiscordid: recordId }});
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
				await (await client.channels.fetch(shiftsReminderID)).send(`\n> \n> <@${moderator}>:\n> From: https://discord.com/channels/${(enableSeparateStaffServer ? staffGuildId : guildId)}/${pendingRecordsID}/${startRecord.discordid} (${startRecord.levelname} for ${startRecord.username})\n>       to: https://discord.com/channels/${guildId}/${pendingRecordsID}/${endRecord.discordid} (${endRecord.levelname} for ${endRecord.username})\n> (${shifts[moderator].records} records)`);
			}
			console.log('New shift assigned successfully');
			await (await client.channels.fetch(shiftsReminderID)).send(`\n> \n> You have 24 hours to complete this shift. React to this message with a :white_check_mark: so we know that your shift has been completed`);
		} catch (err) {
			console.log(`Something went wrong while assigning records:\n${err}`);
			await (await client.channels.fetch(shiftsReminderID)).send('> :x: Something went wrong while assigning shifts, check error logs');
		}
	},
};