import { check } from 'meteor/check';
import Logger from '/imports/startup/server/logger';
import { ExternalScreenMeetings } from '/imports/api/meetings';

export default function stopExternalScreen(userId, meetingId) {
  try {
    check(meetingId, String);
    check(userId, String);

    const selector = { meetingId };
    const modifier = { $set: { externalScreenUrl: null } };

    Logger.info(`External Screen stop sharing was initiated by:[${userId}] for meeting ${meetingId}`);
    ExternalScreenMeetings.update(selector, modifier);
  } catch (err) {
    Logger.error(`Error on setting shared external Screen stop in Meetings collection: ${err}`);
  }
}
