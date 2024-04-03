const { EmbedBuilder } = require('discord.js');
const { ActionRowBuilder } = require('discord.js');
const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

const { deniedRecordsID } = require('../config.json');
const { db, pb } = require('../index.js');
const { getRegisteredKey } = require('../utils.js');

module.exports = {
	customId: 'deny',
	ephemeral: true,
	async execute(interaction) {
		// Denying a record //
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

		const shiftsLock = await db.infos.findOne({where:{name:'shifts'}});
		if (!shiftsLock || shiftsLock.status) return await interaction.editReply(':x: Records are disabled because the bot is currently assigning shifts, please try again later');

		const key = await getRegisteredKey(interaction);
		if (key==-1) return;

		let user_perms;
		try {
			user_perms = await pb.send('/api/me/permissions', {
				headers: {
					'api-key': key
				}
			});
		} catch (error) {
			if (error.status == 403) return await interaction.editReply(':x: Your API key is invalid, please register it again with /aredl login');
			else return await interaction.editReply(`:x: Something went wrong while rejecting this record :\n${JSON.stringify(error.response)}`);
		}
		if (!Object.hasOwn(user_perms, 'aredl.submission_review')) return await interaction.editReply(':x: You do not have the permission to deny submissions');

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
					.setLabel('Physics Bypass')
					.setDescription('The usage of physics bypass in 2.2 is not allowed')
					.setValue('physicsbypass'),
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
		let sent;
		try {
			sent = await interaction.user.send({ embeds: [denyEmbed], components: [row] });
		} catch (_) {
			console.log(`Failed to send in moderator ${interaction.user.id} dms, sending in denied record logs`);
			sent = await (await interaction.client.channels.cache.get(deniedRecordsID)).send({ embeds: [denyEmbed], components: [row] });
		}

		// Remove record from pending table
		await db.pendingRecords.destroy({ where: { discordid: record.discordid } });

		// Add record to denied table
		try {
			await db.deniedRecords.create({
				username: record.username,
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
				pocketbaseId: record.pocketbaseId,
			});
		} catch (error) {
			console.log(`Couldn't add the denied record ; something went wrong with Sequelize : ${error}`);
			return await interaction.editReply(':x: Something went wrong while adding the denied record to the database');
		}

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

		console.log(`${interaction.user.tag} (${interaction.user.id}) denied record of ${record.levelname} for ${record.username}`);
		// Reply
		return await interaction.editReply(':white_check_mark: The record has been denied');
	},
};