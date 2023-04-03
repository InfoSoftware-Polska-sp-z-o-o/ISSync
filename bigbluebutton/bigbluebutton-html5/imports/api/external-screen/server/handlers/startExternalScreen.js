import { check } from 'meteor/check';
import startExternalScreen from '../modifiers/startExternalScreen';

export default function handleStartExternalScreen({ header, body }, meetingId) {
  check(header, Object);
  check(body, Object);
  check(meetingId, String);

  const { userId } = header;
  const { externalScreenUrl } = body;
  
  startExternalScreen(meetingId, userId, externalScreenUrl);
}
