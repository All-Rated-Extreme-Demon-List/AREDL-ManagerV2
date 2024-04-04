const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	cooldown: 5,
	enabled: true,
	data: new SlashCommandBuilder()
		.setName('level')
		.setDescription('Staff list levels management')
		.addSubcommand(subcommand =>
			subcommand
				.setName('edit')
				.setDescription('Edit a placed level on the list')
				.addStringOption(option =>
					option.setName('levelname')
						.setDescription('The name of the level to edit')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true))
				.addIntegerOption(option =>
					option.setName('id')
						.setDescription('The GD ID of the level'))
				.addStringOption(option =>
					option.setName('newname')
						.setDescription('The new displayed name of the level')
						.setMinLength(1))
				.addStringOption(option =>
					option.setName('uploader')
						.setDescription('The account who uploaded the level. If it does not exist on AREDL, a placeholder will be created.')
						.setMinLength(1)
						.setAutocomplete(true))
				.addStringOption(option =>
					option.setName('password')
						.setDescription('The GD password of the level to place')))
		.addSubcommand(subcommand =>
			subcommand
				.setName('addcreator')
				.setDescription('Adds a creator to a placed level')
				.addStringOption(option =>
					option.setName('levelname')
						.setDescription('The name of the level to edit')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('creator')
						.setDescription('The creator to add to the level')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('removecreator')
				.setDescription('Removes a creator from a placed level')
				.addStringOption(option =>
					option.setName('levelname')
						.setDescription('The name of the level to edit')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('creator')
						.setDescription('The creator to remove from the level')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true))),
	async autocomplete(interaction) {
		const focused = interaction.options.getFocused(true);
		const { pb, cache } = require('../../index.js');
		const { getRegisteredKey } = require('../../utils.js');

		const key = await getRegisteredKey(interaction);
		if (key == -1) return await interaction.respond([]);
		
		let results;
		if (focused.name == 'levelname') {
			results = await cache.levels.findAll({where: {}});
			let levels = results.filter(level => level.name.toLowerCase().startsWith(focused.value.toLowerCase()));
			if (levels.length > 25) levels = levels.slice(0, 25);
			await interaction.respond(
				levels.map(level => ({ name:level.name, value: level.name}))
			);
		} else {
			try {
				results = await pb.send('/api/users', {
					method: 'GET',
					query: {
						'per_page': 25,
						'name_filter': focused.value
					},
					headers: {
						'api-key': key
					}
				});
			} catch (err) {
				return await interaction.respond([]);
			}
			await interaction.respond(
				results.map(user => ({ name:user.name, value: user.name })),
			);
		}
	},
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true});

		if (interaction.options.getSubcommand() === 'edit') {
			const { pb, cache } = require('../../index.js');
			const { getRegisteredKey, getUserPbId } = require('../../utils.js');

			const level = await cache.levels.findOne({where: {name: interaction.options.getString('levelname')}});
			if (!level) return await interaction.editReply(':x: This level is not on the list');

			const key = await getRegisteredKey(interaction);
			if (key==-1) return;

			let query = {};

			const gd_id = interaction.options.getInteger('id');
			const uploader = interaction.options.getString('uploader');
			const password = interaction.options.getString('password');
			const newname = interaction.options.getString('newname');

			if (gd_id!=null) query['level_id'] = gd_id;
			if (password!= null) query['level_password'] = password;
			if (newname!= null) query['name'] = newname;
			if (uploader!=null) {
				const uploader_id  = await getUserPbId(interaction, uploader, key);
				if (uploader_id == -2) return;
				if (uploader_id == -1) return await interaction.editReply(':x: The uploader does not have an account on the website (you can create one with /aredluser createplaceholder)');

				query['publisher'] = uploader_id;
			}

			try {
				await pb.send(`/api/aredl/levels/${level.pb_id}`, {
					method: 'PATCH',
					query: query,
					headers: {
						'api-key': key
					}
				});
			} catch (err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to update levels on the website');
				else return await interaction.editReply(`:x: Couldn't update the level: ${JSON.stringify(err.response)}`);
			}

			console.log(`${interaction.user.tag} (${interaction.user.id}) updated ${level.name} (${JSON.stringify(query)})`);
			await interaction.editReply(':white_check_mark: The level was updated successfully');
			const cacheUpdate = require('../../scheduled/cacheUpdate.js');
			cacheUpdate.execute();
			return;

		} else if (interaction.options.getSubcommand() === 'addcreator') {

			const { pb, cache } = require('../../index.js');
			const { getRegisteredKey, getUserPbId } = require('../../utils.js');

			const level = await cache.levels.findOne({where: {name: interaction.options.getString('levelname')}});
			if (!level) return await interaction.editReply(':x: This level is not on the list');

			const key = await getRegisteredKey(interaction);
			if (key==-1) return;

			const creator = interaction.options.getString('creator');
			let creator_id = await getUserPbId(interaction, creator, key);
			if (creator_id == -2) return;
			if (creator_id == -1) {
				let placeduser;
				try {
					placeduser = await pb.send('/api/users/placeholder', {
						method: 'POST', query: {'username': creator}, headers: {'api-key': key}
					});
				} catch (err) {
					if (err.status == 403) return await interaction.editReply(':x: You do not have permission to create placeholder users on the website');
					else return await interaction.editReply(`:x: Couldn't create a new placeholder user: ${JSON.stringify(err.response)}`);
				}
				creator_id = placeduser.id;
			}

			let creators = JSON.parse(level.creators);
			if (creators.includes(creator_id)) return await interaction.editReply(':x: This user is already a creator of this level');
			
			creators.push(creator_id);

			try {
				await pb.send(`/api/aredl/levels/${level.pb_id}`, {
					method: 'PATCH', query: {'creator_ids':JSON.stringify(creators)}, headers: {'api-key': key}
				});
			} catch(err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to update levels on the website');
				else return await interaction.editReply(`:x: Couldn't update the level creators: ${JSON.stringify(err.response)}`);
			}

			console.log(`${interaction.user.tag} (${interaction.user.id}) updated creators of ${level.name} (${JSON.stringify(creators)})`);
			
			await interaction.editReply(':white_check_mark: The level was updated successfully');
			const cacheUpdate = require('../../scheduled/cacheUpdate.js');
			cacheUpdate.execute();
			return;

		} else if (interaction.options.getSubcommand() === 'removecreator') {
			
			const { pb, cache } = require('../../index.js');
			const { getRegisteredKey, getUserPbId } = require('../../utils.js');

			const level = await cache.levels.findOne({where: {name: interaction.options.getString('levelname')}});
			if (!level) return await interaction.editReply(':x: This level is not on the list');

			const key = await getRegisteredKey(interaction);
			if (key==-1) return;

			const creator = interaction.options.getString('creator');
			let creator_id = await getUserPbId(interaction, creator, key);
			if (creator_id == -2) return;
			if (creator_id == -1) {
				let placeduser;
				try {
					placeduser = await pb.send('/api/user/placeholder', {
						method: 'POST', query: {'username': creator}, headers: {'api-key': key}
					});
				} catch (err) {
					if (err.status == 403) return await interaction.editReply(':x: You do not have permission to create placeholder users on the website');
					else return await interaction.editReply(`:x: Couldn't create a new placeholder user: ${JSON.stringify(err.response)}`);
				}
				creator_id = placeduser.id;
			}

			let creators = JSON.parse(level.creators);

			if (creators.length == 1) return await interaction.editReply(':x: This level only has 1 creator, the creators list can not be empty');
			if (!(creators.includes(creator_id))) return await interaction.editReply(':x: This creator is not in this level\'s creators list');
			creators = creators.filter(current_creator => current_creator !== creator_id);

			try {
				await pb.send(`/api/aredl/levels/${level.pb_id}`, {
					method: 'PATCH', query: {'creator_ids':JSON.stringify(creators)}, headers: {'api-key': key}
				});
			} catch(err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to update levels on the website');
				else return await interaction.editReply(`:x: Couldn't update the level creators: ${JSON.stringify(err.response)}`);
			}

			console.log(`${interaction.user.tag} (${interaction.user.id}) updated creators of ${level.name} (${JSON.stringify(creators)})`);
			
			await interaction.editReply(':white_check_mark: The level was updated successfully');
			const cacheUpdate = require('../../scheduled/cacheUpdate.js');
			cacheUpdate.execute();
			return;
		}
	},
};