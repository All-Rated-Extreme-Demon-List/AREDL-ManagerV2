const { SlashCommandBuilder } = require('discord.js');
const { cache } = require('../../index.js');

module.exports = {
	enabled: true,
	data: new SlashCommandBuilder()
		.setName('placement')
		.setDMPermission(false)
		.setDescription('Look up the placement for any level on the list.')
        .addStringOption(option =>
            option.setName('levelname')
                .setDescription('Name of the level you\'re looking up the placement for (Be sure to select one of the available options.)')
                .setMaxLength(1024)
                .setRequired(true)
                .setAutocomplete(true)),
    async autocomplete(interaction) {
		const focusedValue = interaction.options.getFocused();
		if (focusedValue.length < 2) {
			return await interaction.respond([]);
		} else {
            const Sequelize = require('sequelize');
			let levels = await cache.levels.findAll({
				where: { 
					name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), 'LIKE', focusedValue.toLowerCase() + '%')
				}});
			if (levels.length > 25) levels = levels.slice(0, 25);
			await interaction.respond(
				levels.map(level => ({ name:level.name, value: level.name })),
			);
		}

	},
	async execute(interaction) {
        const level = await cache.levels.findOne({where: {name: [interaction.options.getString('levelname')]}});

		await interaction.reply(`**${interaction.options.getString('levelname')}** is placed at **#${level.position}**`);
	},
};