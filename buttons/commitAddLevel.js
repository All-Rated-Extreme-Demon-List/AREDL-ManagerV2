const { githubOwner, githubRepo, githubDataPath, githubBranch } = require('../config.json');

module.exports = {
	customId: 'commitAddLevel',
	ephemeral: true,
	async execute(interaction) {
		const { octokit, db } = require('../index.js');

		const lock = await db.messageLocks.findOne({ where: { discordid: interaction.message.id } });
		if (!lock) {
			await db.messageLocks.create({
				discordid: interaction.message.id,
				locked: true,
				userdiscordid: interaction.user.id,
			});
		} else {
			return await interaction.editReply(`:x: This interaction is being used by <@${lock.userdiscordid}>`);
		}

		// Check for level info corresponding to the message id
		const level = await db.levelsToPlace.findOne({ where: { discordid: interaction.message.id } });

		let list_response;
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

		const jsonList = JSON.parse(Buffer.from(list_response.data.content, 'base64').toString('utf-8'));
		const nbLevels = jsonList.length;

		if (level.position < 1 || level.position > nbLevels + 1) {
			return await interaction.editReply(':x: The given position is incorrect');
		}

		jsonList.splice(level.position - 1, 0, level.filename);

		// Check if file already exists
		try {
			await octokit.rest.repos.getContent({
				owner: githubOwner,
				repo: githubRepo,
				path: githubDataPath + `/${level.filename}.json`,
				branch: githubBranch,
			});
			await interaction.message.delete();
			return await interaction.editReply(':x: The file for this level already exists');

		} catch (_) {

			// File does not exist

			const changes = [
				{
					path: githubDataPath + '/_list.json',
					content: JSON.stringify(jsonList, null, '\t'),
				},
				{
					path: githubDataPath + `/${level.filename}.json`,
					content: level.githubCode,
				},
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
					message: `Placed ${level.filename} at ${level.position} (${interaction.user.tag})`,
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

			try {
				console.log(`Successfully created commit on ${githubBranch}: ${newCommit.data.sha}`);
				db.levelsToPlace.destroy({ where: { discordid: level.discordid } });
				await interaction.message.delete();
			} catch (cleanupErr) {
				console.log(`Successfully created commit on ${githubBranch}: ${newCommit.data.sha}, but an error occured while cleanin up:\n${cleanupErr}`);
			}

			return await interaction.editReply(`:white_check_mark: Successfully created file: **${level.filename}.json** (${newCommit.data.html_url})`);
		}
	},
};