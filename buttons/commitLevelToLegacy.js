const { githubOwner, githubRepo, githubDataPath, githubBranch } = require('../config.json');
const logger = require('log4js').getLogger();

module.exports = {
	customId: 'commitLevelToLegacy',
	ephemeral: true,
	async execute(interaction) {
		const { octokit, db, cache } = require('../index.js');
		const { enableChangelogMessage } = require('../config.json');
		// Check for level info corresponding to the message id
		const level = await db.levelsToLegacy.findOne({ where: { discordid: interaction.message.id } });
		if (!level) {
			await interaction.editReply(':x: This action is no longer available');
			return await interaction.message.delete();
		}

		let list_response;
		let legacy_response
		let changelog_response;
		try {
			list_response = await octokit.rest.repos.getContent({
				owner: githubOwner,
				repo: githubRepo,
				path: githubDataPath + '/_list.json',
				branch: githubBranch,
			});
			legacy_response = await octokit.rest.repos.getContent({
				owner: githubOwner,
				repo: githubRepo,
				path: githubDataPath + '/_legacy.json',
				branch: githubBranch,
			});
		} catch (_) {
			return await interaction.editReply(':x: Something went wrong while fetching data from github, please try again later');
		}

		try {
			changelog_response = await octokit.rest.repos.getContent({
				owner: githubOwner,
				repo: githubRepo,
				path: githubDataPath + '/_changelog.json',
				branch: githubBranch,
			});
		} catch (_) {
			logger.info('No changelog file found, creating a new one');
		}

		const list = JSON.parse(Buffer.from(list_response.data.content, 'base64').toString('utf-8'));
		const legacy = JSON.parse(Buffer.from(legacy_response.data.content, 'base64').toString('utf-8'));

		const currentPosition = list.indexOf(level.filename) + 1;
		if (currentPosition == -1) return await interaction.editReply(':x: The given level is not on the list');

		const changelogList = changelog_response ? JSON.parse(Buffer.from(changelog_response.data.content, 'base64').toString('utf-8')) : [];

		list.splice(currentPosition - 1, 1);
		legacy.splice(0, 0, level.filename);
		
		changelogList.push({
			"date": Math.floor(new Date().getTime() / 1000),
			"action": "tolegacy",
			"name": level.filename,
			"to_rank": list.length + 1,
			"from_rank": currentPosition,
			"above": legacy[1] || null,
			"below": list[list.length - 1] || null,
		});

		const changes = [
			{
				path: githubDataPath + '/_list.json',
				content: JSON.stringify(list, null, '\t'),
			},
			{
				path: githubDataPath + '/_legacy.json',
				content: JSON.stringify(legacy, null, '\t'),
			},
			{
				path: githubDataPath + '/_changelog.json',
				content: JSON.stringify(changelogList, null, '\t'),
			}
		];

		let commitSha;
		try {
			// Get the SHA of the latest commit from the branch
			const { data: refData } = await octokit.git.getRef({
				owner: githubOwner,
				repo: githubRepo,
				ref: `heads/${githubBranch}`,
			});
			commitSha = refData.object.sha;
		} catch (getRefErr) {
			logger.info(`Something went wrong while getting the latest commit SHA: \n${getRefErr}`);
			return await interaction.editReply(':x: Couldn\'t commit to github, please try again later (getRefError)');
		}

		let treeSha;
		try {
			// Get the commit using its SHA
			const { data: commitData } = await octokit.git.getCommit({
				owner: githubOwner,
				repo: githubRepo,
				commit_sha: commitSha,
			});
			treeSha = commitData.tree.sha;
		} catch (getCommitErr) {
			logger.info(`Something went wrong while getting the latest commit: \n${getCommitErr}`);
			return await interaction.editReply(':x: Couldn\'t commit to github, please try again later (getCommitError)');
		}

		let newTree;
		try {
			// Create a new tree with the changes
			newTree = await octokit.git.createTree({
				owner: githubOwner,
				repo: githubRepo,
				base_tree: treeSha,
				tree: changes.map(change => ({
					path: change.path,
					mode: '100644',
					type: 'blob',
					content: change.content,
				})),
			});
		} catch (createTreeErr) {
			logger.info(`Something went wrong while creating a new tree: \n${createTreeErr}`);
			return await interaction.editReply(':x: Couldn\'t commit to github, please try again later (createTreeError)');
		}

		let newCommit;
		try {
			// Create a new commit with this tree
			newCommit = await octokit.git.createCommit({
				owner: githubOwner,
				repo: githubRepo,
				message: `"Lowered " ${level.filename} from ${currentPosition} to ${list.length + 1} (${interaction.user.tag})`,
				tree: newTree.data.sha,
				parents: [commitSha],
			});
		} catch (createCommitErr) {
			logger.info(`Something went wrong while creating a new commit: \n${createCommitErr}`);
			return await interaction.editReply(':x: Couldn\'t commit to github, please try again later (createCommitError)');
		}

		try {
			// Update the branch to point to the new commit
			await octokit.git.updateRef({
				owner: githubOwner,
				repo: githubRepo,
				ref: `heads/${githubBranch}`,
				sha: newCommit.data.sha,
			});
		} catch (updateRefErr) {
			logger.info(`Something went wrong while updating the branch reference: \n${updateRefErr}`);
			return await interaction.editReply(':x: Couldn\'t commit to github, please try again later (updateRefError)');
		}

		const levelname = (await cache.levels.findOne({ where: { filename: level.filename } }))?.name;
		try {		
			if (enableChangelogMessage) {
				await db.changelog.create({
					levelname: levelname,
					old_position: currentPosition,
					new_position: null,
					level_above: null,
					level_below: null,
					action: 'tolegacy',
				});
			}
		} catch (changelogErr) {
			logger.info(`An error occured while creating a changelog entry:\n${changelogErr}`);
			return await interaction.editReply(`:white_check_mark: Successfully moved **${level.filename}.json** (${newCommit.data.html_url}), but an error occured while creating a changelog entry`);
		}

		logger.info(`${interaction.user.tag} (${interaction.user.id}) moved ${level.filename} from ${currentPosition} to legacy (${list.length})`);
		try {
			logger.info(`Successfully created commit on ${githubBranch}: ${newCommit.data.sha}`);
			await db.levelsToLegacy.destroy({ where: { discordid: level.discordid } });
			await cache.levels.destroy({ where: { filename: level.filename } });
			await cache.legacy.create({ name: levelname, filename: level.filename, position: list.length + 1 });
		} catch (cleanupErr) {
			logger.info(`Successfully created commit on ${githubBranch}: ${newCommit.data.sha}, but an error occured while cleaning up:\n${cleanupErr}`);
		}

		return await interaction.editReply(`:white_check_mark: Successfully moved **${level.filename}.json** (${newCommit.data.html_url})`);
	},
};