const Sequelize = require('sequelize');
module.exports = {
	createDbSchema(sequelize) {
		const db = {};
		db.pendingRecords = sequelize.define('pendingRecords', {
			username: Sequelize.STRING,
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
			pocketbaseId: Sequelize.STRING,
			assigned: Sequelize.STRING,
		});
		
		db.acceptedRecords = sequelize.define('acceptedRecords', {
			username: Sequelize.STRING,
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
			pocketbaseId: Sequelize.STRING,
			moderator: Sequelize.STRING,
		});

		db.mergeRequests = sequelize.define('merges', {
			pb_id: Sequelize.STRING,
			user: Sequelize.STRING,
			user_discord: Sequelize.STRING,
			to_merge: Sequelize.STRING,
			to_merge_discord: Sequelize.STRING,
			discordid: {
				type: Sequelize.STRING,
				unique: true,
			},
		});

		db.nameRequests = sequelize.define('namechanges', {
			pb_id: Sequelize.STRING,
			user: Sequelize.STRING,
			user_discord: Sequelize.STRING,
			new_name: Sequelize.STRING,
			discordid: {
				type: Sequelize.STRING,
				unique: true,
			},
		});
		
		db.shifts = sequelize.define('shifts', {
			moderator: Sequelize.STRING,
			day: Sequelize.STRING,
		});
		
		
		db.dailyStats = sequelize.define('dailystats', {
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
			pbKey: Sequelize.STRING,
		});
		
		db.staffStats = sequelize.define('staffs', {
			moderator: Sequelize.STRING,
			nbRecords: Sequelize.INTEGER,
			nbAccepted: Sequelize.INTEGER,
			nbDenied: Sequelize.INTEGER,
		});

		db.infos = sequelize.define('infos', {
			name: Sequelize.STRING,
			status: {
				type: Sequelize.BOOLEAN,
				defaultValue: false,
			},
		});
		
		db.levelsToPlace = sequelize.define('levelsToPlace', {
			levelname: Sequelize.STRING,
			position: Sequelize.INTEGER,
			levelid: Sequelize.INTEGER,
			uploader: Sequelize.STRING,
			verifier: Sequelize.STRING,
			creator: Sequelize.STRING,
			verification: Sequelize.STRING,
			password: Sequelize.STRING,
			discordid: Sequelize.STRING,
			mobile: { type:Sequelize.BOOLEAN, defaultValue: false },
			legacy: { type:Sequelize.BOOLEAN, defaultValue: false },
		});

		return db;
	},
	
	createCacheDbSchema(sequelize_cache) {
		const cache = {};

		cache.levels = sequelize_cache.define('levels', {
			name: Sequelize.STRING,
			pb_id: Sequelize.STRING,
			creators: Sequelize.STRING,
		});

		cache.packs = sequelize_cache.define('packs', {
			name: Sequelize.STRING,
			pb_id: Sequelize.STRING,
			levels: Sequelize.STRING,
		});

		return cache;
	}
};