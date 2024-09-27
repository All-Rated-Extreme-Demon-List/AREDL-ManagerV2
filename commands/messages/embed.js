const { SlashCommandBuilder, resolveColor, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, embedLength } = require("discord.js");

module.exports = {
	cooldown: 5,
	enabled: true,
	data: new SlashCommandBuilder()
		.setName("embed")
		.setDescription("Bot embed messages management")
		.addSubcommand(subcommand =>
			subcommand
				.setName("create")
				.setDescription("Creates a new embed message")
				.addStringOption(option =>
					option
						.setName("name")
						.setDescription("Internal name of the embed, to be able to edit it later")
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
						.setName("title")
						.setDescription("Title of the embed")
						.setMaxLength(256)
				)
				.addStringOption(option =>
					option
						.setName("color")
						.setDescription("Embed color")
				)
				.addAttachmentOption(option =>
					option
						.setName("image")
						.setDescription("Embed image")
				)
		),
	async execute(interaction) {
		const { db } = require("../..");

		const subcommand = interaction.options.getSubcommand();

		if (subcommand === "create") {
			const name = interaction.options.getString("name");
			const channel = interaction.options.getChannel("channel");
			const title = interaction.options.getString("title");
			const color = interaction.options.getString("color");
			const image = interaction.options.getAttachment("image");

			if (await db.embeds.findOne({ where: { name: name, guild: interaction.guild.id } }))
				return await interaction.reply({ content: ":x: An embed with that name already exists in this server", ephemeral: true });

			let colorResolved;
			if (color) {
				colorResolved = resolveColor(color);
				if (!colorResolved)
					return await interaction.reply({ content: ":x: Invalid color", ephemeral: true });
			}

			if (image) {
				const url = image.url;
				if (url.indexOf(".png") === -1
					&& url.indexOf(".gif") === -1
					&& url.indexOf(".jpg") === -1)
					return await interaction.reply({ content: ":x: Invalid image format. Only PNG, JPG, or GIF images are allowed", ephemeral: true });
			}

			const channelResolved = await interaction.guild.channels.cache.get(channel.id);
			if (!channelResolved)
				return await interaction.editReply({ content: ":x: Invalid channel" });

			const modal = new ModalBuilder()
				.setCustomId('embedDescriptionModal')
				.setTitle('Enter Embed Description');

			const descriptionInput = new TextInputBuilder()
				.setCustomId('descriptionInput')
				.setLabel('Embed Description. You can leave this empty')
				.setStyle(TextInputStyle.Paragraph)
				.setRequired(false)
				.setMaxLength(4000);

			const modalRow = new ActionRowBuilder().addComponents(descriptionInput);
			modal.addComponents(modalRow);

			await interaction.showModal(modal);

			const filter = i => i.customId === 'embedDescriptionModal' && i.user.id === interaction.user.id;
			const submittedModalInteraction = await interaction.awaitModalSubmit({ filter, time: 60_000 }).catch(() => null);

			let description = null;
			if (submittedModalInteraction) {
				description = submittedModalInteraction.fields.getTextInputValue('descriptionInput');
			
				if (!title && !description && !image)
					return await submittedModalInteraction.reply({ content: ":x: This embed is empty: you must provide at least a title, a description, or an image", ephemeral: true });

				const embed = new EmbedBuilder();
				if (title) embed.setTitle(title);
				if (description) embed.setDescription(description);
				embed.setColor(colorResolved ?? 'Default');
				if (image) embed.setImage(image.url);

				const confirm = new ButtonBuilder()
					.setCustomId('confirm')
					.setLabel('Send Embed')
					.setStyle(ButtonStyle.Success);

				const cancel = new ButtonBuilder()
					.setCustomId('cancel')
					.setLabel('Cancel')
					.setStyle(ButtonStyle.Danger);

				const row = new ActionRowBuilder()
					.addComponents(confirm)
					.addComponents(cancel);

				let response;
				try {
					response = await submittedModalInteraction.reply({ content: "Embed preview:", embeds: [embed], components: [row], ephemeral: true, fetchReply: true });
				} catch (error) {
					console.error(`Failed to create the embed: ${error}`);
					return await submittedModalInteraction.reply({ content: `:x: Failed to create the embed: ${error}` });
				}

				const collectorFilter = i => i.user.id === interaction.user.id;
				try {
					const confirmation = await response.awaitMessageComponent({ filter: collectorFilter, time: 60_000 });
					if (confirmation.customId === 'confirm') {
						let sent;
						try {
							sent = await channelResolved.send({
								embeds: [embed],
							});
						} catch (error) {
							console.error(`Failed to send ${name} embed: ${error}`);
							return await confirmation.update(`:x: Failed to send the embed. Check the bot permissions and try again.`);
						}

						await db.embeds.create({
							name: name,
							guild: submittedModalInteraction.guild.id,
							channel: channel.id,
							discordid: submittedModalInteraction.message.id,
						});

						await confirmation.update({ content: `:white_check_mark: Embed sent successfully`, components: [] });

					} else if (confirmation.customId === 'cancel') {
						await confirmation.update({ content: ':x: Action cancelled', components: [], embeds: [] });
					}
				} catch (e) {
					await submittedModalInteraction.editReply({ content: ':x: Confirmation not received within 1 minute, cancelling', components: [], embeds: []});
				}
			}
		}
	}
};
