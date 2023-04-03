import { check } from 'meteor/check';
import Logger from '/imports/startup/server/logger';
import ExternalScreenStreamer from '/imports/api/external-screen/server/streamer';

export default function updateExternalScreen(meetingId, userId, status, rate, time, state) {
  try {
    check(meetingId, String);
    check(userId, String);
    check(status, String);
    check(rate, Number);
    check(time, Number);
    check(state, Number);

    const modifier = {
      meetingId,
      userId,
      rate,
      time,
      state,
    };

    Logger.debug(`UpdateExternalScreenEvtMsg received for user ${userId} and meeting ${meetingId} event:${status}`);
    ExternalScreenStreamer(meetingId).emit(status, modifier);
  } catch (err) {
    Logger.error(`Error on setting shared external Screen update in Meetings collection: ${err}`);
  }
}
