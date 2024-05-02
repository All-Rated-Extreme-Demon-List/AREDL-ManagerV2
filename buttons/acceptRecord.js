const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ActionRowBuilder } = require('discord.js');

const { archiveRecordsID, acceptedRecordsID, recordsID, enableSeparateStaffServer, guildId, staffGuildId } = require('../config.json');
const { db } = require('../index.js');

module.exports = {
	customId: 'accept',
	ephemeral: true,
	async execute(interaction) {

		// Accepting a record //

		// Check for record info corresponding to the message id
		const record = await db.pendingRecords.findOne({ where: { discordid: interaction.message.id } });
		if (!record) {
			await interaction.editReply(':x: Couldn\'t find a record linked to that discord message ID');
			try {
				await interaction.message.delete();
			} catch (error) {
				console.log(error);
			}
			return;
		}

		const shiftsLock = await db.infos.findOne({ where: { name: 'shifts' } });
		if (!shiftsLock || shiftsLock.status) return await interaction.editReply(':x: The bot is currently assigning shifts, please wait a few minutes before checking records.');

		// Create embed to send with github code
		const githubCode = `{\n\t\t"user": "${record.username}",\n\t\t"link": "${record.completionlink}",\n\t\t"percent": 100,\n\t\t"hz": 360` + (record.device == 'Mobile' ? ',\n\t\t"mobile": true\n}\n' : '\n}');
		const { cache } = require('../index.js');
		const level = await cache.levels.findOne({ where: {name: record.levelname}});
		try {
			await db.recordsToCommit.create({
				filename: level.filename,
				user: record.username,
				githubCode: githubCode,
				discordid: '',
			});
		}
		catch (error) {
			console.log(`Couldn't add record to the commit db :\n${error}`);
			return await interaction.reply(':x: Something went wrong while accepting the record');
		}

		const acceptEmbed = new EmbedBuilder()
			.setColor(0x8fce00)
			.setTitle(`:white_check_mark: ${record.levelname}`)
			.addFields(
				{ name: 'Record accepted by', value: `${interaction.user}`, inline: true },
				{ name: 'Record holder', value: `${record.username}`, inline: true },
				{ name: 'Github code', value: `\`\`\`json\n${githubCode}\n\`\`\`` },
			)
			.setTimestamp()
			.setFooter({ text: `Added to the commit list (currently ${await db.recordsToCommit.count()} pending accepted records to commit)` });

		// Create button to remove the message
		const remove = new ButtonBuilder()
			.setCustomId('removeMsg')
			.setLabel('Delete message')
			.setStyle(ButtonStyle.Danger);

		const row = new ActionRowBuilder()
			.addComponents(remove);

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
				{ name: 'Record submitted by', value: `<@${record.submitter}>`, inline: true },
				{ name: 'Record holder', value: `${record.username}`, inline: true },
				{ name: 'Record accepted by', value: `${interaction.user}` },
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
				{ name: 'Device', value: `${record.device}`, inline: true },
			);

		// Send all messages simultaneously
		const guild = await interaction.client.guilds.fetch(guildId);
		const staffGuild = (enableSeparateStaffServer ? await interaction.client.guilds.fetch(staffGuildId) : guild);

		staffGuild.channels.cache.get(acceptedRecordsID).send({ content: `${interaction.user}`, embeds: [acceptEmbed], components: [row] });
		staffGuild.channels.cache.get(archiveRecordsID).send({ embeds: [archiveEmbed] });
		guild.channels.cache.get(recordsID).send({ embeds: [publicEmbed] });
		guild.channels.cache.get(recordsID).send({ content : `${record.completionlink}` });

		// Check if we need to send in dms as well
		const settings = await db.staffSettings.findOne({ where: { moderator: interaction.user.id } });
		if (!settings) {
			await db.staffSettings.create({
				moderator: interaction.user.id,
				sendAcceptedInDM: false,
			});
		} else if (settings.sendAcceptedInDM) {
			try {
				const rawGithubCode = JSON.stringify({
					user: record.username,
					link: record.completionlink,
					percent: 100,
					hz: 360,
					...(record.device === 'Mobile' && { mobile: true }),
				}, null, '\t');

				const dmMessage = `Accepted record of ${record.levelname} for ${record.username}\nGithub Code:`;
				const dmMessage2 = `${rawGithubCode}`;
				await interaction.user.send({ content: dmMessage });
				await interaction.user.send({ content: dmMessage2 });
			} catch (_) {
				console.log(`Failed to send in moderator ${interaction.user.id} dms, ignoring send in dms setting`);
			}
		}

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
		await db.pendingRecords.destroy({ where: { discordid: record.discordid } });
		// Add record to accepted table
		try {
			await db.acceptedRecords.create({
				username: record.username,
				submitter: record.submitter,
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

		if (!(await db.dailyStats.findOne({ where: { date: Date.now() } }))) db.dailyStats.create({ date: Date.now(), nbRecordsAccepted: 1, nbRecordsPending: await db.pendingRecords.count() });
		else await db.dailyStats.update({ nbRecordsAccepted: (await db.dailyStats.findOne({ where: { date: Date.now() } })).nbRecordsAccepted + 1 }, { where: { date: Date.now() } });

		console.log(`${interaction.user.tag} (${interaction.user.id}) accepted record of ${record.levelname} for ${record.username} submitted by ${record.submitter}`);
		// Reply
		return await interaction.editReply(':white_check_mark: The record has been accepted');

	},
};