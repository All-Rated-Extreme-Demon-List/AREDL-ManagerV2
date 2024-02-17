module.exports = {
	customId: 'removeMsg',
	ephemeral: true,
	async execute(interaction) {
		try {
			await interaction.message.delete();
			return await interaction.editReply(':white_check_mark: Message deleted');
		} catch (error) {
			console.log(error);
			return await interaction.editReply(':x: Something went wrong');
		}
	},
};
