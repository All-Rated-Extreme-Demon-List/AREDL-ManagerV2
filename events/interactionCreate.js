const { Events } = require('discord.js');
const { Collection } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {

		if (interaction.isChatInputCommand()) {

			// Chat command //

			// Check command's name
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			const { cooldowns } = interaction.client;

			// Check if there's a cooldown
			if (!cooldowns.has(command.data.name)) {
				cooldowns.set(command.data.name, new Collection());

				const now = Date.now();
				const timestamps = cooldowns.get(command.data.name);
				const defaultCooldownDuration = 3;
				const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;

				if (timestamps.has(interaction.user.id)) {
					const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

					if (now < expirationTime) {
						const expiredTimestamp = Math.round(expirationTime / 1000);
						return interaction.reply({ content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`, ephemeral: true });
					}
				}

				timestamps.set(interaction.user.id, now);
				setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
			}
			// Execute command
			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(`Error executing ${interaction.commandName}`);
				console.error(error);
			}
		} else if (interaction.isAutocomplete()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.autocomplete(interaction);
			} catch (error) {
				console.error(error);
			}
		} else if (interaction.isButton()) {

			// Handle button interactions //
			const button = interaction.client.buttons.get(interaction.customId);
			if (!button) {
				console.error(`No button matching ${interaction.customId} was found.`);
				await interaction.reply(`:x: Something went wrong (Button ID "${interaction.customId}" not found)`);
				return;
			}

			// Execute code
			try {
				if (button.ephemeral != null) await interaction.deferReply({ ephemeral: button.ephemeral });
				await button.execute(interaction);
			} catch (error) {
				console.error(`Error executing ${interaction.customId}`);
				console.error(error);
			}

		} else if (interaction.isAnySelectMenu()) {

			// Handle select menus
			await interaction.deferReply({ ephemeral: true });

			const menu = interaction.client.menus.get(interaction.customId);
			if (!menu) {
				console.error(`No menu matching ${interaction.customId} was found.`);
				await interaction.reply(`:x: Something went wrong (Menu ID "${interaction.customId}" not found)`);
				return;
			}

			// Execute code
			try {
				await menu.execute(interaction);
			} catch (error) {
				console.error(`Error executing ${interaction.customId}`);
				console.error(error);
			}

		} else if (interaction.isModalSubmit()) {

			const modal = interaction.client.modals.get(interaction.customId);
			if (!modal) {
				console.error(`No modal matching ${interaction.customId} was found.`);
				await interaction.reply(`:x: Something went wrong (Modal ID "${interaction.customId}" not found)`)
				return;
			}

			// Execute code
			try {
				await modal.execute(interaction);
			} catch (error) {
				console.error(`Error executing ${interaction.customId}`);
				console.error(error);
			}

		} else { return; }
	},
};