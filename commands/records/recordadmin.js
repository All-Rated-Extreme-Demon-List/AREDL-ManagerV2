const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { guildId, staffGuildId, enableSeparateStaffServer, pendingRecordsID, priorityRecordsID, enablePriorityRole } = require('../../config.json');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const Sequelize = require('sequelize');

module.exports = {
	cooldown: 5,
	enabled: true,
	data: new SlashCommandBuilder()
		.setName('recordadmin')
		.setDescription('Staff record administration commands')
		.setDMPermission(true)
		.setDefaultMemberPermissions(0)
		.addSubcommand(subcommand =>
			subcommand
				.setName('setstatus')
				.setDescription('Set the state of record submission')
				.addStringOption(option =>
					option.setName('status')
						.setDescription('Status')
						.setRequired(true)
						.addChoices(
							{ name: 'Open', value: 'open' },
							{ name: 'Closed', value: 'closed' },
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('modleaderboard')
				.setDescription('Shows list staff records leaderboard '))
		.addSubcommand(subcommand =>
			subcommand
				.setName('modinfo')
				.setDescription('Shows a list staff activity')
				.addUserOption(option =>
					option.setName('moderator')
						.setDescription('The moderator you want to check the activity of')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('check')
				.setDescription('Checks for errored record data')),
	async execute(interaction) {

		const { db } = require('../../index.js');

		await interaction.deferReply({ ephemeral: true });

		if (interaction.options.getSubcommand() === 'setstatus') {

			// Changes record status

			// Update sqlite db
			const update = await db.infos.update({ status: interaction.options.getString('status') === 'closed' }, { where: { name: 'records' } });

			if (!update) return await interaction.editReply(':x: Something went wrong while executing the command');
			console.log(`Changed record status to ${interaction.options.getString('status')}`);
			return await interaction.editReply(`:white_check_mark: Changed record status to ${interaction.options.getString('status')}`);

		} else if (interaction.options.getSubcommand() === 'modleaderboard') {

			// Display staff records leaderboard //

			// Get number of staff
			const nbTotal = await db.staffStats.count();
			// Get sqlite data, ordered by descending number of records, limited to top 20 for now (maybe add a page system later)
			const modInfos = await db.staffStats.findAll({ limit: 30, order: [ ['nbRecords', 'DESC'] ], attributes: ['moderator', 'nbRecords', 'nbAccepted', 'nbDenied', 'updatedAt'] });
			if (!nbTotal || !modInfos) return await interaction.editReply(':x: Something went wrong while executing the command');

			let strModData = '';
			for (let i = 0; i < modInfos.length; i++) {
				strModData += `**${i + 1}** - <@${modInfos[i].moderator}> - ${modInfos[i].nbRecords} records (${modInfos[i].nbAccepted} A, ${modInfos[i].nbDenied} D) - Last activity : ${modInfos[i].updatedAt.toDateString()}\n`;
			}

			// Embed displaying the data
			const modEmbed = new EmbedBuilder()
				.setColor(0xFFBF00)
				.setAuthor({ name: 'Moderator leaderboard' })
				.setDescription(strModData)
				.setTimestamp();

			// Send reply
			return await interaction.editReply({ embeds: [ modEmbed ] });


		} else if (interaction.options.getSubcommand() === 'modinfo') {

			// Display a list staff activity info

			const modId = interaction.options.getUser('moderator').id;

			const modInfo = await db.staffStats.findOne({ attribute: ['nbRecords', 'nbAccepted', 'nbDenied', 'updatedAt'], where: { moderator: modId } });

			if (!modInfo) {
				return await interaction.editReply(':x: This moderator hasn\'t accepted or denied any record');
			}

			const minDate = new Date(new Date() - (30 * 24 * 60 * 60 * 1000));
			const modAcceptedData = await db.acceptedRecords.findAll({
				attributes: [
					[Sequelize.literal('DATE("createdAt")'), 'date'],
					[Sequelize.literal('COUNT(*)'), 'count'],
				],
				group: ['date'],
				where: { moderator: modId, createdAt: { [Sequelize.Op.gte]: minDate } },
			});

			const modDeniedData = await db.deniedRecords.findAll({
				attributes: [
					[Sequelize.literal('DATE("createdAt")'), 'date'],
					[Sequelize.literal('COUNT(*)'), 'count'],
				],
				group: ['date'],
				where: { moderator: modId, createdAt: { [Sequelize.Op.gte]: minDate } },
			});

			const labels = [];
			const datasA = [];
			const datasD = [];
			const date = new Date();

			const isRightDate = function(element) {
				return !element.dataValues['date'].localeCompare(this);
			};

			for (let i = 0; i < 30; i++) {
				labels.push(date.toJSON().slice(0, 10));
				date.setDate(date.getDate() - 1);

				const acceptedIndex = modAcceptedData.findIndex(isRightDate, labels[i]);
				const deniedIndex = modDeniedData.findIndex(isRightDate, labels[i]);

				if (acceptedIndex != -1) datasA.push(modAcceptedData[acceptedIndex].dataValues['count']);
				else datasA.push(0);

				if (deniedIndex != -1) datasD.push(modDeniedData[deniedIndex].dataValues['count']);
				else datasD.push(0);

			}

			labels.reverse();
			datasA.reverse();
			datasD.reverse();

			const renderer = new ChartJSNodeCanvas({ width: 1600, height: 600, backgroundColour: 'white' });
			const image = await renderer.renderToBuffer({
				// Build your graph passing option you want
				type: 'bar',
				data: {
					labels: labels,
					datasets: [
						{
							label: 'Accepted Records',
							backgroundColor: 'green',
							data: datasA,
						},
						{
							label: 'Denied Records',
							backgroundColor: 'red',
							data: datasD,
						},
					],
				},
				options: {
					responsive: true,
					plugins: {
						legend: {
							position: 'top',
						},
						title: {
							display: true,
							text: 'Moderator activity',
						},
					},
				},
			});

			const attachment = await new AttachmentBuilder(image, { name: 'modgraph.png' });
			const modInfoEmbed = new EmbedBuilder()
				.setColor(0xFFBF00)
				.setTitle('Moderator info')
				.setDescription(`<@${modId}>`)
				.addFields(
					{ name: 'Total records checked:', value: `${modInfo.nbRecords}`, inline: true },
					{ name: 'Accepted records:', value: `${modInfo.nbAccepted}`, inline: true },
					{ name: 'Denied records:', value: `${modInfo.nbDenied}`, inline: true },
					{ name: 'Last activity:', value: `${modInfo.updatedAt.toDateString()}` },
				)
				.setImage('attachment://modgraph.png');

			return await interaction.editReply({ embeds: [ modInfoEmbed ], files: [attachment] });

		} else if (interaction.options.getSubcommand() === 'check') {

			// Clears errored records //

			console.log('Looking for errored records...');
			const pendingRecords = await db.pendingRecords.findAll();
			let nbFound = 0;
			const guild = await interaction.client.guilds.fetch((enableSeparateStaffServer ? staffGuildId : guildId));
			const pendingChannel = await guild.channels.cache.get(pendingRecordsID);
			const priorityChannel = (enablePriorityRole ? await guild.channels.cache.get(priorityRecordsID) : pendingChannel);
			for (let i = 0; i < pendingRecords.length; i++) {
				try {
					if (enablePriorityRole && pendingRecords[i].priority) await priorityChannel.messages.fetch(pendingRecords[i].discordid);
					else await pendingChannel.messages.fetch(pendingRecords[i].discordid);
				} catch (_) {
					await db.pendingRecords.destroy({ where: { discordid: pendingRecords[i].discordid } });
					nbFound++;
					console.log(`Found an errored record : ${pendingRecords[i].discordid}`);

					// Try deleting the other message as well in case only the first one is missing smh
					try {
						if (enablePriorityRole && pendingRecords[i].priority) await (await priorityChannel.messages.fetch(pendingRecordsID[i].embedDiscordid)).delete();
						else await (await pendingChannel.messages.fetch(pendingRecords[i].embedDiscordid)).delete();
					} catch (__) {
						// Nothing to do
					}
				}
			}
			console.log(`Found a total of ${nbFound} records.`);
			return await interaction.editReply(`:white_check_mark: ${nbFound} records missing from the pending channel were found, and removed from the database.`);


		}
	},
};
