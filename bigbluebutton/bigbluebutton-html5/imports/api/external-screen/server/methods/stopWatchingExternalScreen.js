import { check } from 'meteor/check';
import Logger from '/imports/startup/server/logger';
import { extractCredentials } from '/imports/api/common/server/helpers';
import RedisPubSub from '/imports/startup/server/redis';

export default function stopWatchingExternalScreen() {
  const REDIS_CONFIG = Meteor.settings.private.redis;
  const CHANNEL = REDIS_CONFIG.channels.toAkkaApps;
  const EVENT_NAME = 'StopExternalScreenPubMsg';

  try {
    const { meetingId, requesterUserId } = extractCredentials(this.userId);

    check(meetingId, String);
    check(requesterUserId, String);

    const payload = {};

    Logger.info(`User ${requesterUserId} stoping an external Screen for meeting ${meetingId}`);

    RedisPubSub.publishUserMessage(CHANNEL, EVENT_NAME, meetingId, requesterUserId, payload);
  } catch (error) {
    Logger.error(`Error on stoping an external Screen for meeting ${meetingId}: ${error}`);
  }
}
