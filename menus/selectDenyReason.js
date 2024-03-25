const { EmbedBuilder } = require('discord.js');
const { archiveRecordsID, deniedRecordsID, recordsID, guildId, staffGuildId, enableSeparateStaffServer } = require('../config.json');
const { db, pb } = require('../index.js');
const { getRegisteredKey } = require('../utils.js');

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
	customId: 'denySelect',
	async execute(interaction) {
		// Check for record info corresponding to the message id
		const record = await db.dbDeniedRecords.findOne({ where: { discordid: interaction.message.id } });
		if (!record) {
			return await interaction.editReply(':x: Couldn\'t find a record linked to that discord message ID');
		}

		if (record.denyReason != 'none') {
			return await interaction.editReply(':x: This deny reason has already been selected');
		}

		// Get reason from the menu
		const reason = denyReasons.get(interaction.values[0]);

		const key = await getRegisteredKey(interaction);
		if (!key) return;

		try {
			await pb.send('/api/aredl/mod/submission/reject', {
				method: 'POST',
				query: {
					'id': record.pocketbaseId,
					'rejection_reason': reason
				},
				headers: {
					'api-key': key
				}
			});
		} catch (error) {
			console.log(error);
			if (error.status == 403) return await interaction.editReply(':x: You do not have the permission to deny submissions');
			else return await interaction.editReply(`:x: Something went wrong while rejecting this record :\n${JSON.stringify(error.response)}`);
		}

		// Create embed with all record info to send in archive
		const denyArchiveEmbed = new EmbedBuilder()
			.setColor(0xcc0000)
			.setTitle(`:x: ${record.levelname}`)
			.addFields(
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
		if (interaction.values[0] != 'group' && interaction.values[0] != 'duplicate') await guild.channels.cache.get(recordsID).send({ embeds : [publicDenyEmbed] });
		else await guild.channels.cache.get(recordsID).send({ embeds : [publicDenyEmbed] });

		// Update info in denied table
		await db.dbDeniedRecords.update({ denyReason: interaction.values[0] }, { where: { discordid: interaction.message.id } });

		// Reply
		console.log(`${interaction.user.id} selected deny reason '${interaction.values[0]}' of ${record.levelname} for ${record.username}`);
		return await interaction.editReply(':white_check_mark: The deny reason has been selected');
	},
};