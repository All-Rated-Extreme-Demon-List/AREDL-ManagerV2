const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	cooldown: 5,
	enabled: true,
	data: new SlashCommandBuilder()
		.setName('packs')
		.setDescription('Staff list packs management')
		.addSubcommand(subcommand =>
			subcommand
				.setName('create')
				.setDescription('Create a new pack out of two levels. You can more later on with /packs addlevel')
				.addStringOption(option =>
					option.setName('packname')
						.setDescription('The name of the pack to create')
						.setMinLength(1)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('color')
						.setDescription('The CSS Gradient of the pack (you can use https://cssgradient.io/ to make one)')
						.setMinLength(1)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('level1')
						.setDescription('The first level of the pack')
						.setAutocomplete(true)
						.setRequired(true)
						.setMinLength(1))
				.addStringOption(option =>
					option.setName('level2')
						.setDescription('The second level of the pack')
						.setAutocomplete(true)
						.setRequired(true)
						.setMinLength(1)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('update')
				.setDescription('Update an existing pack info')
				.addStringOption(option =>
					option.setName('packname')
						.setDescription('The name of the pack to edit')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('color')
						.setDescription('The CSS Gradient of the pack (you can use https://cssgradient.io/ to make one)')
						.setMinLength(1))
				.addStringOption(option =>
					option.setName('newname')
						.setDescription('The new name of the pack')
						.setMinLength(1)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('delete')
				.setDescription('Delete a pack')
				.addStringOption(option =>
					option.setName('packname')
						.setDescription('The name of the pack to delete')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('addlevel')
				.setDescription('Adds a level to a pack')
				.addStringOption(option =>
					option.setName('packname')
						.setDescription('The name of the pack to edit')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('level')
						.setDescription('The level to add to the pack')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('removelevel')
				.setDescription('Removes a level from a pack')
				.addStringOption(option =>
					option.setName('packname')
						.setDescription('The name of the pack to edit')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('level')
						.setDescription('The level to remove from the pack')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true))),
	async autocomplete(interaction) {

		const focused = interaction.options.getFocused(true);
		const { cache } = require('../../index.js');

		let results;
		let target = (focused.name == 'packname' ? cache.packs : cache.levels);
		results = await target.findAll({where: {}});

		results = results.filter(elt => elt.name.toLowerCase().startsWith(focused.value.toLowerCase()));
		
		if (interaction.options.getSubcommand() === 'removelevel' && focused.name == 'level') {
			const selectedPack = await cache.packs.findOne({where: {name: interaction.options.getString('packname')}});
			if (!selectedPack) return await interaction.respond([]);
			results = results.filter(level => selectedPack.levels.includes(level.pb_id));
		}

		if (results.length > 25) results = results.slice(0, 25);
		await interaction.respond(
			results.map(elt => ({ name:elt.name, value: elt.name}))
		);
	},

	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true});

		if (interaction.options.getSubcommand() === 'create') {
			const { pb, cache } = require('../../index.js');
			const { getRegisteredKey } = require('../../utils.js');

			const key = await getRegisteredKey(interaction);
			if (key==-1) return;

			const level1 = await cache.levels.findOne({where: {name: interaction.options.getString('level1')}});
			if (!level1) return await interaction.editReply(':x: The first level is not on the list');
			const level2 = await cache.levels.findOne({where: {name: interaction.options.getString('level2')}});
			if (!level2) return await interaction.editReply(':x: The second level is not on the list');

			const levels = JSON.stringify([level1.pb_id, level2.pb_id]);

			try {
				await pb.send('/api/aredl/mod/pack', {
					method: 'POST',
					query: {
						'name': interaction.options.getString('packname'),
						'color': interaction.options.getString('color'),
						'levels': levels
					},
					headers: {
						'api-key': key
					}
				});
			} catch (err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to create packs on the website');
				else return await interaction.editReply(`:x: Couldn't create the pack: ${JSON.stringify(err.response)}`);
			}

			console.log(`${interaction.user.tag} (${interaction.user.id}) created the pack ${interaction.options.getString('packname')} (${JSON.stringify(levels)})`);
			await interaction.editReply(':white_check_mark: The pack was created successfully');
			const cacheUpdate = require('../../scheduled/cacheUpdate.js');
			cacheUpdate.execute();
			return;

		} else if (interaction.options.getSubcommand() === 'update') {
			const { pb, cache } = require('../../index.js');
			const { getRegisteredKey } = require('../../utils.js');

			const key = await getRegisteredKey(interaction);
			if (key==-1) return;

			const pack = await cache.packs.findOne({where: {name: interaction.options.getString('packname')}});
			if (!pack) return await interaction.editReply(':x: This pack does not exist');

			let query = { 'id': pack.pb_id };
			const color = await interaction.options.getString('color');
			const newname = await interaction.options.getString('newname');
			if (color) query['color'] = color;
			if (newname) query['name'] = newname;

			try {
				await pb.send('/api/aredl/mod/pack', {
					method: 'PATCH',
					query: query,
					headers: {
						'api-key': key
					}
				});
			} catch (err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to update packs on the website');
				else return await interaction.editReply(`:x: Couldn't update the pack: ${JSON.stringify(err.response)}`);
			}

			console.log(`${interaction.user.tag} (${interaction.user.id}) updated the pack ${interaction.options.getString('packname')} (${JSON.stringify(query)})`);
			await interaction.editReply(':white_check_mark: The pack was updated successfully');
			const cacheUpdate = require('../../scheduled/cacheUpdate.js');
			cacheUpdate.execute();
			return;

		} else if (interaction.options.getSubcommand() === 'delete') {
			const { pb, cache } = require('../../index.js');
			const { getRegisteredKey } = require('../../utils.js');

			const key = await getRegisteredKey(interaction);
			if (key==-1) return;

			const pack = await cache.packs.findOne({where: {name: interaction.options.getString('packname')}});
			if (!pack) return await interaction.editReply(':x: This pack does not exist');

			try {
				await pb.send('/api/aredl/mod/pack', {
					method: 'DELETE',
					query: {'id': pack.pb_id},
					headers: {
						'api-key': key
					}
				});
			} catch (err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to delete packs on the website');
				else return await interaction.editReply(`:x: Couldn't delete the pack: ${JSON.stringify(err.response)}`);
			}

			console.log(`${interaction.user.tag} (${interaction.user.id}) deleted the pack ${interaction.options.getString('packname')} })`);
			await interaction.editReply(':white_check_mark: The pack was deleted successfully');
			const cacheUpdate = require('../../scheduled/cacheUpdate.js');
			cacheUpdate.execute();
			return;

		} else if (interaction.options.getSubcommand() === 'addlevel') {
			const { pb, cache } = require('../../index.js');
			const { getRegisteredKey } = require('../../utils.js');

			const key = await getRegisteredKey(interaction);
			if (key==-1) return;

			const pack = await cache.packs.findOne({where: {name: interaction.options.getString('packname')}});
			if (!pack) return await interaction.editReply(':x: This pack does not exist');

			const level = await cache.levels.findOne({where: {name: interaction.options.getString('level')}});
			if (!level) return await interaction.editReply(':x: This level is not on the list');

			if (pack.levels.includes(level.pb_id)) return await interaction.editReply(':x: This level is already in this pack');
			
			let levels = JSON.parse(pack.levels);
			levels.push(level.pb_id);

			try {
				await pb.send('/api/aredl/mod/pack', {
					method: 'PATCH',
					query: {'id': pack.pb_id, 'levels':JSON.stringify(levels)},
					headers: {
						'api-key': key
					}
				});
			} catch (err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to update packs on the website');
				else return await interaction.editReply(`:x: Couldn't update the pack: ${JSON.stringify(err.response)}`);
			}

			console.log(`${interaction.user.tag} (${interaction.user.id}) updated the levels of the pack ${interaction.options.getString('packname')} (${JSON.stringify(levels)})`);
			await interaction.editReply(':white_check_mark: The pack was updated successfully');
			const cacheUpdate = require('../../scheduled/cacheUpdate.js');
			cacheUpdate.execute();
			return;
		} else if (interaction.options.getSubcommand() === 'removelevel') {
			const { pb, cache } = require('../../index.js');
			const { getRegisteredKey } = require('../../utils.js');

			const key = await getRegisteredKey(interaction);
			if (key==-1) return;

			const pack = await cache.packs.findOne({where: {name: interaction.options.getString('packname')}});
			if (!pack) return await interaction.editReply(':x: This pack does not exist');

			const level = await cache.levels.findOne({where: {name: interaction.options.getString('level')}});
			if (!level) return await interaction.editReply(':x: This level is not on the list');

			let levels = JSON.parse(pack.levels);

			if (levels.length == 2) return await interaction.editReply(':x: This pack only has 2 levels');
			if (!(levels.includes(level.pb_id))) return await interaction.editReply(':x: This level is not in this pack');
			levels = levels.filter(current_level => current_level !== level.pb_id);

			try {
				await pb.send('/api/aredl/mod/pack', {
					method: 'PATCH',
					query: {'id': pack.pb_id, 'levels':JSON.stringify(levels)},
					headers: {
						'api-key': key
					}
				});
			} catch (err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to update packs on the website');
				else return await interaction.editReply(`:x: Couldn't update the pack: ${JSON.stringify(err.response)}`);
			}

			console.log(`${interaction.user.tag} (${interaction.user.id}) updated the levels of the pack ${interaction.options.getString('packname')} (${JSON.stringify(levels)})`);
			await interaction.editReply(':white_check_mark: The pack was updated successfully');
			const cacheUpdate = require('../../scheduled/cacheUpdate.js');
			cacheUpdate.execute();
			return;
		}
	},
};