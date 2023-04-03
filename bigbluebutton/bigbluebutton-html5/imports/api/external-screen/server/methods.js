import { Meteor } from 'meteor/meteor';
import startWatchingExternalScreen from './methods/startWatchingExternalScreen';
import stopWatchingExternalScreen from './methods/stopWatchingExternalScreen';
import emitExternalScreenEvent from './methods/emitExternalScreenEvent';

Meteor.methods({
  startWatchingExternalScreen,
  stopWatchingExternalScreen,
  emitExternalScreenEvent,
});
