const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const Sequelize = require('sequelize');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const logger = require('log4js').getLogger();

module.exports = {
	cooldown: 5,
	enabled: true,
	data: new SlashCommandBuilder()
		.setName('recordmod')
		.setDescription('Staff record moderator commands')
		.setDMPermission(true)
		.addSubcommand(subcommand =>
			subcommand
				.setName('stats')
				.setDescription('Shows how many records you\'ve checked'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('modleaderboard')
				.setDescription('Shows list staff records leaderboard'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('recordsinfo')
				.setDescription('Shows info on people with the most pending/accepted/denied records')
				.addStringOption(option =>
					option.setName('type')
						.setDescription('Which records you want to check')
						.setRequired(true)
						.addChoices(
							{ name: 'Pending', value: 'pending' },
							{ name: 'Accepted', value: 'accepted' },
							{ name: 'Denied', value: 'denied' },
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('commit')
				.setDescription('Commits all the pending accepted records to github'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('commitdebug')
				.setDescription('Enables or disables commiting each file individually')
				.addStringOption(option =>
					option.setName('status')
						.setDescription('Enabled or Disabled')
						.setRequired(true)
						.addChoices(
							{ name: 'Enabled', value: 'enabled' },
							{ name: 'Disabled', value: 'disabled' },
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('commitreset')
				.setDescription('Removes all records from the list to commit (in case there are errored records)'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('enabledm')
				.setDescription('Enables sending the github code to you in dms whenever you accept a record')
				.addStringOption(option =>
					option.setName('status')
						.setDescription('Enable or disable this setting')
						.setRequired(true)
						.addChoices(
							{ name: 'Enabled', value: 'enabled' },
							{ name: 'Disabled', value: 'disabled' },
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('enablereminder')
				.setDescription('Enables the shifts reminder')
				.addStringOption(option =>
					option.setName('status')
						.setDescription('Enable or disable this setting')
						.setRequired(true)
						.addChoices(
							{ name: 'Enabled', value: 'enabled' },
							{ name: 'Disabled', value: 'disabled' },
						))),
	async execute(interaction) {

		const { db } = require('../../index.js');

		if (interaction.options.getSubcommand() === 'stats') {

			await interaction.deferReply({ ephemeral: true });
			// Shows mod stats

			const modId = interaction.user.id;

			const modInfo = await db.staffStats.findOne({ attribute: ['nbRecords', 'nbAccepted', 'nbDenied', 'updatedAt'], where: { moderator: modId } });

			if (!modInfo) {
				return await interaction.editReply(':x: You haven\'t accepted or denied any record yet');
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

			const renderer = new ChartJSNodeCanvas({ width: 800, height: 300, backgroundColour: 'white' });
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


		} else if (interaction.options.getSubcommand() === 'modleaderboard') {
			const { db } = require('../../index.js');
			await interaction.deferReply({ ephemeral: true });
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


		} else if (interaction.options.getSubcommand() === 'recordsinfo') {

			await interaction.deferReply({ ephemeral: true });

			const { db } = require('../../index.js');

			// Check submissions info //
			const submissionsType = interaction.options.getString('type');

			const selectedDb = (submissionsType === 'pending' ? db.pendingRecords : (submissionsType === 'accepted' ? db.acceptedRecords : db.deniedRecords));
			let strInfo = `Total records : ${await db.pendingRecords.count()} pending, ${await db.acceptedRecords.count()} accepted, ${await db.deniedRecords.count()} denied\n\n`;
			const users = await selectedDb.findAll({
				attributes: [
					'submitter',
					[Sequelize.fn('COUNT', '*'), 'total_count'],
				],
				group: ['submitter'],
				order: [[Sequelize.literal('total_count'), 'DESC']],
				limit: 30,
			});
			for (let i = 0; i < users.length; i++) {
				const pendingCount = await db.pendingRecords.count({ where: { submitter: users[i].submitter } });
				const acceptedCount = await db.acceptedRecords.count({ where: { submitter: users[i].submitter } });
				const deniedCount = await db.deniedRecords.count({ where: { submitter: users[i].submitter } });
				const submittedCount = pendingCount + acceptedCount + deniedCount;
				strInfo += `**${i + 1}** - <@${users[i].submitter}> - ${pendingCount} pending - (${submittedCount} submitted, ${acceptedCount} accepted, ${deniedCount} denied)\n`;
			}
			if (users.length > 30) strInfo += '...';

			const infoEmbed = new EmbedBuilder()
				.setColor(0xFFBF00)
				.setTitle(`Currently ${submissionsType} records users stats`)
				.setDescription(strInfo)
				.setTimestamp();

			return await interaction.editReply({ embeds: [infoEmbed] });
		} else if (interaction.options.getSubcommand() === 'enabledm') {

			await interaction.deferReply({ ephemeral: true });

			const { db } = require('../../index.js');

			// Update sqlite db
			const update = await db.staffSettings.update({ sendAcceptedInDM: interaction.options.getString('status') === 'enabled' }, { where: { moderator: interaction.user.id } });

			if (!update) {
				const create = await db.staffSettings.create({
					moderator: interaction.user.id,
					sendAcceptedInDM: interaction.options.getString('status') === 'enabled',
				});

				if (!create) return await interaction.editReply(':x: Something went wrong while executing the command');
			}
			return await interaction.editReply(`:white_check_mark: Changed setting to ${interaction.options.getString('status')}`);

		} else if (interaction.options.getSubcommand() === 'enablereminder') {

			await interaction.deferReply({ ephemeral: true });

			const { db } = require('../../index.js');

			// Update sqlite db
			const update = await db.staffSettings.update({ shiftReminder: interaction.options.getString('status') === 'enabled' }, { where: { moderator: interaction.user.id } });

			if (!update) {
				const create = await db.staffSettings.create({
					moderator: interaction.user.id,
					shiftReminder: interaction.options.getString('status') === 'enabled',
				});

				if (!create) return await interaction.editReply(':x: Something went wrong while executing the command');
			}
			return await interaction.editReply(`:white_check_mark: Changed setting to ${interaction.options.getString('status')}`);
		} else if (interaction.options.getSubcommand() === 'commit') {

			await interaction.deferReply();
			const { db } = require('../../index.js');

			await db.recordsToCommit.update({ discordid: interaction.id }, { where: {} });

			if (await db.recordsToCommit.count({ where: { discordid: interaction.id } }) == 0) return await interaction.editReply(':x: There are no pending accepted record to be commited');
			const commitEmbed = new EmbedBuilder()
				.setColor(0x8fce00)
				.setTitle('Commiting records')
				.addFields(
					{ name: 'Number of records:', value: `${await db.recordsToCommit.count({ where: { discordid: interaction.id } })}`, inline: true },
					{ name: 'Affected files:', value: `${(await db.recordsToCommit.findAll({ where: { discordid: interaction.id }, group: 'filename' })).length}`, inline: true },
				)
				.setTimestamp();
			// Create commit buttons
			const commit = new ButtonBuilder()
				.setCustomId('commitRecords')
				.setLabel('Commit changes')
				.setStyle(ButtonStyle.Success);

			const cancel = new ButtonBuilder()
				.setCustomId('removeMsg')
				.setLabel('Cancel')
				.setStyle(ButtonStyle.Danger);

			const row = new ActionRowBuilder()
				.addComponents(commit)
				.addComponents(cancel);

			await interaction.editReply({ embeds: [commitEmbed], components: [row] });
			const sent = await interaction.fetchReply();
			await db.recordsToCommit.update({ discordid: sent.id }, { where: { discordid: interaction.id } });
		} else if (interaction.options.getSubcommand() === 'commitdebug') {
			// Changes debug status

			await interaction.deferReply({ ephemeral: true });

			const { db } = require('../../index.js');

			// Update sqlite db
			const update = await db.infos.update({ status: (interaction.options.getString('status') === 'enabled') }, { where: { name: 'commitdebug' } });
			if (!update) return await interaction.editReply(':x: Something went wrong while executing the command');
			logger.info(`Changed debug status to ${interaction.options.getString('status')}`);
			return await interaction.editReply(`:white_check_mark: Changed debug status to ${interaction.options.getString('status')}`);

		} else if (interaction.options.getSubcommand() === 'commitreset') {

			await interaction.deferReply({ ephemeral: true });

			const { db } = require('../../index.js');

			await db.recordsToCommit.destroy({ where: {} });
			if (await db.recordsToCommit.count() == 0) return await interaction.editReply(':white_check_mark: The list was successfully reset');
			else return await interaction.editReply(':x: Something went wrong while removing records');
		}
	},
};
