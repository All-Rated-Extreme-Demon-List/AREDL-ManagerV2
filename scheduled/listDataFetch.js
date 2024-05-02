module.exports = {
	name: 'updateListData',
	cron: '29 * * * *',
	enabled: true,
	async execute() {
		const { cache } = require('../index.js');
		cache.update();
	},
};