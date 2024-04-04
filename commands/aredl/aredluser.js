const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	cooldown: 5,
	enabled: true,
	data: new SlashCommandBuilder()
		.setName('aredluser')
		.setDescription('Staff website users management')
		.addSubcommand(subcommand =>
			subcommand
				.setName('createplaceholder')
				.setDescription('Creates a new placeholder user')
				.addStringOption(option =>
					option.setName('user')
						.setDescription('The name of the placeholder user to create')
						.setMinLength(1)
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('ban')
				.setDescription('Bans a user from the website')
				.addStringOption(option =>
					option.setName('user')
						.setDescription('The name of the user to ban')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('unban')
				.setDescription('Unbans a banned user from the website')
				.addStringOption(option =>
					option.setName('user')
						.setDescription('The name of the user to unban')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('addrole')
				.setDescription('Adds a role to a user (requires permission to affect both role and user)')
				.addStringOption(option =>
					option.setName('user')
						.setDescription('The name of the user to edit')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('role')
						.setDescription('The role to add')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('removerole')
				.setDescription('Removes a role from a user (requires permission to affect both role and user)')
				.addStringOption(option =>
					option.setName('user')
						.setDescription('The name of the user to edit')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('role')
						.setDescription('The role to remove')
						.setMinLength(1)
						.setAutocomplete(true)
						.setRequired(true))),
	async autocomplete(interaction) {
		const focused = interaction.options.getFocused(true);
		const { pb } = require('../../index.js');
		const { getRegisteredKey } = require('../../utils.js');
		const key = await getRegisteredKey(interaction);
		if (key==-1) return;
		
		if (focused.name == 'user') {
			let results;
			try {
				results = await pb.send('/api/users', {
					method: 'GET',
					query: {
						'per_page': 25,
						'name_filter': focused.value
					},
					headers: {
						'api-key': key
					}
				});
			} catch (err) {
				return await interaction.respond([]);
			}
			await interaction.respond(
				results.map(user => ({ name:user.name, value: user.name })),
			);
		} else {
			let user_perms;
			try {
				user_perms = await pb.send('/api/me/permissions', {
					headers: {
						'api-key': key
					},
				});	
			} catch (error)	{ /* Nothing */ }
			const change_role_perm = user_perms['global.user_change_role'];
			if (!change_role_perm) return await interaction.respond([]);
			return await interaction.respond(
				change_role_perm.affected_roles.map(role => ({name:role, value:role}))
			);
		}
	},
	async execute(interaction) {

		await interaction.deferReply({ephemeral: true});

		const { getRegisteredKey, getUserPbId } = require('../../utils.js');
		const { pb } = require('../../index.js');
		const key = await getRegisteredKey(interaction);
		if (key==-1) return;

		if (interaction.options.getSubcommand() == 'createplaceholder') {
			const username = interaction.options.getString('user');
			let user_id = await getUserPbId(interaction, username, key);
		
			if (user_id != -1) return;
			else {
				let placed_user;
				try {
					placed_user = await pb.send('/api/users/placeholder', {
						method: 'POST', query: {'username': username}, headers: {'api-key': key}
					});
				} catch (err) {
					if (err.status == 403) return await interaction.editReply(':x: You do not have permission to create placeholder users on the website');
					else return await interaction.editReply(`:x: Couldn't create a new placeholder user: ${JSON.stringify(err.response)}`);
				}
				console.log(`${interaction.user.tag} (${interaction.user.id}) created placeholder ${username} (${placed_user.id})`);
				return await interaction.editReply(':white_check_mark: The placeholder user was created successfully');
			}

		} else if (interaction.options.getSubcommand() == 'ban') {
			const username = interaction.options.getString('user');
			let user_id = await getUserPbId(interaction, username, key);
			
			if (user_id == -2) return;
			if (user_id == -1) return await interaction.editReply(':x: This user does not exist');

			try {
				await pb.send(`/api/users/${user_id}/ban`, {
					method: 'POST', headers: {'api-key': key}
				});
			} catch (err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to ban this user');
				else return await interaction.editReply(`:x: Couldn't ban the user: ${JSON.stringify(err.response)}`);
			}
			console.log(`${interaction.user.tag} (${interaction.user.id}) banned ${username} (${user_id})`);
			return await interaction.editReply(':white_check_mark: The user was banned successfully');
			
		} else if (interaction.options.getSubcommand() == 'unban') {
			const username = interaction.options.getString('user');
			let user_id = await getUserPbId(interaction, username, key);
			
			if (user_id == -2) return;
			if (user_id == -1) return await interaction.editReply(':x: This user does not exist');

			try {
				await pb.send(`/api/users/${user_id}/unban`, {
					method: 'POST', headers: {'api-key': key}
				});
			} catch (err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to unban this user');
				else return await interaction.editReply(`:x: Couldn't unban the user: ${JSON.stringify(err.response)}`);
			}
			console.log(`${interaction.user.tag} (${interaction.user.id}) unbanned ${username} (${user_id})`);
			return await interaction.editReply(':white_check_mark: The user was unbanned successfully');

		} else if (interaction.options.getSubcommand() == 'addrole') {

			const username = interaction.options.getString('user');
			const role = interaction.options.getString('role');
			let user_id = await getUserPbId(interaction, username, key);
			
			if (user_id == -2) return;
			if (user_id == -1) return await interaction.editReply(':x: This user does not exist');

			let user_perms;
			try {
				user_perms = await pb.send('/api/me/permissions', {
					headers: {
						'api-key': key
					},
				});	
			} catch (error)	{ /* Nothing */ }
			const change_role_perm = user_perms['global.user_change_role'];
			if (!change_role_perm) return await interaction.editReply(':x: You do not have the permission to change user roles on the website');
			if (!change_role_perm.affected_roles.includes(role)) return await interaction.editReply(':x: This role does not exist, or you do not have the permission to affect it');
		
			let user;
			try {
				user = await pb.send(`/api/aredl/profiles/${user_id}`, {
					headers: {
						'api-key': key
					},
				});
			} catch (error) {
				return await interaction.editReply(`:x: Could'nt fetch this user's profile data:${JSON.stringify(error.response)}`);
			}

			let roles = user.roles;
			if (roles.includes(role)) return await interaction.editReply(':x: This user already has this role');
			
			roles.push(role);

			try {
				await pb.send(`/api/users/${user_id}/role`, {
					method: 'PATCH', query: {'roles':JSON.stringify(roles)}, headers: {'api-key': key}
				});
			} catch(err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to update user roles on the website');
				else return await interaction.editReply(`:x: Couldn't update the user roles: ${JSON.stringify(err.response)}`);
			}

			console.log(`${interaction.user.tag} (${interaction.user.id}) updated roles of ${username} (${JSON.stringify(roles)})`);
			await interaction.editReply(':white_check_mark: The user was updated successfully');
			return;

		} else if (interaction.options.getSubcommand() == 'removerole') {
			const username = interaction.options.getString('user');
			const role = interaction.options.getString('role');
			let user_id = await getUserPbId(interaction, username, key);
			
			if (user_id == -2) return;
			if (user_id == -1) return await interaction.editReply(':x: This user does not exist');

			let user_perms;
			try {
				user_perms = await pb.send('/api/me/permissions', {
					headers: {
						'api-key': key
					},
				});	
			} catch (error)	{ /* Nothing */ }
			const change_role_perm = user_perms['global.user_change_role'];
			if (!change_role_perm) return await interaction.editReply(':x: You do not have the permission to change user roles on the website');
			if (!change_role_perm.affected_roles.includes(role)) return await interaction.editReply(':x: This role does not exist, or you do not have the permission to affect it');

			let user;
			try {
				user = await pb.send(`/api/aredl/profiles/${user_id}`, {
					headers: {
						'api-key': key
					},
				});
			} catch (error) {
				return await interaction.editReply(`:x: Could'nt fetch this user's profile data:${JSON.stringify(error.response)}`);
			}

			let roles = user.roles;
			if (!roles.includes(role)) return await interaction.editReply(':x: This user does not have this role');
			
			roles = roles.filter(current_role => current_role !== role);

			try {
				await pb.send(`/api/users/${user_id}/role`, {
					method: 'PATCH', query: {'roles':JSON.stringify(roles)}, headers: {'api-key': key}
				});
			} catch(err) {
				if (err.status == 403) return await interaction.editReply(':x: You do not have permission to update user roles on the website');
				else return await interaction.editReply(`:x: Couldn't update the user roles: ${JSON.stringify(err.response)}`);
			}

			console.log(`${interaction.user.tag} (${interaction.user.id}) updated roles of ${username} (${JSON.stringify(roles)})`);
			await interaction.editReply(':white_check_mark: The user was updated successfully');
			return;
		}

	},
};