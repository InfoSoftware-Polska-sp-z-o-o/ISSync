import { check } from 'meteor/check';
import Logger from '/imports/startup/server/logger';
import { ExternalScreenMeetings } from '/imports/api/meetings';

export default function startExternalScreen(meetingId, userId, externalScreenUrl) {
  try {
    check(meetingId, String);
    check(userId, String);
    check(externalScreenUrl, String);

    const selector = { meetingId };
    const modifier = { $set: { externalScreenUrl } };

    Logger.info('modifier TestKD:');
    Logger.info(modifier);

    Logger.info(`User id=${userId} sharing an external Screen: ${externalScreenUrl} for meeting ${meetingId}`);
    ExternalScreenMeetings.update(selector, modifier);
  } catch (err) {
    Logger.error(`Error on setting shared external Screen start in Meetings collection: ${err}`);
  }
}
