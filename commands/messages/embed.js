const { SlashCommandBuilder, resolveColor, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");


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
						.setName("description")
						.setDescription("Embed description")
						.setMaxLength(4096)
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
			await interaction.deferReply({ ephemeral: true});

			if (subcommand === "create") {
				const name = interaction.options.getString("name");
				const channel = interaction.options.getChannel("channel");
				const title = interaction.options.getString("title");
				const description = interaction.options.getString("description");
				const color = interaction.options.getString("color");
				const image = interaction.options.getAttachment("image");

				if (await db.embeds.findOne({ where: { name:name, guild: interaction.guild.id } }))
					return await interaction.editReply({ content: ":x: An embed with that name already exists in this server"});

				if (!title && !description && !image)
					return await interaction.editReply({ content: ":x: This embed is empty: you must provide at least a title, a description or an image"});
				
				let colorResolved;
				if (color) {
					colorResolved = resolveColor(color);
					if (!colorResolved)
						return await interaction.editReply({ content: ":x: Invalid color"});
				}

				if (image) {
					const url = image.url;
					if (url.indexOf(".png") === -1
						&& url.indexOf(".gif") === -1
						&& url.indexOf(".jpg") === -1)
						return await interaction.editReply({ content: ":x: Invalid image format. Only PNG, JPG or GIF images are allowed"});
				}

				const channelResolved = await interaction.guild.channels.cache.get(channel.id);
				if (!channelResolved)
					return await interaction.editReply({ content: ":x: Invalid channel"});

				const embed = new EmbedBuilder();
				if (title) embed.setTitle(title);
				if (description) embed.setDescription(description);
				embed.setColor(colorResolved ?? 'Default');
				if (image) embed.setImage(image.url);

				const confirm = new ButtonBuilder()
					.setCustomId('confirmEmbed')
					.setLabel('Send Embed')
					.setStyle(ButtonStyle.Success);

				const cancel = new ButtonBuilder()
					.setCustomId('cancelEmbed')
					.setLabel('Cancel')
					.setStyle(ButtonStyle.Danger);

				const row = new ActionRowBuilder()
					.addComponents(confirm)
					.addComponents(cancel);

				try {
					await interaction.editReply({ content: "Embed preview:", embeds: [embed], components: [row]});
				} catch (error) {
					return await interaction.editReply({ content: `:x: Failed to create the embed: ${error}`});
				}

				await db.embeds.create({
					name: name,
					guild: interaction.guild.id,
					channel: channel.id,
					discordid: interaction.message.id,
					sent: false,
				});
			}
		}
}