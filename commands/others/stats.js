const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Sequelize = require('sequelize');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

module.exports = {
	cooldown: 5,
	enabled: true,
	data: new SlashCommandBuilder()
		.setName('stats')
		.setDescription('Statistics about the server')
		.setDefaultMemberPermissions(0)
		.addSubcommand(subcommand =>
			subcommand
				.setName('checkedrecords')
				.setDescription('Shows info about all accepted and denied records'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('pendingrecords')
				.setDescription('Shows info about all pending and submitted records'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('servertraffic')
				.setDescription('Shows info about server members traffic')),

	async execute(interaction) {

		await interaction.deferReply({ ephemeral: true });

		if (interaction.options.getSubcommand() === 'checkedrecords') {

			const { db } = require('../../index.js');
			const minDate = new Date(new Date() - (30 * 24 * 60 * 60 * 1000));

			const statsData = await db.dailyStats.findAll({ where: { date: { [Sequelize.Op.gte]: minDate } }, order:[['date', 'ASC']] });

			const labels = [];
			const datasAccepted = [];
			const datasDenied = [];

			for (let i = 0; i < 30; i++) {
				labels.push(statsData[i].date);
				datasAccepted.push(statsData[i].nbRecordsAccepted);
				datasDenied.push(statsData[i].nbRecordsDenied);
			}

			const modsRenderer = new ChartJSNodeCanvas({ width: 1600, height: 600, backgroundColour: 'white' });
			const modsImage = await modsRenderer.renderToBuffer({
				// Build your graph passing option you want
				type: 'bar',
				data: {
					labels: labels,
					datasets: [
						{ label: 'Accepted Records', backgroundColor: 'green', data: datasAccepted },
						{ label: 'Denied Records', backgroundColor: 'red', data: datasDenied },
					],
				},
				options: { responsive: true, plugins: {
					legend: { position: 'top' },
					title: { display: true, text: 'Records activity from all moderators' } },
				},
			});

			const modsAttachment = await new AttachmentBuilder(modsImage, { name: 'modsgraph.png' });

			const nbAcceptedTotal = await db.acceptedRecords.count();
			const nbDeniedTotal = await db.deniedRecords.count();

			const nbAcceptedRecent = await db.acceptedRecords.count({
				where: { createdAt: { [Sequelize.Op.gte]: minDate } },
			});

			const nbDeniedRecent = await db.deniedRecords.count({
				where: { createdAt: { [Sequelize.Op.gte]: minDate } },
			});

			const modsStatsEmbed = new EmbedBuilder()
				.setColor(0xFFBF00)
				.setTitle('All accepted/denied records stats')
				.addFields(
					{ name: 'All Time :', value: ' ' },
					{ name: 'Total records checked:', value: `${nbAcceptedTotal + nbDeniedTotal}`, inline: true },
					{ name: 'Accepted records:', value: `${nbAcceptedTotal}`, inline: true },
					{ name: 'Denied records:', value: `${nbDeniedTotal}`, inline: true },
					{ name: 'Past 30 days :', value: ' ' },
					{ name: 'Records checked:', value: `${nbAcceptedRecent + nbDeniedRecent}`, inline: true },
					{ name: 'Accepted records:', value: `${nbAcceptedRecent}`, inline: true },
					{ name: 'Denied records:', value: `${nbDeniedRecent}`, inline: true },
				)
				.setImage('attachment://modsgraph.png');

			return await interaction.editReply({ embeds: [modsStatsEmbed], files: [modsAttachment] });

		} else if (interaction.options.getSubcommand() === 'pendingrecords') {
			const { db } = require('../../index.js');
			const minDate = new Date(new Date() - (30 * 24 * 60 * 60 * 1000));

			const statsData = await db.dailyStats.findAll({ where: { date: { [Sequelize.Op.gte]: minDate } }, order:[['date', 'ASC']] });

			const labels = [];
			const datasPending = [];
			const datasSubmitted = [];

			for (let i = 0; i < 30; i++) {
				labels.push(statsData[i].date);
				datasPending.push(statsData[i].nbRecordsPending);
				datasSubmitted.push(statsData[i].nbRecordsSubmitted);
			}

			const pendingRenderer = new ChartJSNodeCanvas({ width: 1600, height: 600, backgroundColour: 'white' });
			const pendingImage = await pendingRenderer.renderToBuffer({
				// Build your graph passing option you want
				data: {
					labels: labels,
					datasets: [
						{ type: 'line', label: 'Pending Records', backgroundColor: 'blue', borderColor: 'blue', data: datasPending },
						{ type: 'line', label: 'Submitted Records', backgroundColor: 'black', borderColor: 'black', data: datasSubmitted },
					],
				},
				options: { responsive: true, plugins: {
					legend: { position: 'top' },
					title: { display: true, text: 'Pending and submitted records over time' } },
				},
			});

			const pendingAttachment = await new AttachmentBuilder(pendingImage, { name: 'pendinggraph.png' });

			const totalSubmitted = datasSubmitted.reduce((a, b) => a + b, 0);
			const averagePending = (datasPending.reduce((a, b) => a + b, 0) / datasPending.length).toFixed(2);
			const averageSubmitted = (totalSubmitted / datasSubmitted.length).toFixed(2);

			const pendingStatsEmbed = new EmbedBuilder()
				.setColor(0xFFBF00)
				.setTitle('All pending records stats')
				.addFields(
					{ name: 'Total submitted records (in the past 30 days):', value: `${totalSubmitted}`, inline: true },
					{ name: 'Average submitted records per day:', value: `${averageSubmitted}`, inline: true },
					{ name: 'Average pending records per day:', value: `${averagePending}`, inline: true },
				)
				.setImage('attachment://pendinggraph.png');

			return await interaction.editReply({ embeds: [pendingStatsEmbed], files: [pendingAttachment] });

		} else if (interaction.options.getSubcommand() === 'servertraffic') {

			const { db } = require('../../index.js');
			const minDate = new Date(new Date() - (30 * 24 * 60 * 60 * 1000));

			const statsData = await db.dailyStats.findAll({ where: { date: { [Sequelize.Op.gte]: minDate } }, order:[['date', 'ASC']] });

			const labels = [];
			const datasJoined = [];
			const datasLeft = [];

			for (let i = 0; i < 30; i++) {
				labels.push(statsData[i].date);
				datasJoined.push(statsData[i].nbMembersJoined);
				datasLeft.push(-statsData[i].nbMembersLeft);
			}

			const membersRenderer = new ChartJSNodeCanvas({ width: 1600, height: 600, backgroundColour: 'white' });
			const membersImage = await membersRenderer.renderToBuffer({
				// Build your graph passing option you want
				type: 'bar',
				data: {
					labels: labels,
					datasets: [
						{ label: 'Members arrivals', backgroundColor: 'blue', data: datasJoined },
						{ label: 'Members leaves', backgroundColor: 'gray', data: datasLeft },
					],
				},
				options: { responsive: true, plugins: {
					legend: { position: 'top' },
					title: { display: true, text: 'Members traffic over time' } },
				},
			});

			const membersAttachment = await new AttachmentBuilder(membersImage, { name: 'membersgraph.png' });

			const totalJoined = datasJoined.reduce((a, b) => a + b, 0);
			const totalLeft = -datasLeft.reduce((a, b) => a + b, 0);

			const membersStatsEmbed = new EmbedBuilder()
				.setColor(0xFFBF00)
				.setTitle('Members traffic')
				.addFields(
					{ name: 'Past 30 days :', value: ' ' },
					{ name: 'Total arrivals:', value: `${totalJoined}`, inline: true },
					{ name: 'Total leaves:', value: `${totalLeft}`, inline: true },
				)
				.setImage('attachment://membersgraph.png');

			return await interaction.editReply({ embeds: [membersStatsEmbed], files: [membersAttachment] });


		}
	},
};