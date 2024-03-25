const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ActionRowBuilder } = require('discord.js');

const { archiveRecordsID, acceptedRecordsID, recordsID, enableSeparateStaffServer, guildId, staffGuildId } = require('../config.json');
const { db, pb } = require('../index.js');
const { getRegisteredKey } = require('../utils.js');

module.exports = {
	customId: 'accept',
	ephemeral: true,
	async execute(interaction) {

		// Accepting a record //

		// Check for record info corresponding to the message id
		const record = await db.dbPendingRecords.findOne({ where: { discordid: interaction.message.id } });
		if (!record) {
			await interaction.editReply(':x: Couldn\'t find a record linked to that discord message ID');
			try {
				await interaction.message.delete();
			} catch (error) {
				console.log(error);
			}
			return;
		}
		
		const key = await getRegisteredKey(interaction);
		if (!key) return;

		try {
			console.log(await pb.send('/api/aredl/mod/submission/accept', {
				method: 'POST',
				query: {
					'id': record.pocketbaseId
				},
				headers: {
					'api-key': key
				}
			}));
		} catch (error) {
			if (error.status == 403) return await interaction.editReply(':x: You do not have the permission to accept submissions');
			else return await interaction.editReply(`:x: Something went wrong while accepting this record :\n${JSON.stringify(error.response)}`);
		}

		const acceptEmbed = new EmbedBuilder()
			.setColor(0x8fce00)
			.setTitle(`:white_check_mark: ${record.levelname}`)
			.addFields(
				{ name: 'Record accepted by', value: `${interaction.user}`, inline: true },
				{ name: 'Record holder', value: `${record.username}`, inline: true },
			)
			.setTimestamp();

		// Remove messages from pending
		try {
			await interaction.message.delete();
			if (record.embedDiscordid != null) await (await interaction.message.channel.messages.fetch(record.embedDiscordid)).delete();
		} catch (error) {
			await interaction.editReply(':x: The record has already been accepted/denied, or something went wrong while deleting the messages from pending');
			console.log(error);
			return;
		}

		// Create embed to send in archive with all record info
		const archiveEmbed = new EmbedBuilder()
			.setColor(0x8fce00)
			.setTitle(`:white_check_mark: ${record.levelname}`)
			.addFields(
				{ name: 'Record holder', value: `${record.username}`, inline: true },
				{ name: 'Record accepted by', value: `${interaction.user}` },
				{ name: 'Device', value: `${record.device}`, inline: true },
				{ name: 'LDM', value: `${(record.ldm == 0 ? 'None' : record.ldm)}`, inline: true },
				{ name: 'Completion link', value: `${record.completionlink}` },
				{ name: 'Raw link', value: `${(record.raw == '' ? 'None' : record.raw)}` },
				{ name: 'Additional Info', value: `${(record.additionalnotes == '' ? 'None' : record.additionalnotes)}` },
			)
			.setTimestamp();

		// Create embed to send in public channel
		const publicEmbed = new EmbedBuilder()
			.setColor(0x8fce00)
			.setTitle(`:white_check_mark:  ${record.levelname} `)
			.setDescription('Accepted\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800')
			.addFields(
				{ name: 'Record holder', value: `${record.username}`, inline: true },
				{ name: 'Device', value: `${record.device}`, inline: true },
			);

		// Send all messages simultaneously
		const guild = await interaction.client.guilds.fetch(guildId);
		const staffGuild = (enableSeparateStaffServer ? await interaction.client.guilds.fetch(staffGuildId) : guild);

		staffGuild.channels.cache.get(acceptedRecordsID).send({ embeds: [acceptEmbed] });
		staffGuild.channels.cache.get(archiveRecordsID).send({ embeds: [archiveEmbed] });
		guild.channels.cache.get(recordsID).send({ embeds: [publicEmbed] });
		guild.channels.cache.get(recordsID).send({ content : `${record.completionlink}` });

		// Update moderator data (create new entry if that moderator hasn't accepted/denied records before)
		const modInfo = await db.staffStats.findOne({ where: { moderator: interaction.user.id } });
		if (!modInfo) {
			await db.staffStats.create({
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
		await db.dbPendingRecords.destroy({ where: { discordid: record.discordid } });
		// Add record to accepted table
		try {
			await db.dbAcceptedRecords.create({
				username: record.username,
				levelname: record.levelname,
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

		if (!(await db.dailyStats.findOne({ where: { date: Date.now() } }))) db.dailyStats.create({ date: Date.now(), nbRecordsAccepted: 1, nbRecordsPending: await db.dbPendingRecords.count() });
		else await db.dailyStats.update({ nbRecordsAccepted: (await db.dailyStats.findOne({ where: { date: Date.now() } })).nbRecordsAccepted + 1 }, { where: { date: Date.now() } });

		console.log(`${interaction.user.id} accepted record of ${record.levelname} for ${record.username}`);
		// Reply
		return await interaction.editReply(':white_check_mark: The record has been accepted');

	},
};