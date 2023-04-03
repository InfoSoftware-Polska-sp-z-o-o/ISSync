import { ExternalScreenMeetings } from '/imports/api/meetings';
import Auth from '/imports/ui/services/auth';

import { getStreamer } from '/imports/api/external-screen';
import { makeCall } from '/imports/ui/services/api';



const startWatching = (url) => {
  makeCall('startWatchingExternalVideo', url);
};

const stopWatching = () => {
  makeCall('stopWatchingExternalVideo');
};

const getVideoUrl = () => {
  const meetingId = Auth.meetingID;
  const externalScreen = ExternalScreenMeetings
    .findOne({ meetingId }, { fields: { externalVideoUrl: 1 } });

  return externalScreen && externalScreen.externalVideoUrl;
};

let lastMessage = null;

const sendMessage = (event, data) => {

  // don't re-send repeated update messages
  if (lastMessage && lastMessage.event === event
    && event === 'playerUpdate' && lastMessage.time === data.time) {
    return;
  }

  // don't register to redis a viewer joined message
  if (event === 'viewerJoined') {
    return;
  }

  lastMessage = { ...data, event };

  // Use an integer for playing state
  // 0: stopped 1: playing
  // We might use more states in the future
  data.state =  data.state ? 1 : 0;

  makeCall('emitExternalScreenEvent', { status: event, playerStatus: data });
};

const onMessage = (message, func) => {
  const streamer = getStreamer(Auth.meetingID);
  streamer.on(message, func);
};

const removeAllListeners = (eventType) => {
  const streamer = getStreamer(Auth.meetingID);
  streamer.removeAllListeners(eventType);
};

export {
  sendMessage,
  onMessage,
  removeAllListeners,
  startWatching,
  stopWatching,
  getVideoUrl
};
