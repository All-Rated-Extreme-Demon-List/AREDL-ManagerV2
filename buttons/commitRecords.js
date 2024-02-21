const { dbRecordsToCommit, dbMessageLocks } = require('../index.js');
const { githubOwner, githubRepo, githubDataPath, githubBranch } = require('../config.json');
const { EmbedBuilder } = require('discord.js');

module.exports = {
	customId: 'commitRecords',
	ephemeral: true,
	async execute(interaction) {
		const lock = await dbMessageLocks.findOne({ where: { discordid: interaction.message.id } });
		if (!lock) {
			await dbMessageLocks.create({
				discordid: interaction.message.id,
				locked: true,
				userdiscordid: interaction.user.id,
			});
		} else {
			return await interaction.editReply(`:x: This interaction is being used by <@${lock.userdiscordid}>`);
		}

		const recordsToCommit = await dbRecordsToCommit.findAll({ where: { discordid: interaction.message.id } });
		const { octokit } = require('../index.js');

		let addedRecords = 0;
		let duplicateRecords = 0;
		let erroredRecords = 0;

		// Caching current file data from github
		const previousContent = {};
		for (const record of recordsToCommit) {
			const filename = record.dataValues['filename'];
			if (!previousContent[filename]) {
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
					console.log(`Unable to parse data fetched from ${filename}:\n${parseError}`);
					continue;
				}
				if (!Array.isArray(parsedData.records)) {
					console.log(`The records field of the fetched ${filename}.json is not an array`);
					continue;
				}
				previousContent[filename] = parsedData;
			}
		}
		// Patching together different records for the same file
		interaction.editReply('Looking for duplicate records...');
		const newContent = {};
		for (const record of recordsToCommit) {
			const filename = record.dataValues['filename'];
			const githubCode = record.dataValues['githubCode'];
			const user = record.dataValues['user'];

			if (!previousContent[filename]) {
				erroredRecords++;
				interaction.editReply(`Found ${duplicateRecords} duplicate and ${erroredRecords} errored records...`);
				continue;
			}

			// If duplicate, don't add it to githubCodes
			if (previousContent[filename].records.some(fileRecord => fileRecord.user === user)) {
				console.log(`Canceled adding duplicated record of ${filename} for ${user}`);
				await dbRecordsToCommit.destroy({ where: { id: record.dataValues['id'] } });
				duplicateRecords++;
				interaction.editReply(`Found ${duplicateRecords} duplicate and ${erroredRecords} errored records...`);
				continue;
			}

			let newRecord;
			try {
				newRecord = JSON.parse(githubCode);
			} catch (parseError) {
				console.log(`Unable to parse data:\n${githubCode}\n${parseError}`);
				erroredRecords++;
				interaction.editReply(`Found ${duplicateRecords} duplicate and ${erroredRecords} errored records...`);
				continue;
			}

			// If there's no attribute for that file yet, add it, otherwise concatenate it after the last one
			if (!newContent[filename]) {
				newContent[filename] = [newRecord];
			} else {
				if (newContent[filename].some(fileRecord => fileRecord.user === user)) {
					console.log(`Canceled adding duplicated record of ${filename} for ${user}`);
					await dbRecordsToCommit.destroy({ where: { id: record.dataValues['id'] } });
					duplicateRecords++;
					interaction.editReply(`Found ${duplicateRecords} duplicate and ${erroredRecords} errored records...`);
					continue;
				}
				newContent[filename].push(newRecord);
			}
		}

		interaction.editReply('Building changes...');

		const changes = [];
		// Creating changed data
		for (const filename of Object.keys(newContent)) {

			// Patching previouw and new content together
			const content = previousContent[filename];
			content.records = content.records.concat(newContent[filename]);

			// Save changes
			changes.push({
				path: githubDataPath + `/${filename}.json`,
				content: JSON.stringify(content, null, '\t'),
			});
			addedRecords += newContent[filename].length;
		}

		if (changes.length === 0) {
			console.log('No new or updated records to commit after filtering out duplicates and errors.');
			await dbMessageLocks.destroy({ where: { discordid: interaction.message.id } });
			return await interaction.editReply(':x: No changes to commit after removing duplicates and handling errors.');
		}

		interaction.editReply('Building commit...');
		let commitSha;
		try {
			// Get the SHA of the latest commit from the branch
			const { data: refData } = await octokit.git.getRef({
				owner: githubOwner,
				repo: githubRepo,
				ref: `heads/${githubBranch}`,
			});
			commitSha = refData.object.sha;
		} catch (getRefError) {
			console.log(`Something went wrong while fetching the latest commit SHA:\n${getRefError}`);
			await dbMessageLocks.destroy({ where: { discordid: interaction.message.id } });
			return await interaction.editReply(':x: Something went wrong while commiting the records to github, please try again later (getRefError)');
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
		} catch (getCommitError) {
			console.log(`Something went wrong while fetching the latest commit:\n${getCommitError}`);
			await dbMessageLocks.destroy({ where: { discordid: interaction.message.id } });
			return await interaction.editReply(':x: Something went wrong while commiting the records to github, please try again later (getCommitError)');
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
		} catch (createTreeError) {
			console.log(`Something went wrong while creating a new tree:\n${createTreeError}`);
			await dbMessageLocks.destroy({ where: { discordid: interaction.message.id } });
			return await interaction.editReply(':x: Something went wrong while commiting the records to github, please try again later (createTreeError)');
		}

		let newCommit;
		try {
			// Create a new commit with this tree
			newCommit = await octokit.git.createCommit({
				owner: githubOwner,
				repo: githubRepo,
				message: `Added ${addedRecords} records (${interaction.user.tag})`,
				tree: newTree.data.sha,
				parents: [commitSha],
			});
		} catch (createCommitError) {
			console.log(`Something went wrong while creating a new commit:\n${createCommitError}`);
			await dbMessageLocks.destroy({ where: { discordid: interaction.message.id } });
			return await interaction.editReply(':x: Something went wrong while commiting the records to github, please try again later (createCommitError)');
		}

		try {
			// Update the branch to point to the new commit
			await octokit.git.updateRef({
				owner: githubOwner,
				repo: githubRepo,
				ref: `heads/${githubBranch}`,
				sha: newCommit.data.sha,
			});
		} catch (updateRefError) {
			console.log(`Something went wrong while updating the branch :\n${updateRefError}`);
			await dbMessageLocks.destroy({ where: { discordid: interaction.message.id } });
			return await interaction.editReply(':x: Something went wrong while commiting the records to github, please try again later (updateRefError)');
		}
		console.log(`Successfully created commit on ${githubBranch} (record addition): ${newCommit.data.sha}`);
		try {
			await dbRecordsToCommit.destroy({ where: { discordid: interaction.message.id } });
			await dbMessageLocks.destroy({ where: { discordid: interaction.message.id } });
			await interaction.message.delete();
		} catch (cleanupError) {
			console.log(`Something went wrong while cleaning up the commit database & discord message:\n${cleanupError}`);
		}
		const replyEmbed = new EmbedBuilder()
			.setColor(0x8fce00)
			.setTitle(':white_check_mark: Commit successful')
			.setDescription(`Successfully commited ${addedRecords}/${recordsToCommit.length} records`)
			.addFields(
				{ name: 'Commit link:', value: `${newCommit.data.html_url}` },
				{ name: 'Duplicates found:', value: `**${duplicateRecords}**`, inline: true },
				{ name: 'Errors:', value: `${erroredRecords}`, inline: true },
			)
			.setTimestamp();
		return await interaction.editReply({ content: '', embeds: [ replyEmbed ] });
	},
};