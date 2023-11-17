const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const { dbRecords, dbInfos } = require('../../index.js');
const { pendingRecordsID, priorityRoleID, priorityRecordsID, submissionLockRoleID } = require('../../config.json');


module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('record')
		.setDescription('Record handling')
		.setDMPermission(false)
		.addSubcommand(subcommand =>
			subcommand
				.setName('submit')
				.setDescription('Submit a record for the list')
				.addStringOption(option =>
					option.setName('username')
						.setDescription('The name that will show up on records and the leaderboard (KEEP CONSISTENT BETWEEN RECORDS)')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('levelname')
						.setDescription('Name of the level you\'re submitting for (check to see if it\'s on the list first)')
						.setRequired(true))
				.addIntegerOption(option =>
					option.setName('fps')
						.setDescription('FPS used to complete the level (360 at most)')
						.setRequired(true)
						.setMinValue(0)
						.setMaxValue(360))
				.addStringOption(option =>
					option.setName('device')
						.setDescription('Device the level was completed on')
						.setRequired(true)
						.addChoices(
							{ name: 'PC', value: 'PC' },
							{ name: 'Mobile', value: 'Mobile' },
						))
				.addStringOption(option =>
					option.setName('completionlink')
						.setDescription('Link to the completion')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('raw')
						.setDescription('Link to your raw footage (Optional, required for top 250 levels)'))
				.addIntegerOption(option =>
					option.setName('ldm')
						.setDescription('ID for the external LDM you used (Optional)'))
				.addStringOption(option =>
					option.setName('additionalnotes')
						.setDescription('Any other info you\'d like to share with us (Optional)')))
		.addSubcommand(subcommand =>
			subcommand
				.setName('status')
				.setDescription('Check the status of pending records')),
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });

		if (interaction.options.getSubcommand() === 'submit') {

			// Record submitting

			// Check list banned
			if (interaction.member.roles.cache.has(submissionLockRoleID)) {
				await interaction.editReply(':x: Couldn\'t submit the record : You have been banned from submitting records');
				return;
			}

			// Check record submission status
			const dbStatus = await dbInfos.findOne({ where: { id: 1 } });
			if (!dbStatus) return await interaction.editReply(':x: Something wrong happened while executing the command; please try again later');

			if (dbStatus.status) {
				await interaction.editReply(':x: Couldn\'t submit the record : Submissions are closed at the moment');
				return;
			}

			// Check given URL
			try { new URL(interaction.options.getString('completionlink')); } catch (_) {
				await interaction.editReply(':x: Couldn\'t submit the record : The provided completion link is not a valid URL');
				return;
			}

			// Create accept/deny buttons
			const accept = new ButtonBuilder()
				.setCustomId('accept')
				.setLabel('Accept')
				.setStyle(ButtonStyle.Success);

			const deny = new ButtonBuilder()
				.setCustomId('deny')
				.setLabel('Deny')
				.setStyle(ButtonStyle.Danger);

			const row = new ActionRowBuilder()
				.addComponents(accept)
				.addComponents(deny);

			// Embed with record data to send in pending-record-log
			const recordEmbed = new EmbedBuilder()
				.setColor(0x005c91)
				.setTitle(`${interaction.options.getString('levelname')}`)
				.addFields(
					{ name: 'Record submitted by', value: `<@${interaction.user.id}>` },
					{ name: 'Record holder', value: `${interaction.options.getString('username')}` },
					{ name: 'FPS', value: `${interaction.options.getInteger('fps')}`, inline: true },
					{ name: 'Device', value: `${interaction.options.getString('device')}`, inline: true },
					{ name: 'LDM', value: `${(interaction.options.getInteger('ldm') == null ? 'None' : interaction.options.getInteger('ldm'))}`, inline: true },
					{ name: 'Completion link', value: `${interaction.options.getString('completionlink')}` },
					{ name: 'Raw link', value: `${(interaction.options.getString('raw') == null ? 'None' : interaction.options.getString('raw'))}` },
					{ name: 'Additional Info', value: `${(interaction.options.getString('additionalnotes') == null ? 'None' : interaction.options.getString('additionalnotes'))}` },
				)
				.setTimestamp();

			// Send message
			const sent = await interaction.guild.channels.cache.get((interaction.member.roles.cache.has(priorityRoleID) ? priorityRecordsID : pendingRecordsID)).send({ embeds: [recordEmbed], components: [row] });

			// Add record to sqlite db
			try {
				await dbRecords.create({
					username: interaction.options.getString('username'),
					submitter: interaction.user.id,
					levelname: interaction.options.getString('levelname'),
					fps: interaction.options.getInteger('fps'),
					device: interaction.options.getString('device'),
					completionlink: interaction.options.getString('completionlink'),
					raw: 'None',
					ldm: 0,
					additionalnotes: 'None',
					discordid: sent.id,
					priority: interaction.member.roles.cache.has(priorityRoleID),
				});
			} catch (error) {
				console.log(`Couldn't register the record ; something went wrong with Sequelize : ${error}`);
				await sent.delete();
				return await interaction.editReply(':x: Something went wrong while submitting the record; Please try again later');
			}

			// Check for and add optionnal values to db
			if (interaction.options.getString('raw') != null) await dbRecords.update({ raw: interaction.options.getString('raw') }, { where: { discordid: sent.id } });
			if (interaction.options.getInteger('ldm') != null) await dbRecords.update({ ldm: interaction.options.getInteger('ldm') }, { where: { discordid: sent.id } });
			if (interaction.options.getString('additionalnotes') != null) await dbRecords.update({ additionalnotes: interaction.options.getString('additionalnotes') }, { where: { discordid: sent.id } });

			// Reply
			await interaction.editReply((interaction.member.roles.cache.has(priorityRoleID) ? ':white_check_mark: The priority record has been submitted successfully' : ':white_check_mark: The record has been submitted successfully'));

		} else if (interaction.options.getSubcommand() === 'status') {

			// Check record submissions status

			// Get records info
			const nbRecords = await dbRecords.count({ where: { priority: false } });
			const nbPriorityRecords = await dbRecords.count({ where: { priority: true } });
			const dbStatus = await dbInfos.findOne({ where: { id: 1 } });

			if (!dbStatus) return await interaction.editReply(':x: Something wrong happened while executing the command; please try again later');

			// Create embed to display records info
			const statusMsg = (dbStatus.status ? 'Records are closed. Records can not be submitted, but can be accepted!' : 'Records are open and are able to be submitted and accepted!');
			const color = (dbStatus.status ? 0xcc0000 : 0x8fce00);
			const statusEmbed = new EmbedBuilder()
				.setColor(color)
				.setTitle((dbStatus.status ? ':x:' : ':white_check_mark:') + ' Record Status')
				.addFields(
					{ name: 'Pending records:', value: `**${nbRecords}**`, inline: true },
					{ name: 'Pending Priority Records:', value: `**${nbPriorityRecords}**`, inline: true },
					{ name: 'Status:', value: `${(dbStatus.status ? '**CLOSED**' : '**OPENED**')}`, inline: true },
					{ name: '\u200B', value: `${statusMsg}`, inline: true },
				)
				.setTimestamp();

			// Send message and reply
			await interaction.channel.send({ embeds : [statusEmbed] });
			await interaction.editReply('Executed command');
		}
	},
};
