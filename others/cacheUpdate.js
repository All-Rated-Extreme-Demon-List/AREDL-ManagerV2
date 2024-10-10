const { githubBranch, githubDataPath, githubOwner, githubRepo } = require('../config.json');
const logger = require('log4js').getLogger();
const { cloneOrPullRepo, parseLevels } = require('./gitUtils.js');
module.exports = {
	async updateCachedLevels() {
		const { cache } = require('../index.js');

		logger.info('Scheduled - ' + 'Updating cached levels...');
		
		await cloneOrPullRepo();
		logger.info('Scheduled - ' + 'Parsing levels...');
		const levels = await parseLevels();
		
		if (levels.length > 0) {
			await cache.levels.destroy({ where: {}});
			try {
				await cache.levels.bulkCreate(levels);
				logger.info('Scheduled - ' + `Successfully updated ${levels.length} cached levels.`);
			} catch (error) {
				logger.error('Scheduled - ' + `Couldn't udate cached levels, something went wrong with sequelize: ${error}`);
			}
		} else {
			logger.error('Scheduled - ' + 'Canceled updating levels cachee: no levels found.');
		}

		logger.info('Scheduled - ' + 'Parsing legacy levels...');
		const legacy_levels = await parseLevels(true);
		
		if (legacy_levels.length > 0) {
			await cache.legacy.destroy({ where: {}});
			try {
				await cache.legacy.bulkCreate(legacy_levels);
				logger.info('Scheduled - ' + `Successfully updated ${legacy_levels.length} cached legacy levels.`);
			} catch (error) {
				logger.error('Scheduled - ' + `Couldn't udate cached legacy levels, something went wrong with sequelize: ${error}`);
			}
		} else {
			logger.error('Scheduled - ' + 'Canceled updating legacy levels cachee: no levels found.');
		}
		logger.info('Scheduled - ' + 'Successfully updated cached levels.');
		
	},
	async updateCachedUsers() {

		const { octokit, cache } = require('../index.js');
		const users = [];
		logger.info('Updating cached users...');

		let usersFileResponse;
		try {
			usersFileResponse = await octokit.rest.repos.getContent({
				owner: githubOwner,
				repo: githubRepo,
				path: githubDataPath + `/_name_map.json`,
				branch: githubBranch,
			});
		} catch (fetchError) {
			logger.info(`Couldn't fetch _name_map.json: \n${fetchError}`);
			return -1;
		}
		
		let users_data;
	
		try {
			users_data = JSON.parse(Buffer.from(usersFileResponse.data.content, 'base64').toString('utf-8'));
		} catch (parseError) {
			logger.info(`Unable to parse data fetched from _list.json:\n${parseError}`);
			return -1;
		}

		
		for (const user of Object.keys(users_data)) {
			users.push({ name: users_data[user], user_id: user});
		}

		cache.users.destroy({ where: {}});
		try {
			cache.users.bulkCreate(users);
			logger.info(`Successfully updated ${users.length} cached users.`);
		} catch (error) {
			logger.info(`Couldn't udate cached users, something went wrong with sequelize: ${error}`);
		}
	},
};