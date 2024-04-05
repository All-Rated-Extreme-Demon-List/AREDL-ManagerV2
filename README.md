# AREDL Manager V2
This repository hosts the code for the discord bot made to help record submissions for the [All Rated Extreme Demons List](https://aredl.net)  
It is used to allow users to submit their records through discord, and to automatically add those records to a github repository that uses the [TSL List Template](https://github.com/TheShittyList/GDListTemplate)
## Setup
This bot does not provide any hosting, meaning that you will need to find a way to host it yourself.   
This bot was made with [discord.js](https://discord.js.org/): You will need to have [NodeJS](https://nodejs.org/en) installed (v16.11.0 or higher) to run it  
After node has been installed, to install the dependencies, run `npm install` in the bot's root directory
You will then need to create a config file (an example file is provided in `example_config.json`) and name it `config.json` in the root directory. It should contain the following:
> - `token`: The discord bot private token. If you do not know what a token is and how to set up a discord bot, refer to [this discord.js guide](https://discordjs.guide/preparations/setting-up-a-bot-application.html)
> - `githubToken`: The github token that will allow the bot to fetch data from and make changes to the github repository of the list. To create one, refer to [this github page](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
    
> - `enableSeparateStaffServer`: Enable this if there is a staff discord server for handling records that is not the public discord server. Will be used to fetch the following channels: `pendingRecordsID`,`priorityRecordsID`,`acceptedRecordsID`,`deniedRecordsID`,`archiveRecordsID`,`shiftsReminderID`,`shiftsLogsID`
> - `enableShifts`: Whether or not to enable the shift system. Each day, it assigns records to selected moderators on selected days, depending on how many pending records there are at the moment.
> - `enablePriorityRole`: Whether or not to enable the priority system. Records from users with a given role will be sent to a separate records channel and should be given priority to.
> - `enableWelcomeMessage`: Whether or not to send a message when a user joins the server. This was only added to replace the Mee6 one.

> - `clientId`: The discord user ID of the bot.
> - `guildId`: The discord server ID of your public server
> - `staffGuildId`: If separate staff server is enabled, the discord server ID of your staff server

> - `githubOwner`: The name of the github account that owns the list repository
> - `githubRepo`: The name of the list repository
> - `githubDataPath`: The path to the data folder from the repository root. If you haven't changed the base TSL Template, it is just `data`
> - `githubBranch`: The branch to use, in most cases, just `main`

> - `priorityRoleID`: If the priority system is enabled, the discord ID of the role that gives priority to records
> - `submissionLockRoleID`: The discord ID of the role that prevents a user from submitting records (= list banned)

> - `pendingRecordsID`: The channel ID in which records info and video will be sent for review. Anyone with access to this channel can accept or deny records.
> - `priorityRecordsID`: Same as `pendingRecordsID`, but for priority records
> - `acceptedRecordsID`: The channel ID in which, after being accepted, the record info and the moderator who accepted it, will be sent to.
> - `deniedRecordsID`: The channel ID in which, after being denied, the record info and the moderator who denied it, along with the deny reason, will be sent to.
> - `archiveRecordsID`: The channel ID where both accepted and denied records will be sent to, with more extensive information.

> - `shiftsReminderID`: If the shift system is enabled, the channel ID in which to send shifts messages pinging moderators with their assigned records.
> - `shiftsLogsID`: If the shift system is enabled, the channel ID in which to send shifts messages that logs whoever missed their shift on the previous day, when new shifts are assigned
> - `recordsPerWeek`: The target amount of records the bot will try assigning to moderators per week.

> - `guildMemberAddID`: If welcome messages are enabled, the channel ID in which to send them.

After you have created this config file, you can run `node ./deploy-commands.js` in the root directory, to register the bot's commands with discord. They will then appear in both the public and (if enabled) staff server.    
### Be sure to properly set the command permissions in your discord server settings ("Integrations" tab), so that only staff/admins can use their respective commands. The list of all commands is detailed later on.    
You can then run the bot using `node ./index.js`. It will create a SQLite database to store records data (among other things) in a `data/` subfolder
## Usage
## Commands list
