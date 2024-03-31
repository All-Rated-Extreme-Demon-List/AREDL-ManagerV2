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
						.setMinLength(1)
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
						.setDescription('The account who uploaded the level. If it does not exist on AREDL, a placeholder will be created.')
						.setMinLength(1)
						.setRequired(true)
						.setAutocomplete(true))
				.addStringOption(option =>
					option.setName('verifier')
						.setDescription('The account of the verifier. If it does not exist on AREDL, a placeholder will be created.')
						.setMinLength(1)
						.setRequired(true)
						.setAutocomplete(true))
				.addStringOption(option =>
					option.setName('verification')
						.setDescription('The link to the level\'s verification video')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('creator')
						.setDescription('The creator of the level. If there are more than one, use /level addcreator afterwards.')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true))
				.addBooleanOption(option =>
					option.setName('mobile')
						.setDescription('If the verification was made on mobile or not')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('password')
						.setDescription('The GD password of the level to place'))
				.addBooleanOption(option =>
					option.setName('legacy')
						.setDescription('If the level should be placed as legacy or not')))
		.addSubcommand(subcommand =>
			subcommand
				.setName('move')
				.setDescription('Moves a level to another position on the list')
				.addStringOption(option =>
					option.setName('levelname')
						.setDescription('The name of the level to move')
						.setAutocomplete(true)
						.setMinLength(1)
						.setRequired(true))
				.addIntegerOption(option =>
					option.setName('position')
						.setDescription('The new position to move the level at')
						.setMinValue(1)
						.setRequired(true))
				.addBooleanOption(option =>
					option.setName('legacy')
						.setDescription('If the level should be placed in the legacy list or not'))),
	async autocomplete(interaction) {
		const focusedValue = interaction.options.getFocused();
		const { cache } = require('../../index.js');
		const { getRegisteredKey } = require('../../utils.js');

		const key = await getRegisteredKey(interaction);
		if (key == -1) return await interaction.respond([]);
		
		let results;
		results = await cache.levels.findAll({where: {}});
		let levels = results.filter(level => level.name.toLowerCase().startsWith(focusedValue.toLowerCase()));
		if (levels.length > 25) levels = levels.slice(0, 25);
		await interaction.respond(
			levels.map(level => ({ name:level.name, value: level.name}))
		);
		
	},
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });

		if (interaction.options.getSubcommand() === 'place') {

			const { db } = require('../../index.js');
			const { getRegisteredKey, getUserPbId } = require('../../utils.js');

			const key = await getRegisteredKey(interaction);
			if (key==-1) return;

			const levelname = interaction.options.getString('levelname');
			const position = interaction.options.getInteger('position');
			const id = interaction.options.getInteger('id');
			const uploader = interaction.options.getString('uploader');
			const verifier = interaction.options.getString('verifier');
			const verification = interaction.options.getString('verification');
			const password = interaction.options.getString('password');
			const creator = interaction.options.getString('creator');
			const legacy = interaction.options.getBoolean('legacy');
			const mobile = interaction.options.getBoolean('mobile');


			let description = '\n';

			const uploader_id = await getUserPbId(interaction, uploader, key);
			if (uploader_id == -2) return;
			if (uploader_id == -1) description += `Couldn't find an account for ${uploader}, a new placeholder will be created.\n`;

			const verifier_id = await getUserPbId(interaction, verifier, key);
			if (verifier_id == -2) return;
			if (verifier_id == -1) description += `Couldn't find an account for ${verifier}, a new placeholder will be created.\n`;

			const creator_id = await getUserPbId(interaction, creator, key);
			if (creator_id == -2) return;
			if (creator_id == -1) description += `Couldn't find an account for ${creator}, a new placeholder will be created.\n`;

			
			const placeEmbed = new EmbedBuilder()
				.setColor(0x8fce00)
				.setTitle(`Placing ${levelname} at #${position}`)
				.setDescription(description)
				.addFields(
					{ name: 'ID:', value: `${id}`, inline: true },
					{ name: 'Uploader:', value: `${uploader}`, inline: true },
					{ name: 'Creator:', value: `${creator}`, inline: true },
					{ name: 'Verifier:', value: `${verifier}`, inline: true },
					{ name: 'Verification:', value: `${verification}`, inline: true },
					{ name: 'Password:', value: `${password ?? 'None'}`, inline: true },
					{ name: 'Legacy:', value: `${legacy ?? 'false'}`, inline: true },
					{ name: 'Mobile Verification:', value: `${mobile ?? 'false'}`, inline: true },
					{ name: 'Position:', value: `${position}`, inline: true },
				)
				.setTimestamp();
		
			// Create commit buttons
			const confirm = new ButtonBuilder()
				.setCustomId('confirmLevelPlace')
				.setLabel('Confirm')
				.setStyle(ButtonStyle.Success);

			const row = new ActionRowBuilder()
				.addComponents(confirm);

			await interaction.editReply({ embeds: [placeEmbed], components: [row] });
			
			await db.levelsToPlace.create({
				levelname: levelname,
				position: position,
				levelid: id,
				uploader: uploader,
				verifier: verifier,
				creator: creator,
				verification: verification,
				password: password,
				mobile: mobile,
				legacy: legacy,
				discordid: (await interaction.fetchReply()).id,
			});
		} else if (interaction.options.getSubcommand() === 'move') {
			const { pb, cache } = require('../../index.js');
			const { getRegisteredKey, getUserPbId } = require('../../utils.js');

			const level = await cache.levels.findOne({where: {name: interaction.options.getString('levelname')}});
			const position = interaction.options.getInteger('position');
			const legacy = interaction.options.getBoolean('legacy') ?? false;

			if (!level) return await interaction.editReply(':x: This level is not on the list');

			const key = await getRegisteredKey(interaction);
			if (key==-1) return;

			try {
				await pb.send('/api/aredl/mod/level/update', {
					method: 'POST', query: {'id': level.pb_id, 'position': position, 'legacy': legacy}, headers: {'api-key': key}
				});
			} catch(err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to move levels on the website');
				else return await interaction.editReply(`:x: Couldn't move the level: ${JSON.stringify(err.response)}`);
			}

			console.log(`${interaction.user.tag} (${interaction.user.id}) moved ${level.name} to ${position} )`);
			
			await interaction.editReply(':white_check_mark: The level was moved successfully');
			const cacheUpdate = require('../../scheduled/cacheUpdate.js');
			cacheUpdate.execute();
			return;
		}
	},
};