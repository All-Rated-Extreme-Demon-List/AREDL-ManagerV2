const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	enabled: true,
	data: new SlashCommandBuilder()
		.setName('botping')
		.setDefaultMemberPermissions(0)
		.setDescription('Bot ping measurements'),
	async execute(interaction) {
		const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true, ephemeral: true });
		interaction.editReply(`Websocket heartbeat: ${interaction.client.ws.ping}ms.\nRoundtrip latency: ${sent.createdTimestamp - interaction.createdTimestamp}ms`);
	},
};