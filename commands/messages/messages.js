const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");

module.exports = {
	cooldown: 5,
	enabled: true,
	data: new SlashCommandBuilder()
		.setName("message")
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
						.setDescription("Channel to send the message in")
						.setRequired(true)
				)
		),
	async execute(interaction) {
		const { db } = require("../..");
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === "create") {
			const name = interaction.options.getString("name");
			const channel = interaction.options.getChannel("channel");

			if (await db.messages.findOne({ where: { name: name, guild: interaction.guild.id } })) {
				return await interaction.reply({ content: ":x: A message with that name already exists in this server", ephemeral: true });
			}

			const channelResolved = await interaction.guild.channels.cache.get(channel.id);
			if (!channelResolved) {
				return await interaction.reply({ content: ":x: Invalid channel", ephemeral: true });
			}

			const modal = new ModalBuilder()
				.setCustomId('messageContentModal')
				.setTitle('Enter Message Content');

			const contentInput = new TextInputBuilder()
				.setCustomId('contentInput')
				.setLabel('Message Content')
				.setStyle(TextInputStyle.Paragraph)
				.setRequired(true)
				.setMaxLength(2000);

			const modalRow = new ActionRowBuilder().addComponents(contentInput);
			modal.addComponents(modalRow);

			await interaction.showModal(modal);

			const filter = i => i.customId === 'messageContentModal' && i.user.id === interaction.user.id;
			const submittedModal = await interaction.awaitModalSubmit({ filter, time: 60_000 }).catch(() => null);

			if (!submittedModal) {
				return await interaction.followUp({ content: ":x: No response received within the time limit. Action cancelled.", ephemeral: true });
			}

			const content = submittedModal.fields.getTextInputValue('contentInput');

			const confirm = new ButtonBuilder()
				.setCustomId('confirm')
				.setLabel('Send Message')
				.setStyle(ButtonStyle.Success);

			const cancel = new ButtonBuilder()
				.setCustomId('cancel')
				.setLabel('Cancel')
				.setStyle(ButtonStyle.Danger);

			const row = new ActionRowBuilder().addComponents(confirm, cancel);

			let response;
			try {
				response = await submittedModal.reply({ content: content, components: [row], ephemeral: true, fetchReply: true });
			} catch (error) {
				console.error(`Failed to create the message preview: ${error}`);
				return await submittedModal.reply({ content: `:x: Failed to create the message preview: ${error}`, ephemeral: true });
			}

			const collectorFilter = i => i.user.id === interaction.user.id;
			try {
				const confirmation = await response.awaitMessageComponent({ filter: collectorFilter, time: 60_000 });

				if (confirmation.customId === 'confirm') {
					let sent;
					try {
						sent = await channelResolved.send({ content });
					} catch (error) {
						console.error(`Failed to send the message: ${error}`);
						return await confirmation.update({ content: `:x: Failed to send the message. Check the bot permissions and try again.`, components: [] });
					}

					await db.messages.create({
						name: name,
						guild: submittedModal.guild.id,
						channel: channel.id,
						discordid: sent.id,
					});

					await confirmation.update({ content: `:white_check_mark: Message sent successfully`, components: [] });
				} else if (confirmation.customId === 'cancel') {
					await confirmation.update({ content: ':x: Action cancelled', components: [] });
				}
			} catch (e) {
				await submittedModal.editReply({ content: ':x: Confirmation not received within 1 minute, cancelling', components: [] });
			}
		}
	}
};
