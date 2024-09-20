const { db } = require("..");

module.exports = {
	customId: 'cancelEmbed',
	ephemeral: true,
	async execute(interaction) {
		try {
			return await db.embeds.destroy({ where: { discordid: interaction.message.id}})
		} catch (error) {
			console.log(`Failed to cancel embed: ${error}`);
			return await interaction.editReply(':x: Something went wrong ');
		}
	},
};
