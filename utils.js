
module.exports = {
	async getRegisteredKey(interaction) {
		const { db } = require('./index.js');
		const modData = (await db.staffSettings.findOne({ where: {moderator: interaction.user.id }}));
		if (!modData || modData.pbKey === '') {
			await interaction.reply({ content: ':x: You did not register your API key, please do so using /aredl login', ephemeral: true});
			return -1;
		} else return modData.pbKey;
	}
};