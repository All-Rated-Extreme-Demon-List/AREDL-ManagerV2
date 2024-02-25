const { websiteDataLink } = require('./config.json');

module.exports = {
	async fetchListData() {
		const levels_dict = {};
		let list_data;
		try {
			list_data = await (await fetch(`${websiteDataLink}/_list.json`, {
				method: 'GET',
				headers: {
					'Accept': 'application/json',
				},
			})).json();
		} catch (fetchError) {
			console.log(`Failed to fetch list data: \n${fetchError}`);
			return -1;
		}

		for (const filename of list_data) {
			const file_data = await (await fetch(`${websiteDataLink}/${filename}.json`, {
				method: 'GET',
				headers: {
					'Accept': 'application/json',
				},
			})).json();
			levels_dict[file_data.name] = filename;
		}
		console.log('List data updated successfully');
		return levels_dict;
	},
};