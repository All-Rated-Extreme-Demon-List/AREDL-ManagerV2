module.exports = {
	customId: 'confirmEmbed',
	ephemeral: true,
	async execute(interaction) {

		// Confirming an embed //

		const { db } = require('../index.js');

		// Check for embed info corresponding to the message id
		const embedData = await db.pendingEmbeds.findOne({ where: { discordid: interaction.message.id } });
		if (!embedData) {
			return await interaction.editReply(':x: Couldn\'t find an embed linked to that discord message ID');
		}
		if (embedData.sent) {
			return await interaction.editReply(':x: This embed has already been sent');
		}


		// Get the channel to send the embed in
		const channel = await interaction.guild.channels.cache.get(embed.channel);

		if (!channel) {
			return await interaction.editReply(':x: Couldn\'t find the channel to send the embed in');
		}
		let sent;
		try {
		// Send the embed
			sent = await channel.send({
				embeds: [interaction.embeds[0]],
			});
		} catch (error) {
			console.error(`Failed to send ${embedData.name} embed: ${error}`);
			return await interaction.editReply(`:x: Failed to send the embed. Check the bot permissions and try again.`);
		}

		await db.embeds.update({ sent: true, discordid: sent.id }, { where: { discordid: interaction.message.id } });
		await interaction.editReply(':white_check_mark: Embed sent successfully');
	}
}