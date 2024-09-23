const { SlashCommandBuilder } = require('discord.js');


module.exports = {
	enabled: true,
	data: new SlashCommandBuilder()
		.setName('placement')
		.setDescription('Look up the placement for any level on the list.')
        .addStringOption(option =>
            option.setName('levelname')
                .setDescription('The level you\'re looking up the placement for (Be sure to select one of the available options.)')
                .setMaxLength(1024)
                .setRequired(true)
                .setAutocomplete(true)),
    async autocomplete(interaction) {
        const { cache } = require('../../index.js');
		const focusedValue = interaction.options.getFocused();

		const Sequelize = require('sequelize');
		let levels = await cache.levels.findAll({
			where: { 
				name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), 'LIKE', '%' + focusedValue.toLowerCase() + '%')
			}});
		await interaction.respond(
			levels.slice(0,25).map(level => ({ name:level.name, value: level.name })),
		);
	

	},
	async execute(interaction) {
        const { cache } = require('../../index.js');
        const level = await cache.levels.findOne({where: {name: [interaction.options.getString('levelname')]}});

		if (!level || level?.position == null) return await interaction.reply(`:x: **${interaction.options.getString('levelname')}** is not on the list. Make sure to select the right option`);
		await interaction.reply(`**${interaction.options.getString('levelname')}** is placed at **#${level.position}**`);
	},
};