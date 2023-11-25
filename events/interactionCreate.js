const { Events } = require('discord.js');
const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Collection } = require('discord.js');
const { ActionRowBuilder } = require('discord.js');
const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

const { archiveRecordsID, acceptedRecordsID, deniedRecordsID, recordsID } = require('../config.json');
const { dbPendingRecords, dbAcceptedRecords, dbDeniedRecords, staffStats } = require('../index.js');

// Get deny text from deny reason identifier
const denyReasons = new Map()
	.set('none', 'No reason has been selected, please contact a list moderator')
	.set('illegitimate', 'The completion doesn\'t comply with the guidelines. Please make sure to check our guidelines on the website before submitting a record.')
	.set('raw', 'Please resubmit with raw footage')
	.set('ldm', 'The LDM used in the completion does not comply with the guidelines')
	.set('duplicate', 'The submission has been sent more than once.')
	.set('hacked', 'The completion was deemed to be hacked')
	.set('invalid', 'The specified level is not on the list')
	.set('form', 'The submission was filled out incorrectly')
	.set('joke', 'Please only submit serious submissions. The staff team does not have the time to deal with your bullshit')
	.set('group', 'Please only provide one level per submission')
	.set('run', 'The submission is not a run from 0% to 100%, or does not include the endscreen');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {

		if (interaction.isChatInputCommand()) {

			// Chat command //

			// Check command's name
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			const { cooldowns } = interaction.client;

			// Check if there's a cooldown
			if (!cooldowns.has(command.data.name)) {
				cooldowns.set(command.data.name, new Collection());
			}

			const now = Date.now();
			const timestamps = cooldowns.get(command.data.name);
			const defaultCooldownDuration = 3;
			const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;

			if (timestamps.has(interaction.user.id)) {
				const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

				if (now < expirationTime) {
					const expiredTimestamp = Math.round(expirationTime / 1000);
					return interaction.reply({ content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`, ephemeral: true });
				}
			}

			timestamps.set(interaction.user.id, now);
			setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

			// Execute command
			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(`Error executing ${interaction.commandName}`);
				console.error(error);
			}
		} else if (interaction.isButton()) {

			// Handle button interactions //

			await interaction.deferReply({ ephemeral: true });

			if (interaction.customId == 'accept') {

				// Accepting a record //

				// Check for record info corresponding to the message id
				const record = await dbPendingRecords.findOne({ where: { discordid: interaction.message.id } });
				if (!record) {
					await interaction.editReply(':x: Couldn\'t find a record linked to that discord message ID');
					try {
						await interaction.message.delete();
					} catch (error) {
						console.log(error);
					}
					return;
				}

				// Remove messages from pending
				try {
					await interaction.message.delete();
					if (record.embedDiscordid != null) await (await interaction.message.channel.messages.fetch(record.embedDiscordid)).delete();
				} catch (error) {
					await interaction.editReply(':x: The record has already been accepted/denied, or something went wrong while deleting the messages from pending');
					console.log(error);
					return;
				}

				// Create embed to send with github code
				const githubCode = `\`\`\`json\n{\n\t\t"user": "${record.username}",\n\t\t"link": "${record.completionlink}",\n\t\t"percent": 100,\n\t\t"hz": ${record.fps}` + (record.device == 'Mobile' ? ',\n\t\t"mobile": true\n}\n```' : '\n}\n```');
				const acceptEmbed = new EmbedBuilder()
					.setColor(0x8fce00)
					.setTitle(`:white_check_mark: ${record.levelname}`)
					.addFields(
						{ name: 'Record accepted by', value: `<@${interaction.user.id}>`, inline: true },
						{ name: 'Record holder', value: `${record.username}`, inline: true },
						{ name: 'Github code', value: `${githubCode}` },
					)
					.setTimestamp();

				// Create button to remove the message
				const remove = new ButtonBuilder()
					.setCustomId('removeMsg')
					.setLabel('Delete message')
					.setStyle(ButtonStyle.Danger);

				const row = new ActionRowBuilder()
					.addComponents(remove);

				// Create embed to send in archive with all record info
				const archiveEmbed = new EmbedBuilder()
					.setColor(0x8fce00)
					.setTitle(`:white_check_mark: ${record.levelname}`)
					.addFields(
						{ name: 'Record submitted by', value: `<@${record.submitter}>`, inline: true },
						{ name: 'Record holder', value: `${record.username}`, inline: true },
						{ name: 'Record accepted by', value: `<@${interaction.user.id}>` },
						{ name: 'FPS', value: `${record.fps}`, inline: true },
						{ name: 'Device', value: `${record.device}`, inline: true },
						{ name: 'LDM', value: `${(record.ldm == 0 ? 'None' : record.ldm)}`, inline: true },
						{ name: 'Completion link', value: `${record.completionlink}` },
						{ name: 'Raw link', value: `${(record.raw == '' ? 'None' : record.raw)}` },
						{ name: 'Additional Info', value: `${(record.additionalnotes == '' ? 'None' : record.additionalnotes)}` },
						{ name: 'Github code', value: `${githubCode}` },
					)
					.setTimestamp();

				// Create embed to send in public channel
				const publicEmbed = new EmbedBuilder()
					.setColor(0x8fce00)
					.setTitle(`:white_check_mark:  ${record.levelname} `)
					.setDescription('Accepted\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800')
					.addFields(
						{ name: 'Record holder', value: `${record.username}`, inline: true },
						{ name: 'FPS', value: `${record.fps}`, inline: true },
						{ name: 'Device', value: `${record.device}`, inline: true },
					);

				// Send all messages simultaneously
				interaction.guild.channels.cache.get(acceptedRecordsID).send({ content: `<@${interaction.user.id}>`, embeds: [acceptEmbed], components: [row] });
				interaction.guild.channels.cache.get(archiveRecordsID).send({ embeds: [archiveEmbed] });
				interaction.guild.channels.cache.get(recordsID).send({ embeds: [publicEmbed] });
				interaction.guild.channels.cache.get(recordsID).send({ content : `${record.completionlink}` });

				// Update moderator data (create new entry if that moderator hasn't accepted/denied records before)
				const modInfo = await staffStats.findOne({ where: { moderator: interaction.user.id } });
				if (!modInfo) {
					await staffStats.create({
						moderator: interaction.user.id,
						nbRecords: 1,
						nbDenied: 0,
						nbAccepted: 1,
					});
				} else {
					await modInfo.increment('nbRecords');
					await modInfo.increment('nbAccepted');
				}

				// Remove record from pending table
				await dbPendingRecords.destroy({ where: { discordid: record.discordid } });
				// Add record to accepted table
				try {
					await dbAcceptedRecords.create({
						username: record.username,
						submitter: record.submitter,
						levelname: record.levelname,
						fps: record.fps,
						device: record.device,
						completionlink: record.completionlink,
						raw: record.raw,
						ldm: record.ldm,
						additionalnotes: record.additionalnotes,
						priority: record.priority,
						moderator: interaction.user.id,
					});
				} catch (error) {
					console.log(`Couldn't add the accepted record ; something went wrong with Sequelize : ${error}`);
					return await interaction.editReply(':x: Something went wrong while adding the accepted record to the database');
				}

				console.log(`${interaction.user.id} accepted record of ${record.levelname} for ${record.username} submitted by ${record.submitter}`);
				// Reply
				return await interaction.editReply(':white_check_mark: The record has been accepted');

			} else if (interaction.customId == 'deny') {

				// Denying a record //

				// Check for record info corresponding to the message id
				const record = await dbPendingRecords.findOne({ where: { discordid: interaction.message.id } });
				if (!record) {
					await interaction.editReply(':x: Couldn\'t find a record linked to that discord message ID');
					try {
						await interaction.message.delete();
					} catch (error) {
						console.log(error);
					}
					return;
				}

				// Remove message from pending
				try {
					await interaction.message.delete();
					if (record.embedDiscordid != null) await (await interaction.message.channel.messages.fetch(record.embedDiscordid)).delete();
				} catch (_) {
					await interaction.editReply(':x: The record has already been accepted/denied');
					return;
				}

				// Create embed to send in dms
				const denyEmbed = new EmbedBuilder()
					.setColor(0xcc0000)
					.setTitle(':x: Denied record')
					.addFields(
						{ name: 'Level name', value: `${record.levelname}`, inline: true },
						{ name: 'Record holder', value: `${record.username}`, inline: true },
					)
					.setTimestamp();

				// Create menu deny selection selectmenu
				const denySelect = new StringSelectMenuBuilder()
					.setCustomId('denySelect')
					.setPlaceholder('Deny : select a reason')
					.addOptions(
						new StringSelectMenuOptionBuilder()
							.setLabel('Illegitimate')
							.setDescription('The completion doesn\'t comply with the guidelines.')
							.setValue('illegitimate'),
						new StringSelectMenuOptionBuilder()
							.setLabel('Resubmit with raw')
							.setDescription('Please resubmit with raw footage')
							.setValue('raw'),
						new StringSelectMenuOptionBuilder()
							.setLabel('Invalid LDM')
							.setDescription('The LDM used in the completion does not comply with the guidelines')
							.setValue('ldm'),
						new StringSelectMenuOptionBuilder()
							.setLabel('Duplicate Submission')
							.setDescription('The submission has been sent more than once.')
							.setValue('duplicate'),
						new StringSelectMenuOptionBuilder()
							.setLabel('Invalid Level')
							.setDescription('The specified level is not on the list.')
							.setValue('invalid'),
						new StringSelectMenuOptionBuilder()
							.setLabel('Hacked')
							.setDescription('The completion was deemed to be hacked')
							.setValue('hacked'),
						new StringSelectMenuOptionBuilder()
							.setLabel('Invalid Form')
							.setDescription('The submission was filled out incorrectly.')
							.setValue('form'),
						new StringSelectMenuOptionBuilder()
							.setLabel('Joke Submission')
							.setDescription('Please only submit serious submissions.')
							.setValue('joke'),
						new StringSelectMenuOptionBuilder()
							.setLabel('Group Submission')
							.setDescription('Please only provide one level per submission.')
							.setValue('group'),
						new StringSelectMenuOptionBuilder()
							.setLabel('Incomplete Run')
							.setDescription('The submission is not a run from 0% to 100%, or does not include the endscreen')
							.setValue('run'),
					);

				const row = new ActionRowBuilder()
					.addComponents(denySelect);

				// Send in moderator dms
				const sent = await interaction.user.send({ embeds: [denyEmbed], components: [row] });

				// Remove record from pending table
				await dbPendingRecords.destroy({ where: { discordid: record.discordid } });

				// Add record to denied table
				try {
					await dbDeniedRecords.create({
						username: record.username,
						submitter: record.submitter,
						levelname: record.levelname,
						fps: record.fps,
						device: record.device,
						completionlink: record.completionlink,
						raw: record.raw,
						ldm: record.ldm,
						additionalnotes: record.additionalnotes,
						priority: record.priority,
						discordid: sent.id,
						denyReason: 'none',
						moderator: interaction.user.id,
					});
				} catch (error) {
					console.log(`Couldn't add the denied record ; something went wrong with Sequelize : ${error}`);
					return await interaction.editReply(':x: Something went wrong while adding the denied record to the database');
				}

				// Update moderator data
				const modInfo = await staffStats.findOne({ where: { moderator: interaction.user.id } });
				if (!modInfo) {
					await staffStats.create({
						moderator: interaction.user.id,
						nbRecords: 1,
						nbDenied: 1,
						nbAccepted: 0,
					});
				} else {
					await modInfo.increment('nbRecords');
					await modInfo.increment('nbDenied');
				}

				console.log(`${interaction.user.id} denied record of ${record.levelname} for ${record.username} submitted by ${record.submitter}`);
				// Reply
				return await interaction.editReply(':white_check_mark: The record has been denied');

			} else if (interaction.customId === 'removeMsg') {

				// Remove message

				try {
					await interaction.message.delete();
					return await interaction.editReply(':white_check_mark: Message deleted');
				} catch (error) {
					console.log(error);
					return await interaction.editReply(':x: Something went wrong');
				}
			}

		} else if (interaction.isStringSelectMenu) {

			// Selecting deny reason //

			await interaction.deferReply({ ephemeral: true });

			// Check for record info corresponding to the message id
			const record = await dbDeniedRecords.findOne({ where: { discordid: interaction.message.id } });
			if (!record) {
				return await interaction.editReply(':x: Couldn\'t find a record linked to that discord message ID');
			}

			if (record.denyReason != 'none') {
				return await interaction.editReply(':x: This deny reason has already been selected');
			}

			// Get reason from the menu
			const reason = denyReasons.get(interaction.values[0]);

			// Create embed with all record info to send in archive
			const denyArchiveEmbed = new EmbedBuilder()
				.setColor(0xcc0000)
				.setTitle(`:x: ${record.levelname}`)
				.addFields(
					{ name: 'Record submitted by', value: `<@${record.submitter}>`, inline: true },
					{ name: 'Record holder', value: `${record.username}`, inline: true },
					{ name: 'Record denied by', value: `<@${interaction.user.id}>` },
					{ name: 'Deny Reason', value: `${reason}` },
					{ name: 'FPS', value: `${record.fps}`, inline: true },
					{ name: 'Device', value: `${record.device}`, inline: true },
					{ name: 'LDM', value: `${(record.ldm == 0 ? 'None' : record.ldm)}`, inline: true },
					{ name: 'Completion link', value: `${record.completionlink}` },
					{ name: 'Raw link', value: `${(record.raw == '' ? 'None' : record.raw)}` },
					{ name: 'Additional Info', value: `${(record.additionalnotes == '' ? 'None' : record.additionalnotes)}` },
				)
				.setTimestamp();

			// Create embed to send in denied-record-log
			const denyEmbed = new EmbedBuilder()
				.setColor(0xcc0000)
				.setTitle(`:x: ${record.levelname}`)
				.addFields(
					{ name: 'Record submitted by', value: `<@${record.submitter}>`, inline: true },
					{ name: 'Record holder', value: `${record.username}`, inline: true },
					{ name: 'Record denied by', value: `<@${interaction.user.id}>` },
					{ name: 'Deny Reason', value: `${reason}` },
					{ name: 'FPS', value: `${record.fps}`, inline: true },
					{ name: 'Device', value: `${record.device}`, inline: true },
					{ name: 'LDM', value: `${(record.ldm == 0 ? 'None' : record.ldm)}`, inline: true },
					{ name: 'Completion link', value: `${record.completionlink}` },
				)
				.setTimestamp();

			// Create embed to send in public channel
			const publicDenyEmbed = new EmbedBuilder()
				.setColor(0xcc0000)
				.setTitle(`:x: ${record.levelname}`)
				.setDescription('Denied\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800')
				.addFields(
					{ name: 'Record holder', value: `${record.username}` },
					{ name: 'Deny Reason', value: `${reason}` },
				);

			// Send all messages (notify the submitter that the record was denied, expect for group submissions and duplicates)
			await interaction.client.channels.cache.get(archiveRecordsID).send({ embeds : [denyArchiveEmbed] });
			await interaction.client.channels.cache.get(deniedRecordsID).send({ embeds : [denyEmbed] });
			if (interaction.values[0] != 'group' && interaction.values[0] != 'duplicate') await interaction.client.channels.cache.get(recordsID).send({ content : `<@${record.submitter}>`, embeds : [publicDenyEmbed] });
			else await interaction.client.channels.cache.get(recordsID).send({ embeds : [publicDenyEmbed] });

			// Update info in denied table
			await dbDeniedRecords.update({ denyReason: interaction.values[0] }, { where: { discordid: interaction.message.id } });

			// Reply

			console.log(`${interaction.user.id} selected deny reason '${interaction.values[0]}' of ${record.levelname} for ${record.username} submitted by ${record.submitter}`);

			return await interaction.editReply(':white_check_mark: The deny reason has been selected');

		} else { return; }
	},
};
