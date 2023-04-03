import { Meteor } from 'meteor/meteor';

let streamer = null;
const getStreamer = (meetingID) => {
  if (!streamer) {
    streamer = new Meteor.Streamer(`external-stream-${meetingID}`);
  }
  return streamer;
};

export { getStreamer };
