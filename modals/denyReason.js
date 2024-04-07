const { EmbedBuilder, } = require('discord.js');
const { archiveRecordsID, deniedRecordsID, recordsID, guildId, staffGuildId, enableSeparateStaffServer } = require('../config.json');
const { dbDeniedRecords } = require('../index.js');

module.exports = {
	customId: 'denyReason',
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
		const reason = interaction.fields.getTextInputValue('denyReasonInput');

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

		// Update info in denied table
		await dbDeniedRecords.update({ denyReason: reason }, { where: { discordid: interaction.message.id } });

		// Reply

		console.log(`${interaction.user.id} entered deny reason '${reason}' of ${record.levelname} for ${record.username} submitted by ${record.submitter}`);

		return await interaction.reply({ content:':white_check_mark: The deny reason has been added', ephemeral:true });
	},
};