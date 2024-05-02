const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
	cooldown: 5,
	enabled: true,
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
					option.setName('position')
						.setDescription('The position to place the level at')
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
		await interaction.deferReply();

		if (interaction.options.getSubcommand() === 'place') {

			const { db } = require('../../index.js');

			const levelname = interaction.options.getString('levelname');
			const position = interaction.options.getInteger('position');
			const id = interaction.options.getInteger('id');
			const uploader = interaction.options.getString('uploader');
			const verifier = interaction.options.getString('verifier');
			const verification = interaction.options.getString('verification');
			const password = (interaction.options.getString('password') == null ? 'No Copy' : interaction.options.getString('password'));
			const rawCreators = interaction.options.getString('creators');
			const strCreators = (rawCreators ? JSON.stringify(rawCreators.split(',')) : '[]');

			const githubCode = `{\n\t"id": ${id},\n\t"name": "${levelname}",\n\t"author": "${uploader}",\n\t"creators": ${strCreators},\n\t"verifier": "${verifier}",\n\t"verification": "${verification}",\n\t"percentToQualify": 100,\n\t"password": "${password}",\n\t"records" : []\n}`;

			const placeEmbed = new EmbedBuilder()
				.setColor(0x8fce00)
				.setTitle(`Place Level: ${levelname}`)
				.addFields(
					{ name: 'ID:', value: `${id}`, inline: true },
					{ name: 'Uploader:', value: `${uploader}`, inline: true },
					{ name: 'Creators:', value: `${strCreators.slice(0,1023)}`, inline: true },
					{ name: 'Verifier:', value: `${verifier}`, inline: true },
					{ name: 'Verification:', value: `${verification}`, inline: true },
					{ name: 'Password:', value: `${password}`, inline: true },
					{ name: 'Position:', value: `${position}`, inline: true },
				)
				.setTimestamp();
			// Create commit buttons
			const commit = new ButtonBuilder()
				.setCustomId('commitAddLevel')
				.setLabel('Commit changes')
				.setStyle(ButtonStyle.Success);

			const cancel = new ButtonBuilder()
				.setCustomId('removeMsg')
				.setLabel('Cancel')
				.setStyle(ButtonStyle.Danger);

			const row = new ActionRowBuilder()
				.addComponents(commit)
				.addComponents(cancel);

			await interaction.editReply({ embeds: [placeEmbed], components: [row] });
			const sent = await interaction.fetchReply();

			try {
				await db.levelsToPlace.create({
					filename: levelname.normalize('NFD').replace(/[^a-zA-Z0-9 ]/g, '').replace(/ /g, '_').toLowerCase(),
					position: position,
					githubCode: githubCode,
					discordid: sent.id,
				});
			} catch (error) {
				console.log(`Couldn't register the level ; something went wrong with Sequelize : ${error}`);
				await sent.delete();
				return await interaction.editReply(':x: Something went wrong while adding the level; Please try again later');
			}
			return;
		}
	},
};