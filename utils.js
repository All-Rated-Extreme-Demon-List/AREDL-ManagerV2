
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
			const results = await pb.send('/api/mod/user/list', {
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
		const levels_dict = {};
		const { pb } = require('./index.js');
		let list_data;
		try {
			list_data = await pb.send('/api/aredl/list');
		} catch (fetchError) {
			console.log(`Couldn't fetch list data: \n${fetchError}`);
			return -1;
		}
		for (const level of list_data) {
			levels_dict[level.name] = level.id;
		}
		
		console.log(`Successfully fetched ${list_data.length} levels `);
		return levels_dict;
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
			packs_dict[pack.name] = pack.id;
		}
		
		console.log(`Successfully fetched ${packs_data.length} packs `);
		return packs_dict;
	}
};