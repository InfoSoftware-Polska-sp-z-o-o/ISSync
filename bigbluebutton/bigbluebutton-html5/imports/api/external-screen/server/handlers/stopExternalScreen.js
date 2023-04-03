import { check } from 'meteor/check';
import stopExternalScreen from '../modifiers/stopExternalScreen';

export default function handleStopExternalScreen({ header }, meetingId) {
  check(header, Object);
  check(meetingId, String);

  const { userId } = header;

  stopExternalScreen(userId, meetingId);
}
