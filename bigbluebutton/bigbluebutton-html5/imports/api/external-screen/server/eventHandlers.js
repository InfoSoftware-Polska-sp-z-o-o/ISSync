import RedisPubSub from '/imports/startup/server/redis';
import handleStartExternalScreen from './handlers/startExternalScreen';
import handleStopExternalScreen from './handlers/stopExternalScreen';
import handleUpdateExternalScreen from './handlers/updateExternalScreen';

RedisPubSub.on('StartExternalScreenEvtMsg', handleStartExternalScreen);
RedisPubSub.on('StopExternalScreenEvtMsg', handleStopExternalScreen);
RedisPubSub.on('UpdateExternalScreenEvtMsg', handleUpdateExternalScreen);
