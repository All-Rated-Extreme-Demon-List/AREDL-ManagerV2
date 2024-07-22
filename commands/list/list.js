const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { githubOwner, githubRepo, githubDataPath, githubBranch } = require('../../config.json');

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
						.setDescription('The GD password of the level to place')))
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
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('tolegacy')
				.setDescription('Moves a level to the top of the legacy list')
				.addStringOption(option =>
					option.setName('levelname')
						.setDescription('The name of the level to move')
						.setAutocomplete(true)
						.setMinLength(1)
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('fromlegacy')
				.setDescription('Moves a level from the legacy list to the main list')
				.addStringOption(option =>
					option.setName('levelname')
						.setDescription('The name of the level to move')
						.setAutocomplete(true)
						.setMinLength(1)
						.setRequired(true))
				.addIntegerOption(option =>
					option.setName('position')
						.setDescription('The position to place the level at')
						.setRequired(true))),
	async autocomplete(interaction) {
		const focused = interaction.options.getFocused();
		const { cache } = require('../../index.js');
		const subcommand = interaction.options.getSubcommand();

		let results;
		results = subcommand === "fromlegacy" ? await cache.legacy.findAll({where: {}}) : await cache.levels.findAll({where: {}});

		let levels = results.filter(level => level.name.toLowerCase().includes(focused.toLowerCase()));
		if (levels.length > 25) levels = levels.slice(0, 25);
		await interaction.respond(
			levels.map(level => ({ name:level.name, value: level.filename}))
		);
	},
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true});

		if (interaction.options.getSubcommand() === 'place') {

			const { db, cache } = require('../../index.js');

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

			const levelBelow = await cache.levels.findOne({ where: { position: position } });
			const levelAbove = await cache.levels.findOne({ where: { position: position - 1 } });
			const placeEmbed = new EmbedBuilder()
				.setColor(0x8fce00)
				.setTitle(`Place Level: ${levelname}`)
				.setDescription(`**${levelname}** will be placed at **#${position}**, above **${levelBelow ? levelBelow.name : '-'}** and below **${levelAbove ? levelAbove.name : '-'}**`)
				.addFields(
					{ name: 'ID:', value: `${id}`, inline: true },
					{ name: 'Uploader:', value: `${uploader}`, inline: true },
					{ name: 'Creators:', value: `${strCreators.slice(0,1023)}`, inline: true },
					{ name: 'Verifier:', value: `${verifier}`, inline: true },
					{ name: 'Verification:', value: `${verification}`, inline: true },
					{ name: 'Password:', value: `${password}`, inline: true },
				)
				.setTimestamp();
			// Create commit buttons
			const commit = new ButtonBuilder()
				.setCustomId('commitAddLevel')
				.setLabel('Commit changes')
				.setStyle(ButtonStyle.Success);

			const row = new ActionRowBuilder()
				.addComponents(commit);

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
				return await interaction.editReply(':x: Something went wrong while adding the level; Please try again later');
			}
			return;
		} else if (interaction.options.getSubcommand() === 'move') {
			const { db, octokit } = require('../../index.js');

			const levelfile = interaction.options.getString('levelname');
			const position = interaction.options.getInteger('position');

			let list_response;
			try {
				list_response = await octokit.rest.repos.getContent({
					owner: githubOwner,
					repo: githubRepo,
					path: githubDataPath + '/_list.json',
					branch: githubBranch,
				});
			} catch (_) {
				return await interaction.editReply(':x: Something went wrong while fetching data from github, please try again later');
			}

			const list = JSON.parse(Buffer.from(list_response.data.content, 'base64').toString('utf-8'));

			const currentPosition = list.indexOf(levelfile);
			if (currentPosition == -1) return await interaction.editReply(':x: The level you are trying to move is not on the list');

			const levelAbove = (currentPosition + 1 < position ? list[position - 1] : list[position - 2]) ?? null;
			const levelBelow = (currentPosition + 1 < position ? list[position] : list[position - 1]) ?? null;

			const moveEmbed = new EmbedBuilder()
				.setColor(0x8fce00)
				.setTitle(`Move Level: ${levelfile}`)
				.setDescription(`**${levelfile}** will be ${currentPosition + 1 < position ? "lowered" : "raised"} to **#${position}**, above **${levelBelow ?? '-'}** and below **${levelAbove ?? '-'}**`)
				.setTimestamp();

			// Create commit buttons
			const commit = new ButtonBuilder()
				.setCustomId('commitMoveLevel')
				.setLabel('Commit changes')
				.setStyle(ButtonStyle.Success);

			const row = new ActionRowBuilder()
				.addComponents(commit);

			await interaction.editReply({ embeds: [moveEmbed], components: [row] });
			const sent = await interaction.fetchReply();

			try {
				await db.levelsToMove.create({
					filename: levelfile,
					position: position,
					discordid: sent.id,
				});
			} catch (error) {
				console.log(`Couldn't register the level to move ; something went wrong with Sequelize : ${error}`);
				return await interaction.editReply(':x: Something went wrong while moving the level; Please try again later');
			}
			return;
		} else if (interaction.options.getSubcommand() === 'tolegacy') {
			const { db, octokit } = require('../../index.js');

			const levelfile = interaction.options.getString('levelname');

			let list_response;
			try {
				list_response = await octokit.rest.repos.getContent({
					owner: githubOwner,
					repo: githubRepo,
					path: githubDataPath + '/_list.json',
					branch: githubBranch,
				});
				
			} catch (_) {
				return await interaction.editReply(':x: Something went wrong while fetching data from github, please try again later');
			}

			const list = JSON.parse(Buffer.from(list_response.data.content, 'base64').toString('utf-8'));
			const currentPosition = list.indexOf(levelfile);

			if (currentPosition == -1) return await interaction.editReply(':x: The level you are trying to move is not on the list');

			const moveEmbed = new EmbedBuilder()
				.setColor(0x8fce00)
				.setTitle(`Move to Legacy: ${levelfile}`)
				.setDescription(`**${levelfile}** will be moved from **#${currentPosition + 1}** to the top of the **legacy** list (**#${list.length}**)`)
				.setTimestamp();

			const commit = new ButtonBuilder()
				.setCustomId('commitLevelToLegacy')
				.setLabel('Commit changes')
				.setStyle(ButtonStyle.Success);

			const row = new ActionRowBuilder()
				.addComponents(commit);

			await interaction.editReply({ embeds: [moveEmbed], components: [row] });
			const sent = await interaction.fetchReply();

			try {
				await db.levelsToLegacy.create({
					filename: levelfile,
					discordid: sent.id,
				});
			} catch (error) {
				console.log(`Couldn't register the level to move ; something went wrong with Sequelize : ${error}`);
				return await interaction.editReply(':x: Something went wrong while moving the level; Please try again later');
			}
			return;
		} else if (interaction.options.getSubcommand() === 'fromlegacy') {
			const { db, octokit } = require('../../index.js');

			const levelfile = interaction.options.getString('levelname');
			const position = interaction.options.getInteger('position');

			let list_response;
			try {
				list_response = await octokit.rest.repos.getContent({
					owner: githubOwner,
					repo: githubRepo,
					path: githubDataPath + '/_list.json',
					branch: githubBranch,
				});
			} catch (_) {
				return await interaction.editReply(':x: Something went wrong while fetching data from github, please try again later');
			}

			const list = JSON.parse(Buffer.from(list_response.data.content, 'base64').toString('utf-8'));

			const levelAbove = list[position - 2] ?? null;
			const levelBelow = list[position - 1] ?? null;

			const moveEmbed = new EmbedBuilder()
				.setColor(0x8fce00)
				.setTitle(`Move Level: ${levelfile}`)
				.setDescription(`**${levelfile}** will be moved from **legacy** to **#${position}**, above **${levelBelow ?? '-'}** and below **${levelAbove ?? '-'}**`)
				.setTimestamp();

			// Create commit buttons
			const commit = new ButtonBuilder()
				.setCustomId('commitLevelFromLegacy')
				.setLabel('Commit changes')
				.setStyle(ButtonStyle.Success);

			const row = new ActionRowBuilder()
				.addComponents(commit);

			await interaction.editReply({ embeds: [moveEmbed], components: [row] });
			const sent = await interaction.fetchReply();

			try {
				await db.levelsFromLegacy.create({
					filename: levelfile,
					position: position,
					discordid: sent.id,
				});
			} catch (error) {
				console.log(`Couldn't register the level to move ; something went wrong with Sequelize : ${error}`);
				return await interaction.editReply(':x: Something went wrong while moving the level; Please try again later');
			}
			return;
		}
	},
};