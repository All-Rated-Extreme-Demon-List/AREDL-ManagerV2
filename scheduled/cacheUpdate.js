module.exports = {
	name: 'updateCache',
	cron: '30 * * * *',
	enabled: true,
	async execute() {
		const { cache } = require('../index.js');
		cache.updateLevels();
		cache.updateUsers();
	},
};