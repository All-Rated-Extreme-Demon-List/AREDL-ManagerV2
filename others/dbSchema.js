const Sequelize = require('sequelize');
module.exports = {
	createDbSchema(sequelize) {
		const db = {};
		db.dbPendingRecords = sequelize.define('pendingRecords', {
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
		
		db.dbAcceptedRecords = sequelize.define('acceptedRecords', {
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
		
		db.dbDeniedRecords = sequelize.define('deniedRecords', {
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
		
		db.staffStats = sequelize.define('staffs', {
			moderator: Sequelize.STRING,
			nbRecords: Sequelize.INTEGER,
			nbAccepted: Sequelize.INTEGER,
			nbDenied: Sequelize.INTEGER,
		});
		
		db.dbShifts = sequelize.define('shifts', {
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
		
		db.dbInfos = sequelize.define('infos', {
			name: Sequelize.STRING,
			status: {
				type: Sequelize.BOOLEAN,
				defaultValue: false,
			},
		});
		
		return db;
	}
}