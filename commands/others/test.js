const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { guildId, recordsPerWeek, pendingRecordsID } = require('../../config.json');

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('Test')
		.setDefaultMemberPermissions(0),
	async execute(interaction) {

		await interaction.deferReply({ ephemeral: true });
		const { dbShifts, dbPendingRecords } = require('../../index.js');
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

		if (totalShiftRecords > nbPendingRecords) {
			let assignedRecords = 0;
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

		let shiftStr = '';
		let pingStr = '';
		let currentRecord = 0;

		for (const moderator of Object.keys(shifts)) {
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
			pingStr += `<@${moderator}> `;
			shiftStr += `<@${moderator}>: From https://discord.com/channels/${guildId}/${pendingRecordsID}/${startRecord.discordid} (${startRecord.levelname} for ${startRecord.username}) to https://discord.com/channels/${guildId}/${pendingRecordsID}/${endRecord.discordid} (${endRecord.levelname} for ${endRecord.username}) (${shifts[moderator].records} records)\n`;
		}

		const shiftsEmbed = new EmbedBuilder()
			.setColor(0x005c91)
			.setTitle(`${new Date().toLocaleString('en-us', { weekday: 'long' })} Shift`)
			.setDescription(shiftStr)
			.setTimestamp();

		await interaction.editReply({ content: pingStr, embeds: [shiftsEmbed] });

	},
};
