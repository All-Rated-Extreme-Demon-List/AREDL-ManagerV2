const fs = require('fs');
const path = require('path');
const logger = require('log4js').getLogger();

module.exports = {
	async cloneOrPullRepo() {
		const { git } = require('../index');

		logger.info('Git - ' + 'Updating GitHub repository...');
		
		try {
			const { repoUrl } = require("../config.json");
			const localRepoPath =  path.resolve(__dirname, `../data/repo/`);
			
			if (!fs.existsSync(localRepoPath)) {
				logger.info('Git - ' + 'Cloning the repository for the first time, this may take a while...');
				await git.clone(repoUrl, localRepoPath);
			} else {
				logger.info('Git - ' + 'Pulling the latest changes from the repository...');
				await git.cwd(localRepoPath).pull();
			}
		} catch (error) {
			logger.error('Git - ' + `Error updating the repository:\n${error}`);
			return -1;
		}
		logger.info('Git - ' + 'Successfully updated the repository');
		
	},
	async parseLevels(useLegacy) {
		const levels = [];
		const localRepoPath =  path.resolve(__dirname, `../data/repo/`);
		const listFilename = useLegacy ? 'data/_legacy.json' : 'data/_list.json';
		let list_data;
		try {
			list_data = JSON.parse(fs.readFileSync(path.join(localRepoPath, listFilename), 'utf8'));
		} catch (parseError) {
			logger.error('Git - ' + `Unable to parse data from ${listFilename}:\n${parseError}`);
			return -1;
		}

		let i = 1;
		for (const filename of list_data) {
			let parsedData;
			try {
				parsedData = JSON.parse(fs.readFileSync(path.join(localRepoPath, `data/${filename}.json`), 'utf8'));
			} catch (parseError) {
				logger.error('Git - ' + `Unable to parse data from ${filename}.json:\n${parseError}`);
				continue;
			}
			
			levels.push({ name: parsedData.name, position: i, filename: filename});
			i++;
		}
		return levels;
	}
}