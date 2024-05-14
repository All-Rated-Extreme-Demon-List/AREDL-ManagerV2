const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	enabled: true,
	cooldown: 3600,
	data: new SlashCommandBuilder()
		.setName('fish')
		.setDescription('AREDL Fishy'),
	async execute(interaction) {
		const { db, cache } = require('../../index.js');
		const baseFactor = 0.0005832492374192035997815;

		const id = interaction.user.id;
		const name = interaction.user.tag;

		const levels = await cache.levels.findAll({ order: [['position', 'ASC']]});
		const level_count = levels.length;
		const fished_pos = Math.floor(Math.random()*level_count);
		const fished_level = levels[fished_pos].name;
		const b = (level_count - 1) * baseFactor;
    	const a = 600 * Math.sqrt(b);
		const fished_score = (a / Math.sqrt(fished_pos / 50 + b) - 100);

		const userdata = await db.fish.findOne({where: {user: id}});
		if (!userdata) await db.fish.create({ user: id, amount: fished_score});
		else await db.fish.update({ amount: userdata.amount + fished_score }, { where: { user: id }});
		return await interaction.reply(`> **${name}** fished **${fished_level}** (TOP ${fished_pos + 1})\n> +${Math.round(fished_score*100)/100} points (Total: ${Math.round((userdata ? userdata.amount + fished_score : fished_score)*100)/100} points)`);
	},
};