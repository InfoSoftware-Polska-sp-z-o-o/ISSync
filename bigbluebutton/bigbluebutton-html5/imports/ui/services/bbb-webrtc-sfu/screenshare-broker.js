import logger from '/imports/startup/client/logger';
import BaseBroker from '/imports/ui/services/bbb-webrtc-sfu/sfu-base-broker';

const ON_ICE_CANDIDATE_MSG = 'iceCandidate';
const SUBSCRIBER_ANSWER = 'subscriberAnswer';
const SFU_COMPONENT_NAME = 'screenshare';

class ScreenshareBroker extends BaseBroker {
  constructor(
    wsUrl,
    voiceBridge,
    userId,
    internalMeetingId,
    role,
    options = {},
  ) {
    super(SFU_COMPONENT_NAME, wsUrl);
    this.voiceBridge = voiceBridge;
    this.userId = userId;
    this.internalMeetingId = internalMeetingId;
    this.role = role;
    this.ws = null;
    this.webRtcPeer = null;
    this.hasAudio = false;
    this.offering = true;
    this.signalCandidates = true;
    this.ending = false;

    // Optional parameters are: userName, caleeName, iceServers, hasAudio,
    // bitrate, offering, mediaServer, signalCandidates
    Object.assign(this, options);
  }

  _onstreamended() {
    // Flag the broker as ending; we want to abort processing start responses
    this.ending = true;
    this.onstreamended();
  }

  onstreamended() {
    // To be implemented by instantiators
  }

  async share () {
    return new Promise((resolve, reject) => {
      if (this.stream == null) {
        logger.error({
          logCode: `${this.logCodePrefix}_missing_stream`,
          extraInfo: { role: this.role, sfuComponent: this.sfuComponent },
        }, 'Screenshare broker start failed: missing stream');
        return reject(BaseBroker.assembleError(1305));
      }

      return this.openWSConnection()
        .then(this.startScreensharing.bind(this))
        .then(resolve)
        .catch(reject);
    });
  }

  view () {
    return this.openWSConnection()
      .then(this.subscribeToScreenStream.bind(this));
  }

  onWSMessage (message) {
    const parsedMessage = JSON.parse(message.data);

    switch (parsedMessage.id) {
      case 'startResponse':
        if (!this.ending && !this.started) {
          this.onRemoteDescriptionReceived(parsedMessage);
        }
        break;
      case 'playStart':
        if (!this.ending && !this.started) {
          this.onstart();
          this.started = true;
        }
        break;
      case 'stopSharing':
        this.stop();
        break;
      case 'iceCandidate':
        this.handleIceCandidate(parsedMessage.candidate);
        break;
      case 'error':
        this.handleSFUError(parsedMessage);
        break;
      case 'pong':
        break;
      default:
        logger.debug({
          logCode: `${this.logCodePrefix}_invalid_req`,
          extraInfo: {
            messageId: parsedMessage.id || 'Unknown',
            sfuComponent: this.sfuComponent,
            role: this.role,
          }
        }, `Discarded invalid SFU message`);
    }
  }

  handleSFUError (sfuResponse) {
    const { code, reason } = sfuResponse;
    const error = BaseBroker.assembleError(code, reason);

    logger.error({
      logCode: `${this.logCodePrefix}_sfu_error`,
      extraInfo: {
        errorCode: code,
        errorMessage: error.errorMessage,
        role: this.role,
        sfuComponent: this.sfuComponent,
        started: this.started,
      },
    }, `Screen sharing failed in SFU`);
    this.onerror(error);
  }

  sendLocalDescription (localDescription) {
    const message = {
      id: SUBSCRIBER_ANSWER,
      type: this.sfuComponent,
      role: this.role,
      voiceBridge: this.voiceBridge,
      callerName: this.userId,
      answer: localDescription,
    };

    this.sendMessage(message);
  }

  onRemoteDescriptionReceived (sfuResponse) {
    if (this.offering) {
      return this.processAnswer(sfuResponse);
    }

    return this.processOffer(sfuResponse);
  }

  sendStartReq (offer) {
    const message = {
      id: 'start',
      type: this.sfuComponent,
      role: this.role,
      internalMeetingId: this.internalMeetingId,
      voiceBridge: this.voiceBridge,
      userName: this.userName,
      callerName: this.userId,
      sdpOffer: offer,
      hasAudio: !!this.hasAudio,
      bitrate: this.bitrate,
      mediaServer: this.mediaServer,
    };

    this.sendMessage(message);
  }

  onOfferGenerated (error, sdpOffer) {
    if (error) {
      logger.error({
        logCode: `${this.logCodePrefix}_offer_failure`,
        extraInfo: {
          errorMessage: error.name || error.message || 'Unknown error',
          role: this.role,
          sfuComponent: this.sfuComponent
        },
      }, `Screenshare offer generation failed`);
      // 1305: "PEER_NEGOTIATION_FAILED",
      const normalizedError = BaseBroker.assembleError(1305);
      return this.onerror(error);
    }

    this.sendStartReq(sdpOffer);
  }

  startScreensharing() {
    return new Promise((resolve, reject) => {
      const options = {
        onicecandidate: this.signalCandidates ? this.onIceCandidate.bind(this) : null,
        videoStream: this.stream,
        configuration: this.populatePeerConfiguration(),
      };

      this.webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, (error) => {
        if (error) {
          // 1305: "PEER_NEGOTIATION_FAILED",
          const normalizedError = BaseBroker.assembleError(1305);
          logger.error({
            logCode: `${this.logCodePrefix}_peer_creation_failed`,
            extraInfo: {
              errorMessage: error.name || error.message || 'Unknown error',
              errorCode: normalizedError.errorCode,
              role: this.role,
              sfuComponent: this.sfuComponent,
              started: this.started,
            },
          }, 'Screenshare peer creation failed');
          this.onerror(normalizedError);
          return reject(normalizedError);
        }

        this.webRtcPeer.iceQueue = [];

        if (this.offering) {
          this.webRtcPeer.generateOffer(this.onOfferGenerated.bind(this));
        } else {
          this.sendStartReq();
        }

        return resolve();
      });

      this.webRtcPeer.peerConnection.onconnectionstatechange = () => {
        this.handleConnectionStateChange('screenshare');
      };
    });
  }

  onIceCandidate (candidate) {
    const message = {
      id: ON_ICE_CANDIDATE_MSG,
      role: this.role,
      type: this.sfuComponent,
      voiceBridge: this.voiceBridge,
      candidate,
      callerName: this.userId,
    };

    this.sendMessage(message);
  }

  subscribeToScreenStream () {
    return new Promise((resolve, reject) => {
      const options = {
        mediaConstraints: {
          audio: !!this.hasAudio,
        },
        onicecandidate: this.signalCandidates ? this.onIceCandidate.bind(this) : null,
        configuration: this.populatePeerConfiguration(),
      };

      this.webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, (error) => {
        if (error) {
          // 1305: "PEER_NEGOTIATION_FAILED",
          const normalizedError = BaseBroker.assembleError(1305);
          logger.error({
            logCode: `${this.logCodePrefix}_peer_creation_failed`,
            extraInfo: {
              errorMessage: error.name || error.message || 'Unknown error',
              errorCode: normalizedError.errorCode,
              role: this.role,
              sfuComponent: this.sfuComponent,
              started: this.started,
            },
          }, `Screenshare peer creation failed`);
          this.onerror(normalizedError);
          return reject(normalizedError);
        }
        this.webRtcPeer.iceQueue = [];

        if (this.offering) {
          this.webRtcPeer.generateOffer(this.onOfferGenerated.bind(this));
        } else {
          this.sendStartReq();
        }
      });

      this.webRtcPeer.peerConnection.onconnectionstatechange = () => {
        this.handleConnectionStateChange('screenshare');
      };
      return resolve();
    });
  }
}

export default ScreenshareBroker;
