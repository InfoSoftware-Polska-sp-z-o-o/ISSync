import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Styled from './styles';
import UserParticipantsContainer from './user-participants/container';
import UserMessagesContainer from './user-messages/container';
import UserNotesContainer from './user-notes/container';
import UserCaptionsContainer from './user-captions/container';
import WaitingUsersContainer from './waiting-users/container';
import UserPollsContainer from './user-polls/container';
import BreakoutRoomContainer from './breakout-room/container';
import { isChatEnabled } from '/imports/ui/services/features';

const propTypes = {
  currentUser: PropTypes.shape({}).isRequired,
};

const ROLE_MODERATOR = Meteor.settings.public.user.role_moderator;

class UserContent extends PureComponent {
  render() {
    const {
      currentUser,
      pendingUsers,
      isWaitingRoomEnabled,
      isGuestLobbyMessageEnabled,
      compact,
    } = this.props;

    const showWaitingRoom = (isGuestLobbyMessageEnabled && isWaitingRoomEnabled)
      || pendingUsers.length > 0;

    return (
      <Styled.Content data-test="userListContent">
        <img style={{          
          padding: "10px",
          maxWidth:"140px", 
          maxHeight: "55px", 
          minWidth: "140px",
          minHeight: "55px",
          margin: "auto"
        }}
          src="/images/plarforma-e-learningowa_wwwroot_media_sync.png" />
        {isChatEnabled() ? <UserMessagesContainer /> : null}
        {currentUser.role === ROLE_MODERATOR ? <UserCaptionsContainer /> : null}
        <UserNotesContainer />
        {showWaitingRoom && currentUser.role === ROLE_MODERATOR
          ? (
            <WaitingUsersContainer {...{ pendingUsers }} />
          ) : null}
        <UserPollsContainer isPresenter={currentUser.presenter} />
        <BreakoutRoomContainer />
        <UserParticipantsContainer compact={compact}/>
        <img src="/images/wspia-logo.png" 
        style={{
          padding: "5px",
          maxWidth:"240px", 
          maxHeight: "50px", 
          minWidth: "240px",
          minHeight: "50px",
          margin: "auto",
        }}
          />

        <a style={{textDecoration: 'none'}} href="https://infosoftware.pl" target='_blank'><p style={{textAlign: 'center'}}>Realizacja: InfoSoftware Polska</p></a>
      </Styled.Content>
    );
  }
}

UserContent.propTypes = propTypes;

export default UserContent;
