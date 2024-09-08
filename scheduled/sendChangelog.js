const { enableChangelogMessage } = require('../config.json');

module.exports = {
	name: 'sendChangelog',
	cron: '00 22 * * *',
	enabled: enableChangelogMessage,
	async execute() {
		console.log("Sending changelog message...");
		const { db, client } = require('../index.js');
		const { changelogID, changelogRoleID, guildId } = require('../config.json');

		const changelogData = await db.changelog.findAll({});
		if (!changelogData) return console.log("No changelog data for this day");

		let changelogText = "";

		const getAboveBelow = async (entry) => {
			const below = entry.level_below;
			const above = entry.level_above;
			return (
				(
					above ? (`above **${above}** ` +
					(below ? 'and ' : '')) : ''
				) + (
					below ? `below **${below}**` : ''
				)
			)
		}

		for (const entry of changelogData) {
			if (entry.action === "placed")
				changelogText += `- **${entry.levelname}** was placed at #${entry.new_position}, ${await getAboveBelow(entry)}.\n`;
			else if (entry.action === "raised")
				changelogText += `- **${entry.levelname}** was raised from #${entry.old_position} to #${entry.new_position}, ${await getAboveBelow(entry)}.\n`;
			else if (entry.action === "lowered")
				changelogText += `- **${entry.levelname}** was lowered from #${entry.old_position} to #${entry.new_position}, ${await getAboveBelow(entry)}.\n`;
			else if (entry.action === "tolegacy")
				changelogText += `- **${entry.levelname}** was moved to the legacy list.\n`;
			else if (entry.action === "fromlegacy")
				changelogText += `- **${entry.levelname}** was moved from the legacy list to #${entry.new_position}, ${await getAboveBelow(entry)}.\n`;
		}

		changelogText += `<@&${changelogRoleID}>`;
		let channel, sent;
		try {
			const guild = await client.guilds.fetch(guildId);
			channel = await guild.channels.fetch(changelogID);
		} catch (err) {
			return console.log("Failed to fetch changelog channel");
		}

		try {
			sent = await channel.send(changelogText);
		} catch (err) {
			return console.log("Failed to send changelog message");
		}

		try {
			await sent.react('👍');
			await sent.react('👎');
		} catch (err) {
			console.log("Failed to react to changelog message");
		}

		try {
			await db.changelog.destroy({ where: {} });
		} catch (err) {
			console.log("Failed to clear changelog entries");
		}

		try {		
			if (sent.crosspostable) await sent.crosspost();
		} catch (err) {
			console.log("Failed to crosspost changelog message");
		}

		console.log("Changelog sent successfully");
	},
};