const { EmbedBuilder, } = require('discord.js');
const { archiveRecordsID, deniedRecordsID, recordsID, guildId, staffGuildId, enableSeparateStaffServer } = require('../config.json');
const { db } = require('../index.js');
const logger = require('log4js').getLogger();

module.exports = {
	customId: 'denyReason',
	async execute(interaction) {
		await interaction.deferReply({ephemeral: true});
		// Check for record info corresponding to the message id
		if (!interaction.message) return await interaction.editReply(':x: This form has expired');
		const record = await db.pendingRecords.findOne({ where: { discordid: interaction.message.id } });
		if (!record) {
			await interaction.editReply(':x: Couldn\'t find a record linked to that discord message ID');
			try {
				await interaction.message.delete();
			} catch (error) {
				logger.info(error);
			}
			return;
		}

		// Get reason from the text field
		const reason = interaction.fields.getTextInputValue('denyReasonInput');

		const shiftsLock = await db.infos.findOne({ where: { name: 'shifts' } });
		if (!shiftsLock || shiftsLock.status) return await interaction.editReply(':x: The bot is currently assigning shifts, please wait a few minutes before checking records.');

		// Add record to denied table
		try {
			await db.deniedRecords.create({
				username: record.username,
				submitter: record.submitter,
				levelname: record.levelname,
				device: record.device,
				completionlink: record.completionlink,
				raw: record.raw,
				ldm: record.ldm,
				additionalnotes: record.additionalnotes,
				priority: record.priority,
				denyReason: reason,
				moderator: interaction.user.id,
			});
		} catch (error) {
			logger.info(`Couldn't add the denied record ; something went wrong with Sequelize : ${error}`);
			return await interaction.editReply(':x: Something went wrong while adding the denied record to the database');
		}

		// Create embed with all record info to send in archive
		const denyArchiveEmbed = new EmbedBuilder()
			.setColor(0xcc0000)
			.setTitle(`:x: ${record.levelname}`)
			.addFields(
				{ name: 'Record submitted by', value: `<@${record.submitter}>`, inline: true },
				{ name: 'Record holder', value: `${record.username}`, inline: true },
				{ name: 'Record denied by', value: `<@${interaction.user.id}>` },
				{ name: 'Deny Reason', value: `${reason}` },
				{ name: 'Device', value: `${record.device}`, inline: true },
				{ name: 'LDM', value: `${(record.ldm == 0 ? 'None' : record.ldm)}`, inline: true },
				{ name: 'Completion link', value: `${record.completionlink}` },
				{ name: 'Raw link', value: `${record.raw}` },
				{ name: 'Additional Info', value: `${record.additionalnotes}` },
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

		const guild = await interaction.client.guilds.fetch(guildId);
		const staffGuild = (enableSeparateStaffServer ? await interaction.client.guilds.fetch(staffGuildId) : guild);
		// Send all messages (notify the submitter that the record was denied, expect for group submissions and duplicates)
		await staffGuild.channels.cache.get(archiveRecordsID).send({ embeds : [denyArchiveEmbed] });
		await staffGuild.channels.cache.get(deniedRecordsID).send({ embeds : [denyEmbed] });
		await guild.channels.cache.get(recordsID).send({ content : `<@${record.submitter}>`, embeds : [publicDenyEmbed] });

		// Remove message from pending
		try {
			await interaction.message.delete();
			if (record.embedDiscordid != null) await (await interaction.message.channel.messages.fetch(record.embedDiscordid)).delete();
		} catch (_) {
			await interaction.editReply(':x: The record has already been accepted/denied');
			return;
		}

		// Remove record from pending table
		await db.pendingRecords.destroy({ where: { discordid: record.discordid } });

		// Update moderator data
		const modInfo = await db.staffStats.findOne({ where: { moderator: interaction.user.id } });
		if (!modInfo) {
			await db.staffStats.create({
				moderator: interaction.user.id,
				nbRecords: 1,
				nbDenied: 1,
				nbAccepted: 0,
			});
		} else {
			await modInfo.increment('nbRecords');
			await modInfo.increment('nbDenied');
		}

		if (!(await db.dailyStats.findOne({ where: { date: Date.now() } }))) db.dailyStats.create({ date: Date.now(), nbRecordsDenied: 1, nbRecordsPending: await db.pendingRecords.count() });
		else await db.dailyStats.update({ nbRecordsDenied: (await db.dailyStats.findOne({ where: { date: Date.now() } })).nbRecordsDenied + 1 }, { where: { date: Date.now() } });

		// Reply
		logger.info(`${interaction.user.tag} (${interaction.user.id}) denied ${record.levelname} for ${record.username} submitted by ${record.submitter} (Reason: '${reason}')`);
		return await interaction.editReply(':white_check_mark: The record has been denied');
	},
};