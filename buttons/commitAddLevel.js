const { githubOwner, githubRepo, githubDataPath, githubBranch } = require('../config.json');

module.exports = {
	customId: 'commitAddLevel',
	ephemeral: true,
	async execute(interaction) {
		const { octokit, dbLevelsToPlace } = require('../index.js');
		// Check for level info corresponding to the message id
		const level = await dbLevelsToPlace.findOne({ where: { discordid: interaction.message.id } });

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


			try {
				// Get the SHA of the latest commit from the branch
				const { data: refData } = await octokit.git.getRef({
					owner: githubOwner,
					repo: githubRepo,
					ref: `heads/${githubBranch}`,
				});
				const commitSha = refData.object.sha;

				// Get the commit using its SHA
				const { data: commitData } = await octokit.git.getCommit({
					owner: githubOwner,
					repo: githubRepo,
					commit_sha: commitSha,
				});
				const treeSha = commitData.tree.sha;

				// Create a new tree with the changes
				const newTree = await octokit.git.createTree({
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

				// Create a new commit with this tree
				const newCommit = await octokit.git.createCommit({
					owner: githubOwner,
					repo: githubRepo,
					message: `Placed ${level.filename} at ${level.position} (${interaction.user.tag})`,
					tree: newTree.data.sha,
					parents: [commitSha],
				});

				// Update the branch to point to the new commit
				await octokit.git.updateRef({
					owner: githubOwner,
					repo: githubRepo,
					ref: `heads/${githubBranch}`,
					sha: newCommit.data.sha,
				});

				console.log(`Successfully created commit on ${githubBranch}: ${newCommit.data.sha}`);
				dbLevelsToPlace.destroy({ where: { discordid: level.discordid } });
				await interaction.message.delete();
				return await interaction.editReply(`:white_check_mark: Successfully created file: **${level.filename}.json** (${newCommit.data.html_url})`);

			} catch (error) {
				console.error('Failed to create commit:', error);
				return await interaction.editReply(':x: Something went wrong while creating the file on github, please try again later');
			}
		}
	},
};