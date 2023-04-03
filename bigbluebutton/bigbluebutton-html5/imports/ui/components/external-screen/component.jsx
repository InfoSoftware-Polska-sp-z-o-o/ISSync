import React, { Component } from 'react';
import axios from 'axios';
import { injectIntl } from 'react-intl';
import { ACTIONS } from '../layout/enums';
import {
  sendMessage,
  onMessage,
  removeAllListeners
} from './service';
import Cookies from 'js-cookie';

const MYRTILLE_URICONNECT = Meteor.settings.public.myrtille.uriConnect;

let tirlleConnectId = '';

import service, { startWatching } from './service';

const SYNC_INTERVAL_SECONDS = 5;

// session for users with assign control
const MYRTILLE_USERS = 'myrtilleUsers';

class ExternalScreenComponent extends Component {
  static clearVideoListeners() {
    removeAllListeners('play');
    removeAllListeners('stop');
    removeAllListeners('playerUpdate');
    removeAllListeners('presenterReady');
  }

  constructor(props) {
    super(props);
    this.state = { url: "", guestUrl: "", isAddGuest: false };

    this.hasPlayedBefore = false;


    this.syncInterval = null;
    this.lastMessage = null;
    this.lastMessageTimestamp = Date.now();
    this.registerVideoListeners = this.registerVideoListeners.bind(this);
    this.handleFirstPlay = this.handleFirstPlay.bind(this);
    this.handleReload = this.handleReload.bind(this);
    this.handleOnPlay = this.handleOnPlay.bind(this);
    this.handleOnPause = this.handleOnPause.bind(this);
    this.sendSyncMessage = this.sendSyncMessage.bind(this);
    this.onBeforeUnload = this.onBeforeUnload.bind(this);
  }

  componentDidMount() {
    const {
      layoutContextDispatch,
      meetingId
    } = this.props;

    this.getMytrilleConnection(meetingId);

    window.addEventListener('beforeunload', this.onBeforeUnload);

    clearInterval(this.syncInterval);

    this.registerVideoListeners();

    layoutContextDispatch({
      type: ACTIONS.SET_HAS_EXTERNAL_SCREEN,
      value: true,
    });

    layoutContextDispatch({
      type: ACTIONS.SET_PRESENTATION_IS_OPEN,
      value: true,
    });
  }

  async getMytrilleConnection(meetingId) {
    var url = '/html5client/getMyrtilleConnection'
    const res = await axios.get(url.toString(), {
      params: {
        username: Cookies.get('us'),
        password: Cookies.get('pass'),
        meetingId: meetingId
      }
    });
    if (res !== null && res.data.connection !== null) {
      tirlleConnectId = res.data.connection;
      // const urlTrille = await axios.get(MYRTILLE_URICONNECT+tirlleConnectId);

      this.setState({ url: MYRTILLE_URICONNECT + tirlleConnectId });
      Session.set('tirlleConnectionId', res.data.connection);

      let interval;
      setTimeout(() => {
        interval = setInterval(() => {
          var guest = this.getGuest(res.data.connection).then(res => {
            if (res) {
              clearInterval(interval);
            }
          });
        }, 1000);
      }, 3000)
    }
  }

  componentDidUpdate(prevProp) {
    // Detect presenter change and redo the sync and listeners to reassign video to the new one
    const { isPresenter } = this.props;
    if (isPresenter !== prevProp.isPresenter) {
      clearInterval(this.syncInterval);
      this.registerVideoListeners();
    }
  }

  componentWillUnmount() {
    const {
      layoutContextDispatch,
      hidePresentation,
    } = this.props;

    window.removeEventListener('beforeunload', this.onBeforeUnload);


    clearInterval(this.syncInterval);
    clearTimeout(this.autoPlayTimeout);

    layoutContextDispatch({
      type: ACTIONS.SET_HAS_EXTERNAL_SCREEN,
      value: false,
    });

    if (hidePresentation) {
      layoutContextDispatch({
        type: ACTIONS.SET_PRESENTATION_IS_OPEN,
        value: false,
      });
    }
  }

  handleFirstPlay() {
    const { isPresenter } = this.props;
    const { hasPlayedBefore } = this;

    if (!hasPlayedBefore) {
      this.hasPlayedBefore = true;

      if (isPresenter) {
        this.sendSyncMessage('presenterReady');
      }
    }
  }

  handleOnPlay() {
    const { isPresenter } = this.props;


    if (isPresenter) {
      this.sendSyncMessage('play');
    }

    this.handleFirstPlay();
  }

  handleOnPause() {
    const { isPresenter } = this.props;


    if (isPresenter) {
      this.sendSyncMessage('stop');
    }

    this.handleFirstPlay();
  }

  handleReload() {
    const { key } = this.state;
    // increment key and force a re-render of the video component
    this.setState({ key: key + 1 });
  }

  onBeforeUnload() {
    const { isPresenter } = this.props;

    if (isPresenter) {
      this.sendSyncMessage('stop');
    }
  }

  static getDerivedStateFromProps(props) {
    const { inEchoTest } = props;

    return { mutedByEchoTest: inEchoTest };
  }


  sendSyncMessage(msg, params) {
    const timestamp = Date.now();

    // If message is just a quick pause/un-pause just send nothing
    const sinceLastMessage = (timestamp - this.lastMessageTimestamp) / 1000;
    if ((
      (msg === 'play' && this.lastMessage === 'stop')
      || (msg === 'stop' && this.lastMessage === 'play'))
      && sinceLastMessage < THROTTLE_INTERVAL_SECONDS) {
      return clearTimeout(this.throttleTimeout);
    }

    // Ignore repeat presenter ready messages
    if (this.lastMessage === msg && msg === 'presenterReady') {
      logger.debug('Ignoring a repeated presenterReady message');
    } else {
      // Play/pause messages are sent with a delay, to permit cancelling it in case of
      // quick sucessive play/pauses
      const messageDelay = (msg === 'play' || msg === 'stop') ? THROTTLE_INTERVAL_SECONDS : 0;

      this.throttleTimeout = setTimeout(() => {
        sendMessage(msg, { ...params });
      }, messageDelay * 1000);

      this.lastMessage = msg;
      this.lastMessageTimestamp = timestamp;
    }
    return true;
  }

  registerVideoListeners() {
    const { isPresenter } = this.props;
    if (isPresenter) {
      this.syncInterval = setInterval(() => {


        // Always pause video if presenter is has not started sharing, e.g., blocked by autoplay

        this.sendSyncMessage('playerUpdate');
      }, SYNC_INTERVAL_SECONDS * 1000);
    } else {
      onMessage('play', () => {
        const { hasPlayedBefore } = this;
        if (!hasPlayedBefore) {
          return;
        }

        logger.debug({ logCode: 'external_video_client_play' }, 'Play external screen');
      });

      onMessage('stop', () => {
        const { hasPlayedBefore } = this;

        if (!hasPlayedBefore) {
          return;
        }

        logger.debug({ logCode: 'external_video_client_stop' }, 'Stop external screen');
      });

      onMessage('presenterReady', () => {
        const { hasPlayedBefore } = this;

        logger.debug({ logCode: 'external_video_presenter_ready' }, 'Presenter is ready to sync');
      });

      onMessage('playerUpdate', (data) => {

        const { hasPlayedBefore } = this;

        if (!hasPlayedBefore) {
          return;
        }
      });
    }
  }


  async getGuest(connectionId) {
    // this.setState({guestUrl:"res.data.url"});
    let guest = false;

    try {
      let res = await axios.get('/html5client/addMyrtilleGuest', { params: { connectionId: connectionId, allowControl: false } })
      if (res.data.guestId !== '00000000-0000-0000-0000-000000000000' && res.data.guestId !== 'undefined') {
        this.setState({ guestUrl: res.data.url });

        const _this = this;

        let guestHandler = function (ev) {

          if (typeof ev.data !== "object")
            return;
          if (!ev.data.message)
            return;
          _this.setState({
            guestUrl: ev.data.message
          });

          startWatching(ev.data.message);
          document.getElementById("external-rdp-screen-guest").src = ""
          window.removeEventListener("message", guestHandler);
        }
        window.addEventListener('message', guestHandler);


        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }

  }

  componentWillUnmount() {
    let connectionId = Session.get('tirlleConnectionId');
    try {
      axios.get('/html5client/closeMyrtilleSession', { params: { connectionId: connectionId } }).then(() => {
        Session.set('tirlleConnectionId', '');
        Session.set(MYRTILLE_USERS, [])
      })
    } catch (err) {

    }
  }

  render() {
    const {
      isPresenter,
      intl,
      top,
      left,
      right,
      height,
      width,
      fullscreenContext,
      isResizing,
      layoutSwapped,
    } = this.props;

    return (
      <div id="externalScreen">
        <div id='test'></div>
        <iframe id='external-rdp-screen' sandbox="
                 allow-scripts
                 allow-same-origin" style={{
            position: 'absolute',
            top: top,
            left: left,
            right: right,
            width: width,
            height: height,
            display: layoutSwapped ? 'none' : 'flex'
          }} src={this.state.url} ></iframe>

        <iframe id='external-rdp-screen-guest' sandbox="
                 allow-scripts
                 allow-same-origin" style={{
            position: 'absolute',
            top: top,
            display: 'none',
            left: left,
            right: right,
            width: width,
            height: height,
          }} src={this.state.guestUrl} ></iframe>
      </div>

    );
  }
}



export default injectIntl(ExternalScreenComponent);