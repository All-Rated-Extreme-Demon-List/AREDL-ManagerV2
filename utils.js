const { githubBranch, githubDataPath, githubOwner, githubRepo } = require('./config.json');

module.exports = {
	async updateCache() {

		const { octokit, cache } = require('./index.js');
		const levels = [];
		const legacy = [];
		console.log('Updating cache...');

		let listFileResponse;
		let legacyFileResponse;
		try {
			listFileResponse = await octokit.rest.repos.getContent({
				owner: githubOwner,
				repo: githubRepo,
				path: githubDataPath + `/_list.json`,
				branch: githubBranch,
			});
		} catch (fetchError) {
			console.log(`Couldn't fetch _list.json: \n${fetchError}`);
			return -1;
		}

		try {
			legacyFileResponse = await octokit.rest.repos.getContent({
				owner: githubOwner,
				repo: githubRepo,
				path: githubDataPath + `/_legacy.json`,
				branch: githubBranch,
			});
		} catch (fetchError) {
			console.log(`Couldn't fetch _legacy.json: \n${fetchError}`);
		}

		let list_data;
		let legacy_data;
	
		try {
			list_data = JSON.parse(Buffer.from(listFileResponse.data.content, 'base64').toString('utf-8'));
		} catch (parseError) {
			console.log(`Unable to parse data fetched from _list.json:\n${parseError}`);
			return -1;
		}

		if (legacyFileResponse) {
			try {
				legacy_data = JSON.parse(Buffer.from(legacyFileResponse.data.content, 'base64').toString('utf-8'));
			} catch (parseError) {
				console.log(`Unable to parse data fetched from _legacy.json:\n${parseError}`);
			}
		}
		
		let i = 1;
		for (const filename of list_data) {
			let fileResponse;
			try {
				fileResponse = await octokit.rest.repos.getContent({
					owner: githubOwner,
					repo: githubRepo,
					path: githubDataPath + `/${filename}.json`,
					branch: githubBranch,
				});
			} catch (fetchError) {
				console.log(`Couldn't fetch ${filename}.json: \n${fetchError}`);
				continue;
			}
			let parsedData;
			try {
				parsedData = JSON.parse(Buffer.from(fileResponse.data.content, 'base64').toString('utf-8'));
			} catch (parseError) {
				console.log(`Unable to parse data fetched from ${filename}.json:\n${parseError}`);
				continue;
			}
			
			levels.push({ name: parsedData.name, position: i, filename: filename});
			i++;
		}

		if (legacy_data) {
			let i = 1;
			for (const filename of legacy_data) {
				let fileResponse;
				try {
					fileResponse = await octokit.rest.repos.getContent({
						owner: githubOwner,
						repo: githubRepo,
						path: githubDataPath + `/${filename}.json`,
						branch: githubBranch,
					});
				} catch(fetchError) {
					console.log(`Couldn't fetch ${filename}.json: \n${fetchError}`);
					continue;
				}

				let parsedData;
				try {
					parsedData = JSON.parse(Buffer.from(fileResponse.data.content, 'base64').toString('utf-8'));
				} catch (parseError) {
					console.log(`Unable to parse data fetched from ${filename}.json:\n${parseError}`);
					continue;
				}

				legacy.push({ name: parsedData.name, position: i, filename: filename});
				i++;
			}
		}

		cache.levels.destroy({ where: {}});
			try {
				cache.levels.bulkCreate(levels);
				console.log(`Successfully updated ${levels.length} cached levels.`);
			} catch (error) {
				console.log(`Couldn't udate cached levels, something went wrong with sequelize: ${error}`);
			}
		cache.legacy.destroy({ where: {}});
			try {
				cache.legacy.bulkCreate(legacy);
				console.log(`Successfully updated ${legacy.length} cached legacy levels.`);
			} catch (error) {
				console.log(`Couldn't udate cached legacy levels, something went wrong with sequelize: ${error}`);
			}
	},
};