const { EmbedBuilder } = require('discord.js');
const { ActionRowBuilder } = require('discord.js');
const { ButtonBuilder, ButtonStyle } = require('discord.js');

const { deniedRecordsID } = require('../config.json');
const { dbPendingRecords, dbDeniedRecords, staffStats, dbInfos } = require('../index.js');

module.exports = {
	customId: 'deny',
	ephemeral: true,
	async execute(interaction) {
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

		const shiftsLock = await dbInfos.findOne({ where: { name: 'shifts' } });
		if (!shiftsLock || shiftsLock.status) return await interaction.editReply(':x: The bot is currently assigning shifts, please wait a few minutes before checking records.');

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

		const denyReason = new ButtonBuilder()
			.setCustomId('denyReason')
			.setLabel('Enter a deny reason')
			.setStyle(ButtonStyle.Primary);
			
		const row = new ActionRowBuilder()
			.addComponents(denyReason);

		// Send in moderator dms
		let sent;
		try {
			sent = await interaction.user.send({ embeds: [denyEmbed], components: [row] });
		} catch (_) {
			console.log(`Failed to send in moderator ${interaction.user.id} dms, sending in denied record logs`);
			sent = await (await interaction.client.channels.cache.get(deniedRecordsID)).send({ embeds: [denyEmbed], components: [row] });
		}

		// Remove record from pending table
		await dbPendingRecords.destroy({ where: { discordid: record.discordid } });

		// Add record to denied table
		try {
			await dbDeniedRecords.create({
				username: record.username,
				submitter: record.submitter,
				levelname: record.levelname,
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

		const { dailyStats } = require('../index.js');

		if (!(await dailyStats.findOne({ where: { date: Date.now() } }))) dailyStats.create({ date: Date.now(), nbRecordsDenied: 1, nbRecordsPending: await dbPendingRecords.count() });
		else await dailyStats.update({ nbRecordsDenied: (await dailyStats.findOne({ where: { date: Date.now() } })).nbRecordsDenied + 1 }, { where: { date: Date.now() } });

		console.log(`${interaction.user.id} denied record of ${record.levelname} for ${record.username} submitted by ${record.submitter}`);
		// Reply
		return await interaction.editReply(':white_check_mark: The record has been denied');
	},
};