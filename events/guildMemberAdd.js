const { Events, AttachmentBuilder } = require('discord.js');
const { guildMemberAddID, guildId, enableWelcomeMessage } = require('../config.json');
const Canvas = require('@napi-rs/canvas');

const applyText = (canvas, text) => {
	const context = canvas.getContext('2d');
	let fontSize = 60;
	do {
		context.font = `${fontSize -= 10}px Open Sans`;
	} while (context.measureText(text).width > canvas.width - 300);

	return context.font;
};


module.exports = {
	name: Events.GuildMemberAdd,
	once: false,
	async execute(member) {

		if (member.guild.id != guildId) return;

		const { db } = require('../index.js');

		if (!(await db.dailyStats.findOne({ where: { date: Date.now() } }))) db.dailyStats.create({ date: Date.now(), nbMembersJoined: 1, nbRecordsPending: await db.pendingRecords.count() });
		else await db.dailyStats.update({ nbMembersJoined: (await db.dailyStats.findOne({ where: { date: Date.now() } })).nbMembersJoined + 1 }, { where: { date: Date.now() } });

		if (!enableWelcomeMessage) return;

		const avatar = await Canvas.loadImage(member.displayAvatarURL({ extension: 'jpg' }));

		const canvas = Canvas.createCanvas(700, 250);
		const context = canvas.getContext('2d');

		context.fillStyle = '#101010';
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = '#000000';
		context.fillRect(10, 15, canvas.width - 20, canvas.height - 30);

		context.font = '28px Open Sans';
		context.fillStyle = '#d0d0d0';
		context.fillText('just joined the server', canvas.width / 2.5, canvas.height / 1.8);

		context.font = applyText(canvas, `${member.displayName}`);
		context.fillStyle = '#ffffff';
		context.fillText(`${member.displayName}`, canvas.width / 2.5, canvas.height / 2.5);

		context.font = '28px Open Sans';
		context.fillStyle = '#a0a0a0';
		context.fillText(`Member #${(await member.client.guilds.cache.get(guildId)).memberCount}`, canvas.width / 2.5, canvas.height / 1.4);

		context.beginPath();
		context.arc(125, 125, 100, 0, Math.PI * 2, true);
		context.closePath();
		context.clip();

		context.drawImage(avatar, 25, 25, 200, 200);

		const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'welcome.png' });

		await (await member.client.channels.cache.get(guildMemberAddID)).send({ content: `Hey ${member}, welcome to the All Rated Extreme Demons List!`, files: [attachment] });

	},
};
