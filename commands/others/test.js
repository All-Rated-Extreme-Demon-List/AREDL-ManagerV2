const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { guildId } = require('../../config.json');
const Canvas = require('@napi-rs/canvas');

const applyText = (canvas, text) => {
	const context = canvas.getContext('2d');
	let fontSize = 60;
	do {
		context.font = `${fontSize -= 5}px Microsoft Sans Serif`;
	} while (context.measureText(text).width > canvas.width - 300);

	return context.font;
};

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('Test')
    .setDefaultMemberPermissions(0)
		.addUserOption(option =>
			option.setName('member')
				.setDescription('Member')),
	async execute(interaction) {
		const user = interaction.options.getUser('member');
		const member = (user ?? interaction.member);
		const avatar = await Canvas.loadImage(member.displayAvatarURL({ extension: 'jpg' }));

		const canvas = Canvas.createCanvas(700, 250);
		const context = canvas.getContext('2d');

		context.fillStyle = '#101010';
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = '#000000';
		context.fillRect(10, 15, canvas.width - 20, canvas.height - 30);

		context.font = '28px Microsoft Sans Serif';
		context.fillStyle = '#d0d0d0';
		context.fillText('just joined the server', canvas.width / 2.5, canvas.height / 1.8);

		context.font = applyText(canvas, `${member.displayName}`);
		context.fillStyle = '#ffffff';
		context.fillText(`${member.displayName}`, canvas.width / 2.5, canvas.height / 2.5);

		context.font = '28px Microsoft Sans Serif';
		context.fillStyle = '#a0a0a0';
		context.fillText(`Member #${(await member.client.guilds.cache.get(guildId)).memberCount}`, canvas.width / 2.5, canvas.height / 1.4);

		context.beginPath();
		context.arc(125, 125, 100, 0, Math.PI * 2, true);
		context.closePath();
		context.clip();

		context.drawImage(avatar, 25, 25, 200, 200);

		const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'welcome.png' });

		await interaction.reply({ ephemeral: true, content: `Hey ${member}, welcome to the All Rated Extreme Demons List!`, files: [attachment] });

	},
};
