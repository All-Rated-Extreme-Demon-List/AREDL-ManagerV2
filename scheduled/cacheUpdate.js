const { fetchListData, fetchPackData } = require('../utils.js');
const fs = require('node:fs');

module.exports = {
	name: 'cacheUpdate',
	cron: '5 * * * *',
	enabled: true,
	async execute() {
		const { cache } = require('../index.js');
		console.log('Updating cache...');
		const levels_data = await fetchListData();
		const packs_data = await fetchPackData();

		if (levels_data == -1 || packs_data == -1) return;

		const levels_array = [];
		const packs_array = [];
	
		for (const levelname of Object.keys(levels_data)) levels_array.push({ name: levelname, pb_id: levels_data[levelname].id, creators: JSON.stringify(levels_data[levelname].creators)});
		for (const packname of Object.keys(packs_data)) packs_array.push({ name: packname, pb_id: packs_data[packname].id, levels: JSON.stringify(packs_data[packname].levels)});

		cache.levels.destroy({ where: {} });
		cache.packs.destroy({ where: {} });

		try {
			cache.levels.bulkCreate(levels_array);
			cache.packs.bulkCreate(packs_array);
		} catch (error) {
			console.log(`Couldn't update cached data, something went wrong with sequelize: ${error}`);
		}

		console.log(`Successfully updated cache data (${levels_array.length} levels and ${packs_array.length} packs)`);
	},
};