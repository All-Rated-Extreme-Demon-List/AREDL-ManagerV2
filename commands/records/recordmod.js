const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const Sequelize = require('sequelize');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

module.exports = {
	cooldown: 5,
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
				.setName('commit')
				.setDescription('Commits all the pending accepted records to github'))
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
						))),
	async execute(interaction) {

		const { staffStats, dbAcceptedRecords, dbDeniedRecords } = require('../../index.js');

		if (interaction.options.getSubcommand() === 'stats') {

			await interaction.deferReply({ ephemeral: true });
			// Shows mod stats

			const modId = interaction.user.id;

			const modInfo = await staffStats.findOne({ attribute: ['nbRecords', 'nbAccepted', 'nbDenied', 'updatedAt'], where: { moderator: modId } });

			if (!modInfo) {
				return await interaction.editReply(':x: You haven\'t accepted or denied any record yet');
			}

			const minDate = new Date(new Date() - (30 * 24 * 60 * 60 * 1000));
			const modAcceptedData = await dbAcceptedRecords.findAll({
				attributes: [
					[Sequelize.literal('DATE("createdAt")'), 'date'],
					[Sequelize.literal('COUNT(*)'), 'count'],
				],
				group: ['date'],
				where: { moderator: modId, createdAt: { [Sequelize.Op.gte]: minDate } },
			});

			const modDeniedData = await dbDeniedRecords.findAll({
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


		} else if (interaction.options.getSubcommand() === 'enabledm') {

			await interaction.deferReply({ ephemeral: true });

			const { staffSettings } = require('../../index.js');

			// Update sqlite db
			const update = await staffSettings.update({ sendAcceptedInDM: interaction.options.getString('status') === 'enabled' }, { where: { moderator: interaction.user.id } });

			if (!update) {
				const create = await staffSettings.create({
					moderator: interaction.user.id,
					sendAcceptedInDM: interaction.options.getString('status') === 'enabled',
				});

				if (!create) return await interaction.editReply(':x: Something went wrong while executing the command');
			}
			return await interaction.editReply(`:white_check_mark: Changed setting to ${interaction.options.getString('status')}`);
		} else if (interaction.options.getSubcommand() === 'commit') {

			await interaction.deferReply();
			const { dbRecordsToCommit } = require('../../index.js');

			await dbRecordsToCommit.update({ discordid: interaction.id }, { where: {} });

			if (await dbRecordsToCommit.count({ where: { discordid: interaction.id } }) == 0) return await interaction.editReply(':x: There are no pending accepted record to be commited');
			const commitEmbed = new EmbedBuilder()
				.setColor(0x8fce00)
				.setTitle('Commiting records')
				.addFields(
					{ name: 'Number of records:', value: `${await dbRecordsToCommit.count({ where: { discordid: interaction.id } })}`, inline: true },
					{ name: 'Affected files:', value: `${(await dbRecordsToCommit.findAll({ where: { discordid: interaction.id }, group: 'filename' })).length}`, inline: true },
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
			await dbRecordsToCommit.update({ discordid: sent.id }, { where: { discordid: interaction.id } });
		}
	},
};
