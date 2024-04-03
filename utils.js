
module.exports = {
	async getRegisteredKey(interaction) {
		const { db } = require('./index.js');
		const modData = (await db.staffSettings.findOne({ where: {moderator: interaction.user.id }}));
		if (!modData || modData.pbKey === '') {
			await interaction.reply({ content: ':x: You did not register your API key, please do so using /aredl login', ephemeral: true});
			return -1;
		} else return modData.pbKey;
	},
	async getUserPbId(interaction, username, key) {
		const { pb } = require('./index.js');
		try {
			const results = await pb.send('/api/users', {
				method: 'GET',
				query: {
					'per_page': 1,
					'name_filter': username
				},
				headers: {
					'api-key': key
				}
			});

			return results[0].id;
		} catch (err) {
			if (err.status == 403){
				await interaction.editReply(':x: You do not have the permission to list users on the website');
				return -2;
			} else {
				return -1;
			}
		}
	},
	async fetchListData() {
		const levels = {};
		const { pb } = require('./index.js');
		let list_data;
		try {
			list_data = await pb.send('/api/aredl/levels');
		} catch (fetchError) {
			console.log(`Couldn't fetch list data: \n${fetchError}`);
			return -1;
		}
		for (const level of list_data) {
			let level_data;
			try {
				level_data = await pb.send(`/api/aredl/levels/${level.id}`, {query: {creators:true}});
			} catch (fetchError) {
				console.log(`Couldn't fetch level data: \n${fetchError}`);
				return -1;
			}
			levels[level.name] = { 'id': level.id, 'creators':level_data.creators.map(creator => creator.id)};
		}
		return levels;
	},
	async fetchPackData() {
		const packs_dict = {};
		const { pb } = require('./index.js');
		let packs_data;
		try {
			packs_data = await pb.send('/api/aredl/packs');
		} catch (fetchError) {
			console.log(`Couldn't fetch packs data: \n${fetchError}`);
			return -1;
		}
		for (const pack of packs_data) {
			packs_dict[pack.name] = { 'id': pack.id, 'levels': pack.levels.map(level => level.id) };
		}
		return packs_dict;
	}
};