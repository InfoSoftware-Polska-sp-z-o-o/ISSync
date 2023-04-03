import React, { useContext } from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import Auth from '/imports/ui/services/auth';
import { layoutSelect, layoutSelectOutput, layoutDispatch, layoutSelectInput } from '../layout/context';
import { UsersContext } from '/imports/ui/components/components-data/users-context/context';

import ExternalScreenComponent from './component'

import { getVideoUrl } from './service';

const ExternalScreenContainer = (props) => {
    const screenShare = layoutSelectOutput((i) => i.screenShare);
    const fullscreen = layoutSelect((i) => i.fullscreen);
    const layoutContextDispatch = layoutDispatch();
  
    const { element } = fullscreen;
    const fullscreenElementId = 'ExternalScreen';
    const fullscreenContext = (element === fullscreenElementId);

    const cameraDock = layoutSelectInput((i) => i.cameraDock);
    const { isResizing } = cameraDock;

    const usingUsersContext = useContext(UsersContext);
    const { users } = usingUsersContext;
    const currentUser = users[Auth.meetingID][Auth.userID];
    const isPresenter = currentUser.presenter;
    const meetingId = Auth.meetingID;

    return (<ExternalScreenComponent
       {
        ...{
            layoutContextDispatch,
            ...props,
            ...screenShare,
            fullscreenContext,
            isResizing,
            fullscreenElementId,
            isPresenter,
            meetingId
        }}
    />)
}


// export default  ExternalScreenContainer;


export default withTracker(({ isPresenter }) => {
    const inEchoTest = Session.get('inEchoTest');
    return {
      inEchoTest,
      isPresenter,
      videoUrl: getVideoUrl(),
    };
  })(ExternalScreenContainer);
  