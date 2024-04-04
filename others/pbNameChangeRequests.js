const { ButtonBuilder, ActionRowBuilder, EmbedBuilder, ButtonStyle } = require('discord.js');

module.exports = {
	async submitNameChangeRequest(event) {
	// Record submitting //
		const { db, client } = require('../index.js');
		const { enableSeparateStaffServer, nameChangesId, guildId, staffGuildId } = require('../config.json');

		try {
			if (event.action == 'create') {
				const pb_id = event.record.id;
				const user = event.record.expand.user.global_name;
				const user_discord = (event.record.expand.user.discord_id == '' ? 'None' : `<@${event.record.expand.user.discord_id}>`);
				const new_name = event.record.new_name;

				// Create accept/deny buttons
				const accept = new ButtonBuilder()
					.setCustomId('acceptNamechange')
					.setLabel('Accept')
					.setStyle(ButtonStyle.Success);

				const deny = new ButtonBuilder()
					.setCustomId('denyNamechange')
					.setLabel('Deny')
					.setStyle(ButtonStyle.Danger);

				const row = new ActionRowBuilder()
					.addComponents(accept)
					.addComponents(deny);

				// Embed with record data to send in pending-record-log
				const namechangeEmbed = new EmbedBuilder()
					.setColor(0x005c91)
					.setTitle('Name Change Request')
					.addFields(
						{ name: 'User\n(Global name):', value: user, inline: true},
						{ name: 'User\n(Discord):', value: user_discord, inline: true },
						{ name: '\t', value: '\t' },
						{ name: 'Requested new Global name:', value: new_name },
					)
					.setTimestamp();

				// Send message
				const guild = await client.guilds.fetch((enableSeparateStaffServer ? staffGuildId : guildId));
				const sent = await guild.channels.cache.get(nameChangesId).send({ embeds: [namechangeEmbed], components:[row] });

				// Add request to sqlite db
				try {
					await db.nameRequests.create({
						pb_id: pb_id,
						user: user,
						user_discord: user_discord,
						new_name: new_name,
						discordid: sent.id
					});
				} catch (error) {
					console.log(`Couldn't register the name change request ; something went wrong with Sequelize : ${error}`);
					await sent.delete();
				}
				console.log(`${user} submitted a name change request  (${new_name}) (${pb_id})`);

			} else if (event.action == 'update') {

				const pb_id = event.record.id;
				const user = event.record.expand.user.global_name;
				const user_discord = (event.record.expand.user.discord_id == '' ? 'None' : `<@${event.record.expand.user.discord_id}>`);
				const new_name = event.record.new_name;

				const request = await db.nameRequests.findOne({where: { pb_id: pb_id }});
				
				if (request) {
					const channel = await client.channels.fetch(nameChangesId);
					const embedMessage = await channel.messages.fetch(request.discordid); 
					const newEmbed = EmbedBuilder
						.from(embedMessage.embeds[0])
						.setFields(
							{ name: 'User\n(Global name):', value: user, inline: true},
							{ name: 'User\n(Discord):', value: user_discord, inline: true },
							{ name: '\t', value: '\t' },
							{ name: 'Requested new Global name:', value: new_name },
						)
						.setTimestamp();
					try {
						await embedMessage.edit({ embeds: [newEmbed]});
					} catch (error) {
						console.log(`Couldn't update the sent message: ${error}`);
					}

					try {
						await db.pendingRecords.update({
							user: user,
							user_discord: user_discord,
							new_name: new_name,
						}, { where: {pb_id: pb_id}});
					} catch (error) {
						console.log(`Couldn't update the request ; something went wrong with Sequelize : ${error}`);
					}
					return console.log(`${user} (${user_discord}) updated their name change request to ${new_name} (${pb_id})`);

				} else {

					// Create accept/deny buttons
					const accept = new ButtonBuilder()
						.setCustomId('acceptNamechange')
						.setLabel('Accept')
						.setStyle(ButtonStyle.Success);

					const deny = new ButtonBuilder()
						.setCustomId('denyNamechange')
						.setLabel('Deny')
						.setStyle(ButtonStyle.Danger);

					const row = new ActionRowBuilder()
						.addComponents(accept)
						.addComponents(deny);

					// Embed with record data to send in pending-record-log
					const namechangeEmbed = new EmbedBuilder()
						.setColor(0x005c91)
						.setTitle('Name Change Request')
						.addFields(
							{ name: 'User\n(Global name):', value: user, inline: true},
							{ name: 'User\n(Discord):', value: user_discord, inline: true },
							{ name: '\t', value: '\t' },
							{ name: 'Requested new Global name:', value: new_name },
						)
						.setTimestamp();

					// Send message
					const guild = await client.guilds.fetch((enableSeparateStaffServer ? staffGuildId : guildId));
					const sent = await guild.channels.cache.get(nameChangesId).send({ embeds: [namechangeEmbed], components:[row] });

					// Add request to sqlite db
					try {
						await db.nameRequests.create({
							pb_id: pb_id,
							user: user,
							user_discord: user_discord,
							new_name: new_name,
							discordid: sent.id
						});
					} catch (error) {
						console.log(`Couldn't register the name change request ; something went wrong with Sequelize : ${error}`);
						await sent.delete();
					}
					console.log(`${user} submitted a name change request  (${new_name}) (${pb_id})`);
					return console.log(`New name change request was created from updated request data: ${new_name} for ${user} (${user_discord}) (${pb_id})`);
				}
			} else if (event.action == 'delete') {
				const request = await db.nameRequests.findOne({where: { pb_id: event.record.id }});
				if (request) {
					const channel = await client.channels.fetch(nameChangesId);
					try {
						await (await channel.messages.fetch(request.discordid)).delete();
					} catch (_) { /* Nothing */ }
					
					await db.nameRequests.destroy({where: {pb_id: event.record.id }});
					return console.log(`Name change request for ${request.user} (${request.user_discord}) was deleted (${event.record.id})`);
				}
			}
		} catch (error) {
			console.log(`Something went wrong when handling pocketbase name change request event: \nEvent:${JSON.stringify(event)}\nError:${error}`);
		}
	},
};