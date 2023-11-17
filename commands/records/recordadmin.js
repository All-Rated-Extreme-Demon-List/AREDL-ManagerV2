const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('recordadmin')
		.setDescription('Staff record administration commands')
		.setDMPermission(true)
		.setDefaultMemberPermissions(0)
		.addSubcommand(subcommand =>
			subcommand
				.setName('setstatus')
				.setDescription('Set the state of record submission')
				.addStringOption(option =>
					option.setName('status')
						.setDescription('Status')
						.setRequired(true)
						.addChoices(
							{ name: 'Open', value: 'open' },
							{ name: 'Closed', value: 'closed' },
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('modinfo')
				.setDescription('Shows list staff records info ')),
	async execute(interaction) {

		await interaction.deferReply();

		if (interaction.options.getSubcommand() === 'setstatus') {

			// Changes record status

			const { dbInfos } = require('../../index.js');

			// Update sqlite db
			const update = await dbInfos.update({ status: interaction.options.getString('status') === 'closed' }, { where: { id: 1 } });

			if (!update) return await interaction.editReply(':x: Something went wrong while executing the command');
			return await interaction.editReply(`:white_check_mark: Changed record status to ${interaction.options.getString('status')}`);

		} else if (interaction.options.getSubcommand() === 'modinfo') {

			// Display staff records info

			const { staffStats } = require('../../index.js');

			// Get number of staff
			const nbTotal = await staffStats.count();
			// Get sqlite data, ordered by descending number of records, limited to top 20 for now (maybe add a page system later)
			const modInfos = await staffStats.findAll({ limit: 20, order: [ ['nbRecords', 'DESC'] ], attributes: ['moderator', 'nbRecords', 'nbAccepted', 'nbDenied', 'updatedAt'] });
			if (!nbTotal || !modInfos) return await interaction.editReply(':x: Something went wrong while executing the command');

			let strModData = '';
			for (let i = 0; i < modInfos.length; i++) {
				strModData += `**${i + 1}** - <@${modInfos[i].moderator}> - ${modInfos[i].nbRecords} records (${modInfos[i].nbAccepted} A, ${modInfos[i].nbDenied} D) - Last activity : ${modInfos[i].updatedAt.toDateString()}\n`;
			}

			// Embed displaying the data
			const modEmbed = new EmbedBuilder()
				.setColor(0xFFBF00)
				.setAuthor({ name: 'Moderator data' })
				.setDescription(strModData)
				.setTimestamp();

			// Send reply
			return await interaction.editReply({ embeds: [ modEmbed ] });
		}
	},
};
