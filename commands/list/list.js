const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('list')
		.setDescription('Staff list management')
		.addSubcommand(subcommand =>
			subcommand
				.setName('place')
				.setDescription('Place a level on the list')
				.addStringOption(option =>
					option.setName('levelname')
						.setDescription('The name of the level to place')
						.setRequired(true))
				.addIntegerOption(option =>
					option.setName('id')
						.setDescription('The GD ID of the level to place')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('uploader')
						.setDescription('The name of the person who uploaded the level on GD')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('verifier')
						.setDescription('The name of the verifier')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('verification')
						.setDescription('The link to the level\'s verification video')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('creators')
						.setDescription('The list of the creators of the level, each separated by a comma'))
				.addStringOption(option =>
					option.setName('password')
						.setDescription('The GD password of the level to place'))),
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });

		if (interaction.options.getSubcommand() === 'place') {

			const levelname = interaction.options.getString('levelname');
			const id = interaction.options.getInteger('id');
			const uploader = interaction.options.getString('uploader');
			const verifier = interaction.options.getString('verifier');
			const verification = interaction.options.getString('verification');
			const password = (interaction.options.getString('password') == null ? 'No Copy' : interaction.options.getString('password'));
			const rawCreators = interaction.options.getString('creators');
			const strCreators = (rawCreators ? JSON.stringify(rawCreators.split(',')) : '[]');

			const githubCode = `\`\`\`json\n{\n\t"id": ${id},\n\t"name": "${levelname}",\n\t"author": "${uploader}",\n\t"creators": ${strCreators},\n\t"verifier": "${verifier}",\n\t"verification": "${verification}",\n\t"percentToQualify": 100,\n\t"password": "${password}",\n\t"records" : []\n}\`\`\``;

			const placeEmbed = new EmbedBuilder()
				.setColor(0x8fce00)
				.setTitle('Place Level')
				.addFields(
					{ name: 'Level name :', value: `${levelname}` },
					{ name: 'Github code', value: `${githubCode}` },
				)
				.setTimestamp();

			return await interaction.editReply({ embeds: [placeEmbed] });
		}
	},
};