const { githubBranch, githubDataPath, githubOwner, githubRepo } = require('./config.json');

module.exports = {
	async fetchListData() {

		const { octokit } = require('./index.js');
		const levels_dict = {};

		let listFileResponse;
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

		let list_data;
		try {
			list_data = JSON.parse(Buffer.from(listFileResponse.data.content, 'base64').toString('utf-8'));
		} catch (parseError) {
			console.log(`Unable to parse data fetched from _list.json:\n${parseError}`);
			return -1;
		}
	

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
				return -1;
			}
			let parsedData;
			try {
				parsedData = JSON.parse(Buffer.from(fileResponse.data.content, 'base64').toString('utf-8'));
			} catch (parseError) {
				console.log(`Unable to parse data fetched from ${filename}.json:\n${parseError}`);
				return -1;
			}
			levels_dict[parsedData.name] = filename;
		}
		
		console.log(`Successfully updated ${Object.keys(levels_dict).length} levels `);
		return levels_dict;
	},
};