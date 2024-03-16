const { fetchListData } = require('../utils.js');
const fs = require('node:fs');

module.exports = {
	name: 'updateListData',
	cron: '29 * * * *',
	enabled: true,
	async execute() {
		const { setLevelsDict } = require('../index.js');
		console.log('Fetching last list data...');
		fetchListData().then(data => {
			if (data === -1) return;
			fs.writeFile('data/cached_list.json', JSON.stringify(data, null, '\t'), function(err) {
				if (err) {
					console.log(err);
				}
			});

			setLevelsDict(data);
		});
	},
};