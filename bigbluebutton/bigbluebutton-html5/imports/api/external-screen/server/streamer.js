import { Meteor } from 'meteor/meteor';
import Logger from '/imports/startup/server/logger';

const allowRecentMessages = (eventName, message) => {

  const {
    userId,
    meetingId,
    time,
    rate,
    state,
  } = message;

  Logger.debug(`ExternalScreen Streamer auth allowed userId: ${userId}, meetingId: ${meetingId}, event: ${eventName}, time: ${time} rate: ${rate}, state: ${state}`);
  return true;
};

export function removeExternalScreenStreamer(meetingId) {
  const streamName = `external-Screens-${meetingId}`;

  if (Meteor.StreamerCentral.instances[streamName]) {
    Logger.info(`Destroying External Screen streamer object for ${streamName}`);
    delete Meteor.StreamerCentral.instances[streamName];
  }
}

export function addExternalScreenStreamer(meetingId) {

  const streamName = `external-Screens-${meetingId}`;
  if (!Meteor.StreamerCentral.instances[streamName]) {

    const streamer = new Meteor.Streamer(streamName);
    streamer.allowRead(function allowRead() {
      if (!this.userId) return false;

      return this.userId && this.userId.includes(meetingId);
    });
    streamer.allowWrite('none');
    streamer.allowEmit(allowRecentMessages);
    Logger.info(`Created External Screen streamer for ${streamName}`);
  } else {
    Logger.debug(`External Screen streamer is already created for ${streamName}`);
  }
}

export default function get(meetingId) {
  const streamName = `external-Screens-${meetingId}`;
  return Meteor.StreamerCentral.instances[streamName];
}
