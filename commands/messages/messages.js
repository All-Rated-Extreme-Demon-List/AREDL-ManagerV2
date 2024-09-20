const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");


module.exports = {
	cooldown: 5,
	enabled: true,
	data: new SlashCommandBuilder()
		.setName("embed")
		.setDescription("Bot messages management")
		.addSubcommand(subcommand =>
			subcommand
				.setName("create")
				.setDescription("Creates a new message")
				.addStringOption(option =>
					option
						.setName("name")
						.setDescription("Internal name of the message, to be able to edit it later")
						.setRequired(true)
				)
				.addChannelOption(option =>
					option
						.setName("channel")
						.setDescription("Channel to send the embed in")
						.setRequired(true)
				)
				.addStringOption(option =>
					option
						.setName("content")
						.setDescription("The content of the message to send")
						.setMaxLength(2000)
						.setRequired(true)
				)
		),
		async execute(interaction) {
			const { db } = require("../..");
			const subcommand = interaction.options.getSubcommand();
			await interaction.deferReply({ ephemeral: true});

			if (subcommand === "create") {
				const name = interaction.options.getString("name");
				const channel = interaction.options.getChannel("channel");
				const content = interaction.options.getString("content");

				if (await db.messages.findOne({ where: { name:name, guild: interaction.guild.id } }))
					return await interaction.editReply({ content: ":x: A message with that name already exists in this server"});

				const channelResolved = await interaction.guild.channels.cache.get(channel.id);
				if (!channelResolved)
					return await interaction.editReply({ content: ":x: Invalid channel"});

				const confirm = new ButtonBuilder()
					.setCustomId('confirmMessage')
					.setLabel('Send Embed')
					.setStyle(ButtonStyle.Success);

				const cancel = new ButtonBuilder()
					.setCustomId('cancelMessage')
					.setLabel('Cancel')
					.setStyle(ButtonStyle.Danger);

				const row = new ActionRowBuilder()
					.addComponents(confirm)
					.addComponents(cancel);

				try {
					await interaction.editReply({ content: content, components: [row]});
				} catch (error) {
					return await interaction.editReply({ content: `:x: Failed to create the message: ${error}`});
				}

				await db.messages.create({
					name: name,
					guild: interaction.guild.id,
					channel: channel.id,
					discordid: interaction.message.id,
					sent: false,
				});
			}
		}
}