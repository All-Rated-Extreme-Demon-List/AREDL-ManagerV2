module.exports = {
	async getRegisteredKey(interaction) {
		const { db } = require('./index.js');
		const modData = (await db.staffSettings.findOne({ where: {moderator: interaction.user.id }}));
		if (!modData || modData.pbKey === '') {
			await interaction.reply({ content: ':x: You did not register your API key, please do so using /aredl login', ephemeral: true});
			return -1;
		} else return modData.pbKey;
	},
	async getUserPbId(interaction, username) {
		const { cache } = require('./index.js');
		try {
			const results = await cache.users.findOne({where: {username: username}});
			return results.pb_id;
		} catch (err) {
			return -1;
		}
	},
	async fetchListData() {
		const levels = [];
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
			levels.push({pb_id: level.id, name: level.name, creators: JSON.stringify(level_data.creators.map(creator => creator.id))});
		}
		return levels;
	},
	async fetchPackData() {
		const packs = [];
		const { pb } = require('./index.js');
		let packs_data;
		try {
			packs_data = await pb.send('/api/aredl/packs');
		} catch (fetchError) {
			console.log(`Couldn't fetch packs data: \n${fetchError}`);
			return -1;
		}
		for (const pack of packs_data) {
			packs.push({name: pack.name, pb_id: pack.id, levels: JSON.stringify(pack.levels.map(level => level.id)) });
		}
		return packs;
	},
	async fetchUserData() {
		const users = [];
		const { pb } = require('./index.js');
		const { botApiKey } = require('./config.json');
		let users_data;
		try {
			users_data = await pb.send('/api/users', { query: {'per_page': -1}, headers: {'api-key': botApiKey }});
		} catch (fetchError) {
			console.log(`Couldn't fetch users data: \n${fetchError}`);
			return -1;
		}
		for (const user of users_data) {
			users.push({ pb_id: user.id, username: user.username, global_name: user.global_name});
		}
		return users;
	},
	async updateCache(update_levels, update_packs, update_users) {
		const { cache } = require('./index.js');
		console.log('Updating cache...');

		if (update_levels) {
			const levels_data = await module.exports.fetchListData();
			if (levels_data == -1) return;
			cache.levels.destroy({ where: {}});
			try {
				cache.levels.bulkCreate(levels_data);
				console.log(`Successfully updated ${levels_data.length} cached levels.`);
			} catch (error) {
				console.log(`Couldn't udate cached levels, something went wrong with sequelize: ${error}`);
			}
		}
		if (update_packs) {
			const packs_data = await module.exports.fetchPackData();
			if (packs_data == -1) return;
			cache.packs.destroy({ where: {}});
			try {
				cache.packs.bulkCreate(packs_data);
				console.log(`Successfully updated ${packs_data.length} cached packs.`);
			} catch (error) {
				console.log(`Couldn't udate cached packs, something went wrong with sequelize: ${error}`);
			}
		}
		if (update_users) {
			const users_data = await module.exports.fetchUserData();
			if (users_data == -1) return;
			cache.users.destroy({ where: {}});
			try {
				cache.users.bulkCreate(users_data);
				console.log(`Successfully updated ${users_data.length} cached users.`);
			} catch (error) {
				console.log(`Couldn't udate cached users, something went wrong with sequelize: ${error}`);
			}
		}
	}
};