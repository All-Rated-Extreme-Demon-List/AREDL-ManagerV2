const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const Sequelize = require('sequelize');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

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
			const modAcceptedData = await db.dbAcceptedRecords.findAll({
				attributes: [
					[Sequelize.literal('DATE("createdAt")'), 'date'],
					[Sequelize.literal('COUNT(*)'), 'count'],
				],
				group: ['date'],
				where: { moderator: modId, createdAt: { [Sequelize.Op.gte]: minDate } },
			});

			const modDeniedData = await db.dbDeniedRecords.findAll({
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

		} else if (interaction.options.getSubcommand() === 'recordsinfo') {

			await interaction.deferReply({ ephemeral: true });

			const { db } = require('../../index.js');

			// Check submissions info //
			const submissionsType = interaction.options.getString('type');

			const selectedDb = (submissionsType === 'pending' ? db.dbPendingRecords : (submissionsType === 'accepted' ? db.dbAcceptedRecords : db.dbDeniedRecords));
			let strInfo = `Total records : ${await db.dbPendingRecords.count()} pending, ${await db.dbAcceptedRecords.count()} accepted, ${await db.dbDeniedRecords.count()} denied\n\n`;
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
				const pendingCount = await db.dbPendingRecords.count({ where: { submitter: users[i].submitter } });
				const acceptedCount = await db.dbAcceptedRecords.count({ where: { submitter: users[i].submitter } });
				const deniedCount = await db.dbDeniedRecords.count({ where: { submitter: users[i].submitter } });
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
		}
	},
};
