const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ActionRowBuilder } = require('discord.js');

const { archiveRecordsID, acceptedRecordsID, recordsID } = require('../config.json');
const { dbPendingRecords, dbAcceptedRecords, staffStats, staffSettings } = require('../index.js');

module.exports = {
	customId: 'accept',
	async execute(interaction) {

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

		// Check if we need to send in dms as well
		const settings = await staffSettings.findOne({ where: { moderator: interaction.user.id } });
		if (!settings) {
			await staffSettings.create({
				moderator: interaction.user.id,
				sendAcceptedInDM: false,
			});
		} else if (settings.sendAcceptedInDM) {
			try {
				const rawGithubCode = `{\n\t\t"user": "${record.username}",\n\t\t"link": "${record.completionlink}",\n\t\t"percent": 100,\n\t\t"hz": ${record.fps}` + (record.device == 'Mobile' ? ',\n\t\t"mobile": true\n}' : '\n}');
				const dmMessage = `Accepted record of ${record.levelname} for ${record.username}\nGithub Code:`;
				const dmMessage2 = `${rawGithubCode}`;
				await interaction.user.send({ content: dmMessage });
				await interaction.user.send({ content: dmMessage2 });
			} catch (_) {
				console.log(`Failed to send in moderator ${interaction.user.id} dms, ignoring send in dms setting`);
			}
		}

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

	},
};