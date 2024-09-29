const { SlashCommandBuilder } = require('discord.js');
const { Sequelize } = require('sequelize');
module.exports = {
	enabled: false,
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('fish-lb')
		.setDescription('AREDL Fishy leaderboard'),
	async execute(interaction) {
		const { db, cache } = require('../../index.js');
		let page = 0;

		const userData = await db.fish.findOne({ where: { user: interaction.user.id }});
		if (userData) {
			const rank = await db.fish.count({
				where: {
				amount: {
					[Sequelize.Op.gt]: userData.amount
				}
				}
			});

			page = Math.floor(rank / 20);
		}
		
		const leaderboard = await db.fish.findAll({
			order: [['amount', 'DESC']],
			limit: 20,
			offset: page * 20
		  });

		if (!leaderboard) return await interaction.reply(':x: Something went wrong while fetching leaderboard data');
		let lbStr = '';
		let i = 20 * page + 1;
		for (const user of leaderboard) {
			const discordUser = await interaction.client.users.fetch(user.user);
			lbStr += `\n> **${i}** - ${discordUser?.tag ?? user.user } (${Math.round(user.amount*100)/100} points)`;
			i++;
		}
		return await interaction.reply(`> ### AREDL Fish Leaderboard (Page ${page + 1})${lbStr}`);
	},
};
