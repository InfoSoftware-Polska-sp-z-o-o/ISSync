import { check } from 'meteor/check';
import Logger from '/imports/startup/server/logger';
import RedisPubSub from '/imports/startup/server/redis';
import { extractCredentials } from '/imports/api/common/server/helpers';

export default function startWatchingExternalScreen(externalScreenUrl) {
  const REDIS_CONFIG = Meteor.settings.private.redis;
  const CHANNEL = REDIS_CONFIG.channels.toAkkaApps;
  const EVENT_NAME = 'StartExternalScreenPubMsg';

  try {
    const { meetingId, requesterUserId } = extractCredentials(this.userId);

    debugger;

    check(meetingId, String);
    check(requesterUserId, String);
    check(externalScreenUrl, String);

    const payload = { status: "presenterReady",
      url: externalScreenUrl };

    Logger.info(`User ${requesterUserId} sharing an external screen ${externalScreenUrl} for meeting ${meetingId}`);
    RedisPubSub.publishUserMessage(CHANNEL, EVENT_NAME, meetingId, requesterUserId, payload);

  } catch (error) {
    Logger.error(`Error on sharing an external screen for meeting ${meetingId}: ${error}`);
  }
}
