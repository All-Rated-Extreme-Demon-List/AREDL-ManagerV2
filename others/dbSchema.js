const Sequelize = require('sequelize');
module.exports = {
	createDbSchema(sequelize) {
		const db = {};
		db.pendingRecords = sequelize.define('pendingRecords', {
			username: Sequelize.STRING,
			submitter: Sequelize.STRING,
			levelname: Sequelize.STRING,
			device: Sequelize.STRING,
			completionlink: Sequelize.STRING,
			raw: Sequelize.STRING,
			ldm: Sequelize.INTEGER,
			additionalnotes: Sequelize.STRING,
			discordid: {
				type: Sequelize.STRING,
				unique: true,
			},
			embedDiscordid: {
				type: Sequelize.STRING,
			},
			priority: Sequelize.BOOLEAN,
			assigned: Sequelize.STRING,
		});
		
		db.acceptedRecords = sequelize.define('acceptedRecords', {
			username: Sequelize.STRING,
			submitter: Sequelize.STRING,
			levelname: Sequelize.STRING,
			device: Sequelize.STRING,
			completionlink: Sequelize.STRING,
			raw: Sequelize.STRING,
			ldm: Sequelize.INTEGER,
			additionalnotes: Sequelize.STRING,
			priority: Sequelize.BOOLEAN,
			moderator: Sequelize.STRING,
		});
		
		db.deniedRecords = sequelize.define('deniedRecords', {
			username: Sequelize.STRING,
			submitter: Sequelize.STRING,
			levelname: Sequelize.STRING,
			device: Sequelize.STRING,
			completionlink: Sequelize.STRING,
			raw: Sequelize.STRING,
			ldm: Sequelize.INTEGER,
			additionalnotes: Sequelize.STRING,
			discordid: {
				type: Sequelize.STRING,
				unique: true,
			},
			priority: Sequelize.BOOLEAN,
			denyReason: Sequelize.STRING,
			moderator: Sequelize.STRING,
		});
		
		db.levelsToPlace = sequelize.define('levelsToPlace', {
			filename: Sequelize.STRING,
			position: Sequelize.INTEGER,
			githubCode: Sequelize.STRING,
			discordid: Sequelize.STRING,
		});

		db.levelsToMove = sequelize.define('levelsToMove', {
			filename: Sequelize.STRING,
			position: Sequelize.INTEGER,
			discordid: Sequelize.STRING,
		});

		db.changelog = sequelize.define('changelog', {
			levelname: Sequelize.STRING,
			old_position: Sequelize.INTEGER,
			new_position: Sequelize.INTEGER,
			level_above: Sequelize.STRING,
			level_below: Sequelize.STRING,
			action: Sequelize.STRING,
		});

		db.levelsToLegacy = sequelize.define('levelsToLegacy', {
			filename: Sequelize.STRING,
			discordid: Sequelize.STRING,
		});
		
		db.levelsFromLegacy = sequelize.define('levelsFromLegacy', {
			filename: Sequelize.STRING,
			position: Sequelize.INTEGER,
			discordid: Sequelize.STRING,
		});

		db.recordsToCommit = sequelize.define('recordsToCommit', {
			filename: Sequelize.STRING,
			githubCode: Sequelize.STRING,
			discordid: Sequelize.STRING,
			user: Sequelize.BIGINT,
		});
		
		db.messageLocks = sequelize.define('messageLocks', {
			discordid: Sequelize.STRING,
			locked: Sequelize.BOOLEAN,
			userdiscordid: Sequelize.STRING,
		});
		
		db.staffStats = sequelize.define('staffs', {
			moderator: Sequelize.STRING,
			nbRecords: Sequelize.INTEGER,
			nbAccepted: Sequelize.INTEGER,
			nbDenied: Sequelize.INTEGER,
		});
		
		db.shifts = sequelize.define('shifts', {
			moderator: Sequelize.STRING,
			day: Sequelize.STRING,
		});
		
		
		db.dailyStats = sequelize.define('dailyStats', {
			date: Sequelize.DATEONLY,
			nbRecordsSubmitted: { type: Sequelize.NUMBER, defaultValue: 0 },
			nbRecordsPending: { type: Sequelize.NUMBER, defaultValue: 0 },
			nbRecordsAccepted: { type: Sequelize.NUMBER, defaultValue: 0 },
			nbRecordsDenied: { type: Sequelize.NUMBER, defaultValue: 0 },
			nbMembersJoined: { type: Sequelize.NUMBER, defaultValue: 0 },
			nbMembersLeft: { type: Sequelize.NUMBER, defaultValue: 0 },
		});
		
		db.staffSettings = sequelize.define('settings', {
			moderator: Sequelize.STRING,
			sendAcceptedInDM: {
				type: Sequelize.BOOLEAN,
				defaultValue: false,
			},
			shiftReminder: {
				type:Sequelize.BOOLEAN,
				defaultValue: false,
			}
		});
		
		db.infos = sequelize.define('infos', {
			name: Sequelize.STRING,
			status: {
				type: Sequelize.BOOLEAN,
				defaultValue: false,
			},
		});

		db.fish = sequelize.define('fish', {
			user: Sequelize.STRING,
			amount: Sequelize.DOUBLE,
		});

		return db;
	},
	
	createCacheDbSchema(sequelize_cache) {
		const cache = {};
		const { updateCachedLevels, updateCachedUsers } = require('./cacheUpdate.js');
		cache.levels = sequelize_cache.define('levels', {
			name: Sequelize.STRING,
			position: Sequelize.INTEGER,
			filename: Sequelize.STRING,
		});

		cache.legacy = sequelize_cache.define('legacy_levels', {
			name:Sequelize.STRING,
			position: Sequelize.INTEGER,
			filename: Sequelize.STRING,
		})

		cache.users = sequelize_cache.define('users', {
			name: Sequelize.STRING,
			user_id: Sequelize.STRING,
		});

		cache.updateLevels = async () => await updateCachedLevels();
		cache.updateUsers = async () => await updateCachedUsers();
		return cache;
	}
};