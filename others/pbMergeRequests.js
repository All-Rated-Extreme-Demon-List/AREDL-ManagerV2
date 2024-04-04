const { ButtonBuilder, ActionRowBuilder, EmbedBuilder, ButtonStyle } = require('discord.js');

module.exports = {
	async submitMergeRequest(event) {
		// Record submitting //
		const { db, client } = require('../index.js');
		const { enableSeparateStaffServer, mergesId, guildId, staffGuildId } = require('../config.json');

		try {
			if (event.action == 'create') {
				const pb_id = event.record.id;
				const user = event.record.expand.user.global_name;
				const user_discord = (event.record.expand.user.discord_id == '' ? 'None' : `<@${event.record.expand.user.discord_id}>`);
				const to_merge = event.record.expand.to_merge.global_name;
				const to_merge_discord = (event.record.expand.to_merge.discord_id == '' ? 'None' : `<@${event.record.expand.to_merge.discord_id}>`);

				// Create accept/deny buttons
				const accept = new ButtonBuilder()
					.setCustomId('acceptMerge')
					.setLabel('Accept')
					.setStyle(ButtonStyle.Success);

				const deny = new ButtonBuilder()
					.setCustomId('denyMerge')
					.setLabel('Deny')
					.setStyle(ButtonStyle.Danger);

				const row = new ActionRowBuilder()
					.addComponents(accept)
					.addComponents(deny);

				// Embed with record data to send in pending-record-log
				const mergeEmbed = new EmbedBuilder()
					.setColor(0x005c91)
					.setTitle('Merge Request')
					.addFields(
						{ name: 'User\n(Global name):', value: user, inline: true},
						{ name: 'User\n(Discord):', value: user_discord, inline: true },
						{ name: '\t', value: '\t' },
						{ name: 'User to be merged\n(Global name):', value: to_merge, inline: true },
						{ name: 'User to be merged\n(Discord):', value: to_merge_discord, inline: true },
					)
					.setTimestamp();

				// Send message
				const guild = await client.guilds.fetch((enableSeparateStaffServer ? staffGuildId : guildId));
				const sent = await guild.channels.cache.get(mergesId).send({ embeds: [mergeEmbed], components:[row] });

				// Add request to sqlite db
				try {
					await db.mergeRequests.create({
						pb_id: pb_id,
						user: user,
						user_discord: user_discord,
						to_merge: to_merge,
						to_merge_discord: to_merge_discord,
						discordid: sent.id
					});
				} catch (error) {
					console.log(`Couldn't register the merge request ; something went wrong with Sequelize : ${error}`);
					await sent.delete();
				}
				console.log(`${user} submitted a merge request for ${to_merge} (${pb_id})`);
			}
		} catch (error) {
			console.log(`Something went wrong when handling pocketbase merge request event: \nEvent:${JSON.stringify(event)}\nError:${error}`);
		}
	},
};