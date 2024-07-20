const { json } = require('sequelize');
const { githubOwner, githubRepo, githubDataPath, githubBranch } = require('../config.json');

module.exports = {
	customId: 'commitMoveLevel',
	ephemeral: true,
	async execute(interaction) {
		const { octokit, db, cache } = require('../index.js');

		// Check for level info corresponding to the message id
		const level = await db.levelsToMove.findOne({ where: { discordid: interaction.message.id } });

		let list_response;
		let changelog_response;
		try {
			list_response = await octokit.rest.repos.getContent({
				owner: githubOwner,
				repo: githubRepo,
				path: githubDataPath + '/_list.json',
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

		
		const jsonList = JSON.parse(Buffer.from(list_response.data.content, 'base64').toString('utf-8'));
		const currentPosition = jsonList.indexOf(level.filename) + 1;
		const nbLevels = jsonList.length;

		const changelogList = changelog_response ? JSON.parse(Buffer.from(changelog_response.data.content, 'base64').toString('utf-8')) : [];

		if (level.position < 1 || level.position > nbLevels + 1) {
			return await interaction.editReply(':x: The given position is incorrect');
		}
		jsonList.splice(currentPosition - 1, 1);
		jsonList.splice(level.position - 1, 0, level.filename);

		
		changelogList.push({
			"date": Math.floor(new Date().getTime() / 1000),
			"action": (currentPosition < level.position) ? "lowered" : "raised",
			"name": level.filename,
			"to_rank": level.position,
			"from_rank": currentPosition,
			"above": jsonList[level.position] || null,
			"below": jsonList[level.position - 2] || null,
		});


			const changes = [
				{
					path: githubDataPath + '/_list.json',
					content: JSON.stringify(jsonList, null, '\t'),
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
					message: `${currentPosition < level.position ? "Lowered" : "Raised"} ${level.filename} from ${currentPosition} to ${level.position} (${interaction.user.tag})`,
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

			console.log(`${interaction.user.tag} (${interaction.user.id}) moved ${level.filename} from ${currentPosition} to ${level.position}`);
			try {
				console.log(`Successfully created commit on ${githubBranch}: ${newCommit.data.sha}`);
				db.levelsToMove.destroy({ where: { discordid: level.discordid } });
			} catch (cleanupErr) {
				console.log(`Successfully created commit on ${githubBranch}: ${newCommit.data.sha}, but an error occured while cleanin up:\n${cleanupErr}`);
			}

			return await interaction.editReply(`:white_check_mark: Successfully moved **${level.filename}.json** (${newCommit.data.html_url})`);
		
	},
};