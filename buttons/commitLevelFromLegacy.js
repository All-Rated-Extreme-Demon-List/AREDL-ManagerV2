const { githubOwner, githubRepo, githubDataPath, githubBranch } = require('../config.json');

module.exports = {
	customId: 'commitLevelFromLegacy',
	ephemeral: true,
	async execute(interaction) {
		const { octokit, db } = require('../index.js');

		// Check for level info corresponding to the message id
		const level = await db.levelsFromLegacy.findOne({ where: { discordid: interaction.message.id } });
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
			console.log('No changelog file found, creating a new one');
		}

		const list = JSON.parse(Buffer.from(list_response.data.content, 'base64').toString('utf-8'));
		const legacy = JSON.parse(Buffer.from(legacy_response.data.content, 'base64').toString('utf-8'));

		const currentLegacyPosition = legacy.indexOf(level.filename) + 1;
		if (currentLegacyPosition == -1) return await interaction.editReply(':x: The given level is not on the legacy list');

		const changelogList = changelog_response ? JSON.parse(Buffer.from(changelog_response.data.content, 'base64').toString('utf-8')) : [];

		if (level.position < 1 || level.position > list.length + 1) {
			return await interaction.editReply(':x: The given position is incorrect');
		}

		list.splice(level.position - 1, 0, level.filename);
		legacy.splice(currentLegacyPosition - 1, 1);

		changelogList.push({
			"date": Math.floor(new Date().getTime() / 1000),
			"action": "fromlegacy",
			"name": level.filename,
			"to_rank": level.position,
			"from_rank": list.length - 1 + currentLegacyPosition,
			"above": list[level.position] || null,
			"below": list[level.position - 2] || null,
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
			console.log(`Something went wrong while getting the latest commit SHA: \n${getRefErr}`);
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
			console.log(`Something went wrong while getting the latest commit: \n${getCommitErr}`);
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
			console.log(`Something went wrong while creating a new tree: \n${createTreeErr}`);
			return await interaction.editReply(':x: Couldn\'t commit to github, please try again later (createTreeError)');
		}

		let newCommit;
		try {
			// Create a new commit with this tree
			newCommit = await octokit.git.createCommit({
				owner: githubOwner,
				repo: githubRepo,
				message: `Moved ${level.filename} from legacy (${list.length + currentLegacyPosition}) to ${level.position} (${interaction.user.tag})`,
				tree: newTree.data.sha,
				parents: [commitSha],
			});
		} catch (createCommitErr) {
			console.log(`Something went wrong while creating a new commit: \n${createCommitErr}`);
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
			console.log(`Something went wrong while updating the branch reference: \n${updateRefErr}`);
			return await interaction.editReply(':x: Couldn\'t commit to github, please try again later (updateRefError)');
		}

		console.log(`${interaction.user.tag} (${interaction.user.id}) moved ${level.filename} from legacy (${list.length + currentLegacyPosition}) to (${level.position})`);
		try {
			console.log(`Successfully created commit on ${githubBranch}: ${newCommit.data.sha}`);
			db.levelsToLegacy.destroy({ where: { discordid: level.discordid } });
		} catch (cleanupErr) {
			console.log(`Successfully created commit on ${githubBranch}: ${newCommit.data.sha}, but an error occured while cleaning up:\n${cleanupErr}`);
		}

		return await interaction.editReply(`:white_check_mark: Successfully moved **${level.filename}.json** (${newCommit.data.html_url})`);
	},
};