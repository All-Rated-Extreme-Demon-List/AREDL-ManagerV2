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

		const { pb, db } = require('../../index.js');

		if (interaction.options.getSubcommand() == 'login') {

			const key = interaction.options.getString('key');

			let user_perms;
			try {
				user_perms = await pb.send('/api/user/permissions', {
					headers: {
						'api-key': key
					},
				});	
			} catch (error)	{
				return await interaction.reply({ content: `:x: The provided key is invalid\nError:\n${JSON.stringify(error.response)}`, ephemeral: true})
			}

			if (Object.keys(user_perms).length == 0) return await interaction.reply({ content: ':x: You do not have enough permissions on the website', ephemeral: true})

			let perms = '';
			for (const permission of Object.keys(user_perms)) perms += `\n> - ${permission}`;

			const keyUpdate = (!(await db.staffSettings.findOne({ where: { moderator: interaction.user.id }})) ? await db.staffSettings.create({ moderator: interaction.user.id, pbKey: key}) : await db.staffSettings.update({ pbKey: key}, { where:{ moderator: interaction.user.id }}));
			if (!keyUpdate) return await interaction.reply({ content: ':x: The provided key is valid but something went wrong while registering it, please try again', ephemeral: true});
			
			else return await interaction.reply({ content: `> :white_check_mark: You were successfully authenticated with the following permissions :${perms}`, ephemeral: true});

		} else if (interaction.options.getSubcommand() == 'perms') {
			
			const { getRegisteredKey } = require('../../utils.js');

			const key = await getRegisteredKey(interaction);
			if (key==-1) return;
			let user_perms;
			try {
				user_perms = await pb.send('/api/user/permissions', {
					headers: {
						'api-key': key
					},
				});	
			} catch (error)	{
				return await interaction.reply({ content: `:x: Your API key is invalid, please register a new one with /aredl login\nError:\n${JSON.stringify(error.response)}`, ephemeral: true})
			}

			if (Object.keys(user_perms).length == 0) return await interaction.reply({ content: ':x: You do not have any permission on the website', ephemeral: true})
			else {
				let perms = '';
				for (const permission of Object.keys(user_perms)) perms += `\n> - ${permission}`;

				return await interaction.reply({ content: `> :white_check_mark: Your account has the following permissions :${perms}`, ephemeral: true});
			}
		} 
	},
};