const { EmbedBuilder } = require('discord.js');
const { archiveRecordsID, deniedRecordsID, recordsID } = require('../config.json');
const { dbDeniedRecords } = require('../index.js');

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
	},
};