const { SlashCommandBuilder } = require('discord.js');
const { guildId, recordsPerWeek, pendingRecordsID } = require('../../config.json');

module.exports = {
	cooldown: 5,
	enabled: true,
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('Test')
		.setDefaultMemberPermissions(0),
	async execute(interaction) {
		const shiftsreminder = require('../../scheduled/shifts');
		shiftsreminder.execute();
		await interaction.reply({content: ':white_check_mark:', ephemeral: true});
	},
};
