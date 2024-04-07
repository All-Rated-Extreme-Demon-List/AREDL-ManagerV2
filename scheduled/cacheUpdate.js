module.exports = {
	name: 'cacheUpdate',
	cron: '5 * * * *',
	enabled: true,
	async execute() {
		const { cache } = require('../index.js');
		await cache.update();
	},
};