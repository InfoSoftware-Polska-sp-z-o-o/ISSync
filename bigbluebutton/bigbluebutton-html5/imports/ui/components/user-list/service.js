import React from 'react';
import Users from '/imports/api/users';
import VoiceUsers from '/imports/api/voice-users';
import GroupChat from '/imports/api/group-chat';
import Breakouts from '/imports/api/breakouts';
import Meetings from '/imports/api/meetings';
import Auth from '/imports/ui/services/auth';
import Storage from '/imports/ui/services/storage/session';
import { EMOJI_STATUSES } from '/imports/utils/statuses';
import { makeCall } from '/imports/ui/services/api';
import _ from 'lodash';
import KEY_CODES from '/imports/utils/keyCodes';
import AudioService from '/imports/ui/components/audio/service';
import VideoService from '/imports/ui/components/video-provider/service';
import logger from '/imports/startup/client/logger';
import WhiteboardService from '/imports/ui/components/whiteboard/service';
import { Session } from 'meteor/session';
import Settings from '/imports/ui/services/settings';
import { notify } from '/imports/ui/services/notification';
import { FormattedMessage } from 'react-intl';
import { getDateString } from '/imports/utils/string-utils';
import axios from 'axios';

const CHAT_CONFIG = Meteor.settings.public.chat;
const PUBLIC_CHAT_ID = CHAT_CONFIG.public_id;
const PUBLIC_GROUP_CHAT_ID = CHAT_CONFIG.public_group_id;
const ROLE_MODERATOR = Meteor.settings.public.user.role_moderator;
const ROLE_VIEWER = Meteor.settings.public.user.role_viewer;
const CHAT_EMPHASIZE_TEXT = CHAT_CONFIG.moderatorChatEmphasized;

// session for users with assign control
const MYRTILLE_USERS = 'myrtilleUsers';

const DIAL_IN_CLIENT_TYPE = 'dial-in-user';

// session for closed chat list
const CLOSED_CHAT_LIST_KEY = 'closedChatList';
// session for chats the current user started
const STARTED_CHAT_LIST_KEY = 'startedChatList';

const CUSTOM_LOGO_URL_KEY = 'CustomLogoUrl';

export const setCustomLogoUrl = (path) => Storage.setItem(CUSTOM_LOGO_URL_KEY, path);

export const setModeratorOnlyMessage = (msg) => Storage.setItem('ModeratorOnlyMessage', msg);

const getCustomLogoUrl = () => Storage.getItem(CUSTOM_LOGO_URL_KEY);

const sortByWhiteboardAccess = (a, b) => {
  const _a = a.whiteboardAccess;
  const _b = b.whiteboardAccess;
  if (!_b && _a) return -1;
  if (!_a && _b) return 1;
  return 0;
};

const sortUsersByUserId = (a, b) => {
  if (a.userId > b.userId) {
    return -1;
  } if (a.userId < b.userId) {
    return 1;
  }

  return 0;
};

const sortUsersByName = (a, b) => {
  const aName = a.name ? a.name.toLowerCase() : '';
  const bName = b.name ? b.name.toLowerCase() : '';

  // Extending for sorting strings with non-ASCII characters
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#sorting_non-ascii_characters
  return aName.localeCompare(bName);
};

const sortUsersByEmoji = (a, b) => {
  if (a.emoji && b.emoji && (a.emoji !== 'none' && b.emoji !== 'none')) {
    if (a.emojiTime < b.emojiTime) {
      return -1;
    } if (a.emojiTime > b.emojiTime) {
      return 1;
    }
  } if (a.emoji && a.emoji !== 'none') {
    return -1;
  } if (b.emoji && b.emoji !== 'none') {
    return 1;
  }
  return 0;
};

const sortUsersByModerator = (a, b) => {
  if (a.role === ROLE_MODERATOR && b.role === ROLE_MODERATOR) {
    return 0;
  } if (a.role === ROLE_MODERATOR) {
    return -1;
  } if (b.role === ROLE_MODERATOR) {
    return 1;
  }

  return 0;
};

const sortUsersByPhoneUser = (a, b) => {
  if (!a.clientType === DIAL_IN_CLIENT_TYPE && !b.clientType === DIAL_IN_CLIENT_TYPE) {
    return 0;
  } if (!a.clientType === DIAL_IN_CLIENT_TYPE) {
    return -1;
  } if (!b.clientType === DIAL_IN_CLIENT_TYPE) {
    return 1;
  }

  return 0;
};

// current user's name is always on top
const sortUsersByCurrent = (a, b) => {
  if (a.userId === Auth.userID) {
    return -1;
  } if (b.userId === Auth.userID) {
    return 1;
  }

  return 0;
};

const sortUsers = (a, b) => {
  let sort = sortUsersByCurrent(a, b);

  if (sort === 0) {
    sort = sortUsersByModerator(a, b);
  }

  if (sort === 0) {
    sort = sortUsersByEmoji(a, b);
  }

  if (sort === 0) {
    sort = sortUsersByPhoneUser(a, b);
  }

  if (sort === 0) {
    sort = sortByWhiteboardAccess(a, b);
  }

  if (sort === 0) {
    sort = sortUsersByName(a, b);
  }

  if (sort === 0) {
    sort = sortUsersByUserId(a, b);
  }

  return sort;
};

const isPublicChat = (chat) => (
  chat.userId === PUBLIC_CHAT_ID
);

const userFindSorting = {
  emojiTime: 1,
  role: 1,
  phoneUser: 1,
  name: 1,
  userId: 1,
};

const addWhiteboardAccess = (users) => {
  const whiteboardId = WhiteboardService.getCurrentWhiteboardId();

  if (whiteboardId) {
    const multiUserWhiteboard = WhiteboardService.getMultiUser(whiteboardId);
    return users.map((user) => {
      const whiteboardAccess = multiUserWhiteboard.includes(user.userId);

      return {
        ...user,
        whiteboardAccess,
      };
    });
  }

  return users.map((user) => {
    const whiteboardAccess = false;
    return {
      ...user,
      whiteboardAccess,
    };
  });
};

const addIsSharingWebcam = (users) => {
  const usersId = VideoService.getUsersIdFromVideoStreams();

  return users.map((user) => {
    const isSharingWebcam = usersId.includes(user.userId);

    return {
      ...user,
      isSharingWebcam,
    };
  });
};

const getUsers = () => {
  let users = Users
    .find({
      meetingId: Auth.meetingID,
    }, userFindSorting)
    .fetch();

  const currentUser = Users.findOne({ userId: Auth.userID }, { fields: { role: 1, locked: 1 } });
  if (currentUser && currentUser.role === ROLE_VIEWER && currentUser.locked) {
    const meeting = Meetings.findOne({ meetingId: Auth.meetingID },
      { fields: { 'lockSettingsProps.hideUserList': 1 } });
    if (meeting && meeting.lockSettingsProps && meeting.lockSettingsProps.hideUserList) {
      const moderatorOrCurrentUser = (u) => u.role === ROLE_MODERATOR || u.userId === Auth.userID;
      users = users.filter(moderatorOrCurrentUser);
    }
  }

  return addIsSharingWebcam(addWhiteboardAccess(users)).sort(sortUsers);
};

const formatUsers = (contextUsers, videoUsers, whiteboardUsers) => {
  let users = contextUsers.filter((user) => user.loggedOut === false && user.left === false);

  const currentUser = Users.findOne({ userId: Auth.userID }, { fields: { role: 1, locked: 1 } });
  if (currentUser && currentUser.role === ROLE_VIEWER && currentUser.locked) {
    const meeting = Meetings.findOne({ meetingId: Auth.meetingID },
      { fields: { 'lockSettingsProps.hideUserList': 1 } });
    if (meeting && meeting.lockSettingsProps && meeting.lockSettingsProps.hideUserList) {
      const moderatorOrCurrentUser = (u) => u.role === ROLE_MODERATOR || u.userId === Auth.userID;
      users = users.filter(moderatorOrCurrentUser);
    }
  }

  return users.map((user) => {
    const isSharingWebcam = videoUsers?.includes(user.userId);
    const whiteboardAccess = whiteboardUsers?.includes(user.userId);

    return {
      ...user,
      isSharingWebcam,
      whiteboardAccess,
    };
  }).sort(sortUsers);
};

const getUserCount = () => Users.find({ meetingId: Auth.meetingID }).count();

const hasBreakoutRoom = () => Breakouts.find({ parentMeetingId: Auth.meetingID },
  { fields: {} }).count() > 0;

const isMe = (userId) => userId === Auth.userID;

const getActiveChats = ({ groupChatsMessages, groupChats, users }) => {
  if (_.isEmpty(groupChats) && _.isEmpty(users)) return [];

  const chatIds = Object.keys(groupChats);
  const lastTimeWindows = chatIds.reduce((acc, chatId) => {
    const chat = groupChatsMessages[chatId];
    const lastTimewindowKey = chat?.lastTimewindow;
    const lastTimeWindow = lastTimewindowKey?.split('-')[1];
    return {
      ...acc,
      chatId: lastTimeWindow,
    };
  }, {});

  chatIds.sort((a, b) => {
    if (a === PUBLIC_GROUP_CHAT_ID) {
      return -1;
    }

    if (lastTimeWindows[a] === lastTimeWindows[b]) {
      return 0;
    }

    return 1;
  });

  const chatInfo = chatIds.map((chatId) => {
    const contextChat = groupChatsMessages[chatId];
    const isPublicChatId = chatId === PUBLIC_GROUP_CHAT_ID;
    let unreadMessagesCount = 0;
    if (contextChat) {
      const unreadTimewindows = contextChat.unreadTimeWindows;
      // eslint-disable-next-line
      for (const unreadTimeWindowId of unreadTimewindows) {
        const timeWindow = (isPublicChatId
          ? contextChat?.preJoinMessages[unreadTimeWindowId]
          || contextChat?.posJoinMessages[unreadTimeWindowId]
          : contextChat?.messageGroups[unreadTimeWindowId]);
        unreadMessagesCount += timeWindow.content.length;
      }
    }

    if (chatId !== PUBLIC_GROUP_CHAT_ID) {
      const groupChatsParticipants = groupChats[chatId].participants;
      const otherParticipant = groupChatsParticipants.filter((user) => user.id !== Auth.userID)[0];
      const user = users[otherParticipant.id];
      const startedChats = Session.get(STARTED_CHAT_LIST_KEY) || [];

      return {
        color: user?.color || '#7b1fa2',
        isModerator: user?.role === ROLE_MODERATOR,
        name: user?.name || otherParticipant.name,
        avatar: user?.avatar,
        chatId,
        unreadCounter: unreadMessagesCount,
        userId: user?.userId || otherParticipant.id,
        shouldDisplayInChatList: groupChats[chatId].createdBy === Auth.userID
          || startedChats.includes(chatId)
          || !!contextChat,
      };
    }

    return {
      userId: PUBLIC_CHAT_ID,
      name: 'Public Chat',
      icon: 'group_chat',
      chatId: PUBLIC_CHAT_ID,
      unreadCounter: unreadMessagesCount,
      shouldDisplayInChatList: true,
    };
  });

  const currentClosedChats = Storage.getItem(CLOSED_CHAT_LIST_KEY) || [];
  return chatInfo.filter((chat) => !currentClosedChats.includes(chat.chatId)
    && chat.shouldDisplayInChatList);
};

const isVoiceOnlyUser = (userId) => userId.toString().startsWith('v_');

const isMeetingLocked = (id) => {
  const meeting = Meetings.findOne({ meetingId: id },
    { fields: { lockSettingsProps: 1, usersProp: 1 } });
  let isLocked = false;

  if (meeting.lockSettingsProps !== undefined) {
    const { lockSettingsProps: lockSettings, usersProp } = meeting;

    if (lockSettings.disableCam
      || lockSettings.disableMic
      || lockSettings.disablePrivateChat
      || lockSettings.disablePublicChat
      || lockSettings.disableNotes
      || lockSettings.hideUserList
      || lockSettings.hideViewersCursor
      || usersProp.webcamsOnlyForModerator) {
      isLocked = true;
    }
  }

  return isLocked;
};

const getUsersProp = () => {
  const meeting = Meetings.findOne(
    { meetingId: Auth.meetingID },
    {
      fields: {
        'usersProp.allowModsToUnmuteUsers': 1,
        'usersProp.allowModsToEjectCameras': 1,
        'usersProp.authenticatedGuest': 1,
      },
    },
  );

  if (meeting.usersProp) return meeting.usersProp;

  return {
    allowModsToUnmuteUsers: false,
    allowModsToEjectCameras: false,
    authenticatedGuest: false,
  };
};

const curatedVoiceUser = (intId) => {
  const voiceUser = VoiceUsers.findOne({ intId });
  return {
    isVoiceUser: voiceUser ? voiceUser.joined : false,
    isMuted: voiceUser ? voiceUser.muted && !voiceUser.listenOnly : false,
    isTalking: voiceUser ? voiceUser.talking && !voiceUser.muted : false,
    isListenOnly: voiceUser ? voiceUser.listenOnly : false,
  };
};

const getAvailableActions = (
  amIModerator, isBreakoutRoom, subjectUser, subjectVoiceUser, usersProp, amIPresenter,
) => {
  const isDialInUser = isVoiceOnlyUser(subjectUser.userId) || subjectUser.phone_user;
  const amISubjectUser = isMe(subjectUser.userId);
  const isSubjectUserModerator = subjectUser.role === ROLE_MODERATOR;
  const isSubjectUserGuest = subjectUser.guest;

  const hasAuthority = amIModerator || amISubjectUser;
  const allowedToChatPrivately = !amISubjectUser && !isDialInUser;
  const allowedToMuteAudio = hasAuthority
    && subjectVoiceUser.isVoiceUser
    && !subjectVoiceUser.isMuted
    && !subjectVoiceUser.isListenOnly;

  const allowedToUnmuteAudio = hasAuthority
    && subjectVoiceUser.isVoiceUser
    && !subjectVoiceUser.isListenOnly
    && subjectVoiceUser.isMuted
    && (amISubjectUser || usersProp.allowModsToUnmuteUsers);

  const allowedToResetStatus = hasAuthority
    && subjectUser.emoji !== EMOJI_STATUSES.none
    && !isDialInUser;

  // if currentUser is a moderator, allow removing other users
  const allowedToRemove = amIModerator
    && !amISubjectUser
    && !isBreakoutRoom;

  const allowedToSetPresenter = amIModerator
    && !subjectUser.presenter
    && !isDialInUser;

  const allowedToPromote = amIModerator
    && !amISubjectUser
    && !isSubjectUserModerator
    && !isDialInUser
    && !isBreakoutRoom
    && !(isSubjectUserGuest && usersProp.authenticatedGuest);

  const allowedToDemote = amIModerator
    && !amISubjectUser
    && isSubjectUserModerator
    && !isDialInUser
    && !isBreakoutRoom
    && !(isSubjectUserGuest && usersProp.authenticatedGuest);

  const allowedToChangeStatus = amISubjectUser;

  const allowedToChangeUserLockStatus = amIModerator
    && !isSubjectUserModerator
    && isMeetingLocked(Auth.meetingID);

  const allowedToChangeWhiteboardAccess = amIPresenter
    && !amISubjectUser;

  const allowedToEjectCameras = amIModerator
    && !amISubjectUser
    && usersProp.allowModsToEjectCameras;

  const allowedToMyrtilleControl = hasMyrtilleControl(subjectUser.userId)

  return {
    allowedToChatPrivately,
    allowedToMuteAudio,
    allowedToUnmuteAudio,
    allowedToResetStatus,
    allowedToRemove,
    allowedToSetPresenter,
    allowedToPromote,
    allowedToDemote,
    allowedToChangeStatus,
    allowedToChangeUserLockStatus,
    allowedToChangeWhiteboardAccess,
    allowedToEjectCameras,
    allowedToMyrtilleControl,
  };
};

const normalizeEmojiName = (emoji) => (
  emoji in EMOJI_STATUSES ? EMOJI_STATUSES[emoji] : emoji
);

const setEmojiStatus = _.debounce((userId, emoji) => {
  const statusAvailable = (Object.keys(EMOJI_STATUSES).includes(emoji));
  return statusAvailable
    ? makeCall('setEmojiStatus', Auth.userID, emoji)
    : makeCall('setEmojiStatus', userId, 'none');
}, 1000, { leading: true, trailing: false });

const clearAllEmojiStatus = (users) => {
  users.forEach((user) => makeCall('setEmojiStatus', user.userId, 'none'));
};

const hasMyrtilleControl = (userId) => {
  let myrtilleUsers = Session.get(MYRTILLE_USERS) || [];

  let found;
  myrtilleUsers.some(function (obj) {
    if (obj.userId === userId) {
      found = obj;
      return true;
    }
  });

  if (!found) {
    return false;
  }
  return true;
}

const assignMyrtilleControl = async (currentUser, user, message) => {
  let myrtilleUsers = Session.get(MYRTILLE_USERS) || [];
  let found;
  myrtilleUsers.some(function (obj) {
    if (obj.userId === user.userId) {
      found = obj;
      return true;
    }
  });

  if (!found) {
    try {
      const connectionId =  Session.get('tirlleConnectionId');
      const allowControl = true;
      const res = await axios.get('/html5client/addMyrtilleGuest', { params: { connectionId: connectionId, allowControl: allowControl } });
      myrtilleUsers.push({ userId: user.userId, guestId: res.data.guestId });
      Session.set(MYRTILLE_USERS, myrtilleUsers);
      sendAssignMsg(res.data.url, currentUser, user);
      UserChangeMyrtilleControlAlert(
        {
          message: user.name + " " + message,
          notificationType: "info",
          icon: "desktop"
        })
    } catch (err) {
    }
  }
}
const removeMyrtilleControl = async (currentUser, user, message) => {
  let myrtilleUsers = Session.get(MYRTILLE_USERS) || [];

  let found;
  myrtilleUsers.some(function (obj) {
    if (obj.userId === user.userId) {
      found = obj;
      return true;
    }
  });

  if (found) {
    try {
      const res = await axios.get('/html5client/removeMyrtilleGuest', { params: { guestId: found.guestId } });

      myrtilleUsers = myrtilleUsers.filter(function (el) { return el.userId != user.userId; });
      Session.set(MYRTILLE_USERS, myrtilleUsers);

      UserChangeMyrtilleControlAlert(
        {
          message: user.name + " " + message, 
          notificationType: "info",
          icon: "desktop_off"
        })
    } catch (err) {
    }
  }
}

const assignPresenter = (userId) => { makeCall('assignPresenter', userId); };

const removeUser = (userId, banUser) => {
  if (isVoiceOnlyUser(userId)) {
    makeCall('ejectUserFromVoice', userId, banUser);
  } else {
    makeCall('removeUser', userId, banUser);
  }
};

const toggleVoice = (userId) => {
  if (userId === Auth.userID) {
    AudioService.toggleMuteMicrophone();
  } else {
    makeCall('toggleVoice', userId);
    logger.info({
      logCode: 'usermenu_option_mute_toggle_audio',
      extraInfo: { logType: 'moderator_action', userId },
    }, 'moderator muted user microphone');
  }
};

const ejectUserCameras = (userId) => {
  makeCall('ejectUserCameras', userId);
};

const getEmoji = () => {
  const currentUser = Users.findOne({ userId: Auth.userID },
    { fields: { emoji: 1 } });

  if (!currentUser) {
    return false;
  }

  return currentUser.emoji;
};

const muteAllUsers = (userId) => { makeCall('muteAllUsers', userId); };

const muteAllExceptPresenter = (userId) => { makeCall('muteAllExceptPresenter', userId); };

const changeRole = (userId, role) => { makeCall('changeRole', userId, role); };

const focusFirstDropDownItem = () => {
  const dropdownContent = document.querySelector('div[data-test="dropdownContent"][style="visibility: visible;"]');
  if (!dropdownContent) return;
  const list = dropdownContent.getElementsByTagName('li');
  list[0].focus();
};

const roving = (...args) => {
  const [
    event,
    changeState,
    elementsList,
    element,
  ] = args;

  this.selectedElement = element;
  const numberOfChilds = elementsList.childElementCount;
  const menuOpen = Session.get('dropdownOpen') || false;

  if (menuOpen) {
    const menuChildren = document.activeElement.getElementsByTagName('li');

    if ([KEY_CODES.ESCAPE, KEY_CODES.ARROW_LEFT].includes(event.keyCode)) {
      Session.set('dropdownOpen', false);
      document.activeElement.click();
    }

    if ([KEY_CODES.ARROW_UP].includes(event.keyCode)) {
      menuChildren[menuChildren.length - 1].focus();
    }

    if ([KEY_CODES.ARROW_DOWN].includes(event.keyCode)) {
      for (let i = 0; i < menuChildren.length; i += 1) {
        if (menuChildren[i].hasAttribute('tabIndex')) {
          menuChildren[i].focus();
          break;
        }
      }
    }

    return;
  }

  if ([KEY_CODES.ESCAPE, KEY_CODES.TAB].includes(event.keyCode)) {
    Session.set('dropdownOpen', false);
    document.activeElement.blur();
    changeState(null);
  }

  if (event.keyCode === KEY_CODES.ARROW_DOWN) {
    const firstElement = elementsList.firstChild;
    let elRef = element && numberOfChilds > 1 ? element.nextSibling : firstElement;

    elRef = elRef || firstElement;
    changeState(elRef);
  }

  if (event.keyCode === KEY_CODES.ARROW_UP) {
    const lastElement = elementsList.lastChild;
    let elRef = element ? element.previousSibling : lastElement;
    elRef = elRef || lastElement;
    changeState(elRef);
  }

  if ([KEY_CODES.ARROW_RIGHT, KEY_CODES.SPACE, KEY_CODES.ENTER].includes(event.keyCode)) {
    const tether = document.activeElement.firstChild;
    const dropdownTrigger = tether.firstChild;
    dropdownTrigger?.click();
    focusFirstDropDownItem();
  }
};

const hasPrivateChatBetweenUsers = (senderId, receiverId) => GroupChat
  .findOne({ users: { $all: [receiverId, senderId] } });

const getGroupChatPrivate = (senderUserId, receiver) => {
  const chat = hasPrivateChatBetweenUsers(senderUserId, receiver.userId);
  if (!chat) {
    makeCall('createGroupChat', receiver);
  } else {
    const startedChats = Session.get(STARTED_CHAT_LIST_KEY) || [];
    if (_.indexOf(startedChats, chat.chatId) < 0) {
      startedChats.push(chat.chatId);
      Session.set(STARTED_CHAT_LIST_KEY, startedChats);
    }

    const currentClosedChats = Storage.getItem(CLOSED_CHAT_LIST_KEY);
    if (_.indexOf(currentClosedChats, chat.chatId) > -1) {
      Storage.setItem(CLOSED_CHAT_LIST_KEY, _.without(currentClosedChats, chat.chatId));
    }
  }
};

const toggleUserLock = (userId, lockStatus) => {
  makeCall('toggleUserLock', userId, lockStatus);
};

const requestUserInformation = (userId) => {
  makeCall('requestUserInformation', userId);
};

const sortUsersByFirstName = (a, b) => {
  const aUser = { name: a.firstName ? a.firstName : '' };
  const bUser = { name: b.firstName ? b.firstName : '' };

  return sortUsersByName(aUser, bUser);
};

const sortUsersByLastName = (a, b) => {
  const aUser = { name: a.lastName ? a.lastName : '' };
  const bUser = { name: b.lastName ? b.lastName : '' };

  return sortUsersByName(aUser, bUser);
};

const isUserPresenter = (userId) => {
  const user = Users.findOne({ userId },
    { fields: { presenter: 1 } });
  return user ? user.presenter : false;
};

export const getUserNamesLink = (docTitle, fnSortedLabel, lnSortedLabel) => {
  const mimeType = 'text/plain';
  const userNamesObj = getUsers()
    .map((u) => {
      const name = u.name.split(' ');
      return ({
        firstName: name[0],
        middleNames: name.length > 2 ? name.slice(1, name.length - 1) : null,
        lastName: name.length > 1 ? name[name.length - 1] : null,
      });
    });

  const getUsernameString = (user) => {
    const { firstName, middleNames, lastName } = user;
    return `${firstName || ''} ${middleNames && middleNames.length > 0 ? middleNames.join(' ') : ''} ${lastName || ''}`;
  };

  const namesByFirstName = userNamesObj.sort(sortUsersByFirstName)
    .map((u) => getUsernameString(u)).join('\r\n');

  const namesByLastName = userNamesObj.sort(sortUsersByLastName)
    .map((u) => getUsernameString(u)).join('\r\n');

  const namesListsString = `${docTitle}\r\n\r\n${fnSortedLabel}\r\n${namesByFirstName}
    \r\n\r\n${lnSortedLabel}\r\n${namesByLastName}`.replace(/ {2}/g, ' ');

  const link = document.createElement('a');
  const meeting = Meetings.findOne({ meetingId: Auth.meetingID },
    { fields: { 'meetingProp.name': 1 } });
  link.setAttribute('download', `bbb-${meeting.meetingProp.name}[users-list]_${getDateString()}.txt`);
  link.setAttribute(
    'href',
    `data: ${mimeType};charset=utf-16,${encodeURIComponent(namesListsString)}`,
  );
  return link;
};

const UserJoinedMeetingAlert = (obj) => {
  const {
    userJoinAudioAlerts,
    userJoinPushAlerts,
  } = Settings.application;

  if (!userJoinAudioAlerts && !userJoinPushAlerts) return;

  if (userJoinAudioAlerts) {
    AudioService.playAlertSound(`${Meteor.settings.public.app.cdn
      + Meteor.settings.public.app.basename
      + Meteor.settings.public.app.instanceId}`
      + '/resources/sounds/userJoin.mp3');
  }

  if (userJoinPushAlerts) {
    notify(
      <FormattedMessage
        id={obj.messageId}
        values={obj.messageValues}
        description={obj.messageDescription}
      />,
      obj.notificationType,
      obj.icon,
    );
  }
}

const UserLeftMeetingAlert = (obj) => {
  const {
    userLeaveAudioAlerts,
    userLeavePushAlerts,
  } = Settings.application;

  if (!userLeaveAudioAlerts && !userLeavePushAlerts) return;

  if (userLeaveAudioAlerts) {
    AudioService.playAlertSound(`${Meteor.settings.public.app.cdn
      + Meteor.settings.public.app.basename
      + Meteor.settings.public.app.instanceId}`
      + '/resources/sounds/notify.mp3');
  }

  if (userLeavePushAlerts) {
    notify(
      <FormattedMessage
        id={obj.messageId}
        values={obj.messageValues}
        description={obj.messageDescription}
      />,
      obj.notificationType,
      obj.icon,
    );
  }
}

const UserChangeMyrtilleControlAlert = (obj) => {
  const {
    changeMyrtilleControlAudioAlerts,
    changeMyrtilleControlPushAlerts,
  } = Settings.application;

  if (!changeMyrtilleControlAudioAlerts && !changeMyrtilleControlPushAlerts) return;

  if (changeMyrtilleControlAudioAlerts) {
    AudioService.playAlertSound(`${Meteor.settings.public.app.cdn
      + Meteor.settings.public.app.basename
      + Meteor.settings.public.app.instanceId}`
      + '/resources/sounds/notify.mp3');
  }

  if (changeMyrtilleControlPushAlerts) {
    notify(
      obj.message,
      obj.notificationType,
      obj.icon,
    );
  }
}

const sendAssignMsg = (message, user, receiver) => {
  let privateChat = hasPrivateChatBetweenUsers(user.userId, receiver.userId);
  if (!privateChat) {
    makeCall('createGroupChat', receiver).then((res) => {
      var checkIfChatCreated = setInterval(() => {
        checkIfChatExist();
      }, 1000);

      checkIfChatExist = () => {
        privateChat = hasPrivateChatBetweenUsers(user.userId, receiver.userId)
        if (privateChat) {
          sendMsq(privateChat, message);
          clearInterval(checkIfChatCreated);
        }
      }
    });
  } else {
    const startedChats = Session.get(STARTED_CHAT_LIST_KEY) || [];
    if (_.indexOf(startedChats, privateChat.chatId) < 0) {
      startedChats.push(privateChat.chatId);
      Session.set(STARTED_CHAT_LIST_KEY, startedChats);
    }

    const currentClosedChats = Storage.getItem(CLOSED_CHAT_LIST_KEY);
    if (_.indexOf(currentClosedChats, privateChat.chatId) > -1) {
      Storage.setItem(CLOSED_CHAT_LIST_KEY, _.without(currentClosedChats, privateChat.chatId));
    }

    sendMsq(privateChat, message);
  }
};

const sendMsq = (privateChat, message) => {
  let idChatOpen = privateChat.chatId;

  const chatIdToSent = idChatOpen === PUBLIC_CHAT_ID ? PUBLIC_GROUP_CHAT_ID : idChatOpen;
  const chat = GroupChat.findOne({ chatId: chatIdToSent },
    { fields: { users: 1 } });

  const chatID = idChatOpen === PUBLIC_CHAT_ID
    ? PUBLIC_GROUP_CHAT_ID
    : chat.users.filter((id) => id !== Auth.userID)[0];
  const isPublicChat = chatID === PUBLIC_CHAT_ID;

  let destinationChatId = PUBLIC_GROUP_CHAT_ID;

  const { userID: senderUserId } = Auth;
  const receiverId = { id: chatID };

  if (!isPublicChat) {
    const privateChat = GroupChat.findOne({ users: { $all: [chatID, senderUserId] } },
      { fields: { chatId: 1 } });

    if (privateChat) {
      const { chatId: privateChatId } = privateChat;

      destinationChatId = privateChatId;
    }
  }

  const payload = {
    correlationId: `${senderUserId}-${Date.now()}`,
    sender: {
      id: senderUserId,
      name: '',
      role: '',
    },
    chatEmphasizedText: CHAT_EMPHASIZE_TEXT,
    message,
  };

  const currentClosedChats = Storage.getItem(CLOSED_CHAT_LIST_KEY);

  // Remove the chat that user send messages from the session.
  if (_.indexOf(currentClosedChats, receiverId.id) > -1) {
    Storage.setItem(CLOSED_CHAT_LIST_KEY, _.without(currentClosedChats, receiverId.id));
  }

  return makeCall('sendGroupChatMsg', destinationChatId, payload);
}

export default {
  sortUsersByName,
  sortUsers,
  setEmojiStatus,
  clearAllEmojiStatus,
  assignPresenter,
  removeUser,
  toggleVoice,
  muteAllUsers,
  muteAllExceptPresenter,
  changeRole,
  getUsers,
  formatUsers,
  getActiveChats,
  getAvailableActions,
  curatedVoiceUser,
  normalizeEmojiName,
  isMeetingLocked,
  isPublicChat,
  roving,
  getCustomLogoUrl,
  getGroupChatPrivate,
  hasBreakoutRoom,
  getEmojiList: () => EMOJI_STATUSES,
  getEmoji,
  hasPrivateChatBetweenUsers,
  toggleUserLock,
  requestUserInformation,
  focusFirstDropDownItem,
  isUserPresenter,
  getUsersProp,
  getUserCount,
  sortUsersByCurrent,
  ejectUserCameras,
  UserJoinedMeetingAlert,
  UserLeftMeetingAlert,
  assignMyrtilleControl,
  removeMyrtilleControl,
};
