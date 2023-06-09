import { Meteor } from 'meteor/meteor';

const collectionOptions = Meteor.isClient ? {
  connection: null,
} : {};

const Meetings = new Mongo.Collection('meetings', collectionOptions);
const RecordMeetings = new Mongo.Collection('record-meetings', collectionOptions);
const ExternalVideoMeetings = new Mongo.Collection('external-video-meetings', collectionOptions);
const ExternalScreenMeetings = new Mongo.Collection('external-screen-meetings', collectionOptions);
const MeetingTimeRemaining = new Mongo.Collection('meeting-time-remaining', collectionOptions);
const Notifications = new Mongo.Collection('notifications', collectionOptions);
const LayoutMeetings = new Mongo.Collection('layout-meetings');

if (Meteor.isServer) {
  // types of queries for the meetings:
  // 1. meetingId

  Meetings._ensureIndex({ meetingId: 1 });
  RecordMeetings._ensureIndex({ meetingId: 1 });
  ExternalVideoMeetings._ensureIndex({ meetingId: 1 });
  ExternalScreenMeetings._ensureIndex({ meetingId: 1 });
  MeetingTimeRemaining._ensureIndex({ meetingId: 1 });
  LayoutMeetings._ensureIndex({ meetingId: 1 });
}

export {
  RecordMeetings,
  ExternalVideoMeetings,
  ExternalScreenMeetings,
  MeetingTimeRemaining,
  Notifications,
  LayoutMeetings,
};
export default Meetings;
