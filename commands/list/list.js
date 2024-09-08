const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder } = require('discord.js');
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
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('renameuser')
				.setDescription('Renames a user')
				.addStringOption(option =>
					option.setName('user')
						.setDescription('The name of the user to rename')
						.setRequired(true)
						.setAutocomplete(true))
				.addStringOption(option =>
					option.setName('newname')
						.setDescription('The new name of the user')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('mutualvictors')
				.setDescription('Finds all victors that have beaten both levels')
				.addStringOption(option =>
					option.setName('level1')
						.setDescription('The name of the first level')
						.setAutocomplete(true)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('level2')
						.setDescription('The name of the second level')
						.setAutocomplete(true)
						.setRequired(true))),
	async autocomplete(interaction) {
		const focused = interaction.options.getFocused();
		const { cache } = require('../../index.js');
		const subcommand = interaction.options.getSubcommand();
		if (subcommand === 'renameuser') return await interaction.respond(
			(await 
				cache.users
				.findAll({where: {}})
			).filter(user => user.name.toLowerCase().includes(focused.toLowerCase()))
				.slice(0,25)
				.map(user => ({ name: user.name, value: user.user_id }))
			);
		else return await interaction.respond(
			(await 
				(subcommand === "fromlegacy" ? cache.legacy : cache.levels)
				.findAll({where: {}})
			).filter(level => level.name.toLowerCase().includes(focused.toLowerCase()))
				.slice(0,25)
				.map(level => ({ name: level.name, value: level.filename }))
			);
	},
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true});

		if (interaction.options.getSubcommand() === 'place') {

			const { db, cache } = require('../../index.js');
			const { Op, Sequelize } = require('sequelize');

			const levelname = interaction.options.getString('levelname');
			const position = interaction.options.getInteger('position');
			const id = interaction.options.getInteger('id');
			const uploaderName = interaction.options.getString('uploader');
			const verifierName = interaction.options.getString('verifier');
			const verification = interaction.options.getString('verification');
			const password = (interaction.options.getString('password') == null ? 'No Copy' : interaction.options.getString('password'));
			const rawCreators = interaction.options.getString('creators');
			const creatorNames = rawCreators ? rawCreators.split(',') : [];

			const uploader = await cache.users.findOne({ 
				where: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), {
					[Op.like]: uploaderName.toLowerCase()
				})
			});
			if (!uploader) {
				return await interaction.editReply(`:x: Uploader "${uploaderName}" not found.`);
			}
			const uploaderId = uploader.user_id;

			const verifier = await cache.users.findOne({ 
				where: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), {
					[Op.like]: verifierName.toLowerCase()
				})
			});
			if (!verifier) {
				return await interaction.editReply(`:x: Verifier "${verifierName}" not found.`);
			}
			const verifierId = verifier.user_id;

			const creatorIds = [];
			for (const creatorName of creatorNames) {
				const creator = await cache.users.findOne({ 
					where: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), {
						[Op.like]: creatorName.trim().toLowerCase()
					})
				});
				if (!creator) {
					return await interaction.editReply(`:x: Creator "${creatorName}" not found.`);
				}
				creatorIds.push(Number(creator.user_id));
			}

			const githubCode = `{\n\t"id": ${id},\n\t"name": "${levelname}",\n\t"author": ${uploaderId},\n\t"creators": ${JSON.stringify(creatorIds)},\n\t"verifier": ${verifierId},\n\t"verification": "${verification}",\n\t"percentToQualify": 100,\n\t"password": "${password}",\n\t"records" : []\n}`;

			const levelBelow = await cache.levels.findOne({ where: { position: position } });
			const levelAbove = await cache.levels.findOne({ where: { position: position - 1 } });
			const placeEmbed = new EmbedBuilder()
				.setColor(0x8fce00)
				.setTitle(`Place Level: ${levelname}`)
				.setDescription(`**${levelname}** will be placed at **#${position}**, above **${levelBelow ? levelBelow.name : '-'}** and below **${levelAbove ? levelAbove.name : '-'}**`)
				.addFields(
					{ name: 'ID:', value: `${id}`, inline: true },
					{ name: 'Uploader:', value: `${uploaderName}`, inline: true },
					{ name: 'Creators:', value: `${rawCreators.slice(0,1023)}`, inline: true },
					{ name: 'Verifier:', value: `${verifierName}`, inline: true },
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
		} else if (interaction.options.getSubcommand() === 'renameuser') {
			const { cache, octokit } = require('../../index.js');
			const { githubOwner, githubRepo, githubDataPath, githubBranch } = require('../../config.json');

			const userID = interaction.options.getString('user');
			const newname = interaction.options.getString('newname');

			const user = await cache.users.findOne({ where: { user_id: userID } });
			if (!user) return await interaction.editReply(':x: Couldn\'t find the user you are trying to rename');

			// Change user on github
			let name_map_response;	
			try {
				name_map_response = await octokit.rest.repos.getContent({
					owner: githubOwner,
					repo: githubRepo,
					path: githubDataPath + '/_name_map.json',
					branch: githubBranch,
				});

			} catch (fetchError) {
				console.log(`Failed to fetch _name_map.json: ${fetchError}`);
				return await interaction.editReply(':x: Something went wrong while renaming the user; please try again later');
			}

			const names = JSON.parse(Buffer.from(name_map_response.data.content, 'base64').toString('utf-8'));
			names[userID] = newname;

			const changes = [
				{
					path: githubDataPath + '/_name_map.json',
					content: JSON.stringify(names, null, '\t'),
				}
			];

			let commitSha;
			try {
				// Get the SHA of the latest commit from the branch
				const { data: refData } = await octokit.git.getRef({
					owner: githubOwner,
					repo: githubRepo,
					ref: `heads/${githubBranch}`,
				});
				commitSha = refData.object.sha;
			} catch (getRefErr) {
				console.log(`Failed to get the latest commit SHA: ${getRefErr}`);
				return await interaction.editReply(':x: Something went wrong while renaming the user; please try again later');
			}

			let treeSha;
			try {
				// Get the commit using its SHA
				const { data: commitData } = await octokit.git.getCommit({
					owner: githubOwner,
					repo: githubRepo,
					commit_sha: commitSha,
				});
				treeSha = commitData.tree.sha;
			} catch (getCommitErr) {
				console.log(`Failed to get the commit SHA: ${getCommitErr}`);
				return await interaction.editReply(':x: Something went wrong while renaming the user; please try again later');
			}

			let newTree;
			try {
				// Create a new tree with the changes
				newTree = await octokit.git.createTree({
					owner: githubOwner,
					repo: githubRepo,
					base_tree: treeSha,
					tree: changes.map(change => ({
						path: change.path,
						mode: '100644',
						type: 'blob',
						content: change.content,
					})),
				});
			} catch (createTreeErr) {
				console.log(`Failed to create a new tree: ${createTreeErr}`);
				return await interaction.editReply(':x: Something went wrong while renaming the user; please try again later');
			}

			let newCommit;
			try {
				// Create a new commit with this tree
				newCommit = await octokit.git.createCommit({
					owner: githubOwner,
					repo: githubRepo,
					message: `${interaction.user.tag} renamed ${user.name} to ${newname}`,
					tree: newTree.data.sha,
					parents: [commitSha],
				});
			} catch (createCommitErr) {
				console.log(`Failed to create a new commit: ${createCommitErr}`);
				return await interaction.editReply(':x: Something went wrong while renaming the user; please try again later');
			}

			try {
				// Update the branch to point to the new commit
				await octokit.git.updateRef({
					owner: githubOwner,
					repo: githubRepo,
					ref: `heads/${githubBranch}`,
					sha: newCommit.data.sha,
				});
			} catch (updateRefErr) {
				console.log(`Failed to update the branch: ${updateRefErr}`);
				return await interaction.editReply(':x: Something went wrong while renaming the user; please try again later');
			}

			const { db } = require('../../index.js');
			try {
				await db.pendingRecords.update({ username: newname }, { where: { username: user.name } });
				await db.acceptedRecords.update({ username: newname }, { where: { username: user.name } });
				await db.deniedRecords.update({ username: newname }, { where: { username: user.name } });
			} catch(error) {
				console.log(`Failed to update records (username change): ${error}`);
			}
			cache.updateUsers();
			console.log(`${interaction.user.tag} (${interaction.user.id}) renamed ${user.name} (${user.user_id}) to ${newname}`);
			return await interaction.editReply(`:white_check_mark: Successfully renamed **${user.name}** to **${newname}**`);

		} else if (interaction.options.getSubcommand() === 'mutualvictors') {
			const { cache, octokit } = require('../../index.js');
			const { Op, Sequelize } = require('sequelize');

			const level1 = interaction.options.getString('level1');
			const level2 = interaction.options.getString('level2');

			if (await cache.levels.findOne({ where: { filename: level1 } }) == null) return await interaction.editReply(`:x: Level **${level1}** not found`);
			if (await cache.levels.findOne({ where: { filename: level2 } }) == null) return await interaction.editReply(`:x: Level **${level2}** not found`);


			let level1_response, level2_response;	
			try {
				level1_response = await octokit.rest.repos.getContent({
					owner: githubOwner,
					repo: githubRepo,
					path: githubDataPath + `/${level1}.json`,
					branch: githubBranch,
				});

			} catch (fetchError) {
				console.log(`Failed to fetch ${level1}.json: ${fetchError}`);
				return await interaction.editReply(`:x: Failed to fetch data for **${level1}** from github; please try again later`);
			}

			try {
				level2_response = await octokit.rest.repos.getContent({
					owner: githubOwner,
					repo: githubRepo,
					path: githubDataPath + `/${level2}.json`,
					branch: githubBranch,
				});

			} catch (fetchError) {
				console.log(`Failed to fetch ${level2}.json: ${fetchError}`);
				return await interaction.editReply(`:x: Failed to fetch data for **${level2}** from github; please try again later`);
			}

			const victors1 = JSON.parse(Buffer.from(level1_response.data.content, 'base64').toString('utf-8'))?.records;
			const victors2 = JSON.parse(Buffer.from(level2_response.data.content, 'base64').toString('utf-8'))?.records;
			

			const mutualVictors = victors1.filter(victor1 => victors2.some(victor2 => victor2.user === victor1.user));
			const mutualVictorNames = await cache.users.findAll({
				where: {
					user_id: {
						[Op.in]: mutualVictors.map(victor => victor.user),
					},
				},
				attributes: ['name'],
			});

			const mutualVictorNamesString = mutualVictorNames.map(victor => victor.name).join('\n- ');
			const attachment = new AttachmentBuilder(Buffer.from("- " + mutualVictorNamesString)).setName(`mutual_victors_${level1}_${level2}.txt`);
			return await interaction.editReply({ content: `:white_check_mark: Found ${mutualVictorNames.length} mutual victors between **${level1}** and **${level2}**\n`, files: [attachment] });
		}
	},
};