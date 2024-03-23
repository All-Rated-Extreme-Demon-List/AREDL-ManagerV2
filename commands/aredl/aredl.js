const { SlashCommandBuilder } = require('discord.js');
const Sequelize = require('sequelize');
module.exports = {
	cooldown: 5,
	enabled: true,
	data: new SlashCommandBuilder()
		.setName('aredl')
		.setDescription('AREDL Backend related commands')
		.addSubcommand(subcommand =>
			subcommand
				.setName('login')
				.setDescription('Link your AREDL account to the bot')
				.addStringOption(option =>
					option.setName('key')
						.setDescription('The AREDL API key of the account you want to link to')
						.setRequired(true)
						))
		.addSubcommand(subcommand =>
			subcommand
				.setName('perms')
				.setDescription('Check your AREDL permissions')),
	async execute(interaction) {

		const { pb, staffSettings } = require('../../index.js');

		if (interaction.options.getSubcommand() == 'login') {

			const token = interaction.options.getString('token');

			const user_perms = await pb.send('/api/user/permissions', {
				headers: {
					'api-key': token
				},
			});		

			if (Object.keys(user_perms).length == 0) return await interaction.reply({ content: ':x: The provided token is invalid or you do not have enough permissions on the website', ephemeral: true})
			let perms = '';
			for (const permission of Object.keys(user_perms)) perms += `\n> - ${permission}`;

			const tokenUpdate = (!(await staffSettings.findOne({ where: { moderator: interaction.user.id }})) ? await staffSettings.create({ moderator: interaction.user.id, pbToken: token}) : await staffSettings.update({ pbToken: token}, { where:{ moderator: interaction.user.id }}));
			if (!tokenUpdate) return await interaction.reply({ content: ':x: The provided token is valid but something went wrong while registering it, please try again', ephemeral: true});
			
			else return await interaction.reply({ content: `> :white_check_mark: You were successfully authenticated with the following permissions :${perms}`, ephemeral: true});

		} else if (interaction.options.getSubcommand() == 'perms') {
			
			const modData = (await staffSettings.findOne({ where: {moderator: interaction.user.id }}));
			if (!modData || modData.pbToken === '') return await interaction.reply({ content: ':x: You did not register an auth token, please do so using /aredl login', ephemeral: true});

			const user_perms = await pb.send('/api/user/permissions', {
				headers: {
					'api-key': modData.pbToken
				},
			});		

			if (Object.keys(user_perms).length == 0) return await interaction.reply({ content: ':x: Your auth token is invalid or you do not have enough permissions on the website', ephemeral: true})
			else {
				let perms = '';
				for (const permission of Object.keys(user_perms)) perms += `\n> - ${permission}`;

				return await interaction.reply({ content: `> :white_check_mark: Your account has the following permissions :${perms}`, ephemeral: true});
			}
		} 
	},
};