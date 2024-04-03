const { EmbedBuilder } = require('discord.js');

const { db, pb } = require('../index.js');
const { getRegisteredKey, getUserPbId } = require('../utils.js');

module.exports = {
	customId: 'confirmLevelPlace',
	ephemeral: true,
	async execute(interaction) {

		const levelData = await db.levelsToPlace.findOne({where: { discordid: interaction.message.id }});
		if (!levelData) return await interaction.editReply(':x: This level has already been placed');

		const key = await getRegisteredKey(interaction);
		if (key == -1) return;

		const verifier = levelData.verifier;
		const creator = levelData.creator;
		const uploader = levelData.uploader;
		const level_id = levelData.levelid;
		const position = levelData.position;
		const levelname = levelData.levelname;
		const verification = levelData.verification;
		const password = levelData.password;
		let verifier_id = await getUserPbId(interaction, verifier, key);
		let creator_id = await getUserPbId(interaction, creator, key);
		let uploader_id = await getUserPbId(interaction, uploader, key);
		const legacy = levelData.legacy;
		const mobile = levelData.mobile;
		
		if (verifier_id == -2 || creator_id == -2 || uploader_id == -2) return;

		if (verifier_id == -1) {
			let placeduser;
			try {
				placeduser = await pb.send('/users/placeholder', {
					method: 'POST', query: {'username': verifier}, headers: {'api-key': key}
				});
			} catch (err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to create placeholder users on the website');
				else return await interaction.editReply(`:x: Couldn't create a new placeholder user: ${JSON.stringify(err.response)}`);
			}
			verifier_id = placeduser.id;
		}
		if (creator_id == -1) {
			let placeduser;
			try {
				placeduser = await pb.send('/users/placeholder', {
					method: 'POST', query: {'username': creator}, headers: {'api-key': key}
				});
			} catch (err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to create placeholder users on the website');
				else return await interaction.editReply(`:x: Couldn't create a new placeholder user: ${JSON.stringify(err.response)}`);
			}

			creator_id = placeduser.id;
		}
		if (uploader_id == -1) {
			let placeduser;
			try {
				placeduser = await pb.send('/users/placeholder', {
					method: 'POST', query: {'username': uploader}, headers: {'api-key': key}
				});
			} catch (err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to create placeholder users on the website');
				else return await interaction.editReply(`:x: Couldn't create a new placeholder user: ${JSON.stringify(err.response)}`);
			}

			uploader_id = placeduser.id;
		}
		let query = {
			'creator_ids': `["${creator_id}"]`,
			'level_id': level_id,
			'position': position,
			'name': levelname,
			'publisher': uploader_id,
			'verification_submitted_by': verifier_id,
			'verification_video_url': verification,
			'verification_fps': 360,
			'verification_mobile': mobile,
			'legacy': legacy ?? false,
		}

		if (password) query['level_password'] = password;

		try {
			await pb.send('/api/aredl/levels', {
				method: 'POST',
				query: query,
				headers: {
					'api-key': key
				}
			});
		} catch (err) {
			if (err.status == 403) return await interaction.editReply(':x: You do not have permission to place levels on the website');
			else return await interaction.editReply(`:x: Couldn't place the level: ${JSON.stringify(err.response)}`);
		}

		console.log(`${interaction.user.tag} (${interaction.user.id}) placed ${levelname} at ${position}`);
		
		db.levelsToPlace.destroy({ where: { discordid: interaction.message.id }});
		await interaction.editReply(':white_check_mark: The level was placed successfully');
		const cacheUpdate = require('../scheduled/cacheUpdate.js');
		cacheUpdate.execute();
		return;
	},
};