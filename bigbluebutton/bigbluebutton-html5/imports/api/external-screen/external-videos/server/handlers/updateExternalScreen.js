import { check } from 'meteor/check';
import updateExternalVideo from '../modifiers/updateExternalScreen';

export default function handleUpdateExternalScreen({ header, body }, meetingId) {
  check(header, Object);
  check(body, Object);
  check(meetingId, String);

  const { userId } = header;

  const {
    status,
    rate,
    time,
    state,
  } = body;

  updateExternalScreen(meetingId, userId, status, rate, time, state);
}
