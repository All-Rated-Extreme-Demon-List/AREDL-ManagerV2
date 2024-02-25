const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { dbShifts } = require('../../index.js');

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('shift')
		.setDescription('List staff shifts management commands')
		.setDefaultMemberPermissions(0)
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Assign a shift to a moderator')
				.addUserOption(option =>
					option.setName('moderator')
						.setDescription('Moderator to assign the shift to')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('day')
						.setDescription('Day of the shift')
						.setRequired(true)
						.addChoices(
							{ name: 'Monday', value: 'Monday' },
							{ name: 'Tuesday', value: 'Tuesday' },
							{ name: 'Wednesday', value: 'Wednesday' },
							{ name: 'Thursday', value: 'Thursday' },
							{ name: 'Friday', value: 'Friday' },
							{ name: 'Saturday', value: 'Saturday' },
							{ name: 'Sunday', value: 'Sunday' },
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('remove')
				.setDescription('Remove a shift from a moderator')
				.addUserOption(option =>
					option.setName('moderator')
						.setDescription('Moderator to remove the shift from')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('day')
						.setDescription('Day of the shift')
						.setRequired(true)
						.addChoices(
							{ name: 'Monday', value: 'Monday' },
							{ name: 'Tuesday', value: 'Tuesday' },
							{ name: 'Wednesday', value: 'Wednesday' },
							{ name: 'Thursday', value: 'Thursday' },
							{ name: 'Friday', value: 'Friday' },
							{ name: 'Saturday', value: 'Saturday' },
							{ name: 'Sunday', value: 'Sunday' },
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('Shows all assigned shifts')),
	async execute(interaction) {

		await interaction.deferReply({ ephemeral: true });

		if (interaction.options.getSubcommand() === 'add') {

			const mod = interaction.options.getUser('moderator');
			const day = interaction.options.getString('day');

			if (await dbShifts.count({ where: { moderator: mod.id } }) == 3) return await interaction.editReply(':x: This moderator already has 3 shifts assigned');

			const addedShift = await dbShifts.create({ moderator: mod.id, day: day });
			if (addedShift) return await interaction.editReply(`:white_check_mark: Successfully added ${day} shift for ${mod}`);
			else return await interaction.editReply(`:x: Couldn't add ${day} shift for ${mod}`);


		} else if (interaction.options.getSubcommand() === 'remove') {

			const mod = interaction.options.getUser('moderator');
			const day = interaction.options.getString('day');

			if (await dbShifts.count({ where: { moderator: mod.id, day: day } }) == 0) return await interaction.editReply(':x: This moderator does not have any assigned shift on that day');

			await dbShifts.destroy({ where: { moderator: mod.id, day: day } });
			if (await dbShifts.count({ where: { moderator: mod.id, day: day } }) == 0) return await interaction.editReply(`:white_check_mark: Successfully removed ${day} shift for ${mod}`);
			else return interaction.editReply(`:x: Couldn't remove ${day} shift for ${mod}, something went wrong`);

		} else if (interaction.options.getSubcommand() === 'list') {

			if (await dbShifts.count() === 0) return await interaction.editReply(':x: There are no assigned shifts yet');

			const shifts = await dbShifts.findAll({ where: {} });
			const shiftsList = { 'Monday':'', 'Tuesday':'', 'Wednesday':'', 'Thursday':'', 'Friday':'', 'Saturday':'', 'Sunday':'' };
			let shiftStr = '';

			for (const shift of shifts) shiftsList[shift.day] += '<@' + shift.moderator + '> ';
			for (const shiftDay of Object.keys(shiftsList)) shiftStr += `**${shiftDay}**: ${shiftsList[shiftDay]} \n`;

			const shiftsEmbed = new EmbedBuilder()
				.setColor(0x005c91)
				.setTitle('Shifts')
				.setDescription(shiftStr)
				.setTimestamp();

			await interaction.editReply({ embeds: [shiftsEmbed] });
		}
	},
};