const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('recordmod')
		.setDescription('Staff record moderator commands')
		.setDMPermission(true)
		.addSubcommand(subcommand =>
			subcommand
				.setName('stats')
				.setDescription('Shows how many records you\'ve checked')),
	async execute(interaction) {

		const { staffStats } = require('../../index.js');

		await interaction.deferReply({ ephemeral: true });

		if (interaction.options.getSubcommand() === 'stats') {

			// Shows mod stats

			const modId = interaction.user.id;

			const modInfo = await staffStats.findOne({ attribute: ['nbRecords', 'nbAccepted', 'nbDenied', 'updatedAt'], where: { moderator: modId } });

			if (!modInfo) {
				return await interaction.editReply(':x: You haven\'t accepted or denied any record yet');
			}

			const modInfoEmbed = new EmbedBuilder()
				.setColor(0xFFBF00)
				.setTitle('Moderator info')
				.setDescription(`<@${modId}>`)
				.addFields(
					{ name: 'Total records checked:', value: `${modInfo.nbRecords}`, inline: true },
					{ name: 'Accepted records:', value: `${modInfo.nbAccepted}`, inline: true },
					{ name: 'Denied records:', value: `${modInfo.nbDenied}`, inline: true },
					{ name: 'Last activity:', value: `${modInfo.updatedAt.toDateString()}` },
				);

			return await interaction.editReply({ embeds: [ modInfoEmbed ] });


		}
	},
};
