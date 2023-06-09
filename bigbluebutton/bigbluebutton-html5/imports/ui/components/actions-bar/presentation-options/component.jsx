import React from 'react';
import PropTypes from 'prop-types';
import { defineMessages, injectIntl } from 'react-intl';
import Styled from './styles';

const propTypes = {
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
  setPresentationIsOpen: PropTypes.func.isRequired,
};

const intlMessages = defineMessages({
  minimizePresentationLabel: {
    id: 'app.actionsBar.actionsDropdown.minimizePresentationLabel',
    description: '',
  },
  minimizePresentationDesc: {
    id: 'app.actionsBar.actionsDropdown.restorePresentationDesc',
    description: '',
  },
  restorePresentationLabel: {
    id: 'app.actionsBar.actionsDropdown.restorePresentationLabel',
    description: 'Restore Presentation option label',
  },
  restorePresentationDesc: {
    id: 'app.actionsBar.actionsDropdown.restorePresentationDesc',
    description: 'button to restore presentation after it has been closed',
  },
});

const PresentationOptionsContainer = ({
  intl,
  presentationIsOpen,
  setPresentationIsOpen,
  layoutContextDispatch,
  hasPresentation,
  hasExternalVideo,
  hasScreenshare,
}) => {
  let buttonType = 'presentation';
  if (hasExternalVideo) {
    // hack until we have an external-video icon
    buttonType = 'external-video';
  } else if (hasScreenshare) {
    buttonType = 'desktop';
  }

  const isThereCurrentPresentation = hasExternalVideo || hasScreenshare || hasPresentation;
  return (
    <Styled.RestorePresentationButton
      icon={`${buttonType}${!presentationIsOpen ? '_off' : ''}`}
      data-test="restorePresentationButton"
      label={intl.formatMessage(!presentationIsOpen ? intlMessages.restorePresentationLabel : intlMessages.minimizePresentationLabel)}
      aria-label={intl.formatMessage(!presentationIsOpen ? intlMessages.restorePresentationLabel : intlMessages.minimizePresentationLabel)}
      aria-describedby={intl.formatMessage(!presentationIsOpen ? intlMessages.restorePresentationDesc : intlMessages.minimizePresentationDesc)}
      description={intl.formatMessage(!presentationIsOpen ? intlMessages.restorePresentationDesc : intlMessages.minimizePresentationDesc)}
      color={presentationIsOpen ? "primary" : "default"}
      hideLabel
      circle
      size="lg"
      onClick={() => setPresentationIsOpen(layoutContextDispatch, !presentationIsOpen)}
      id="restore-presentation"
      ghost={!presentationIsOpen}
      disabled={!isThereCurrentPresentation}
      data-test={!presentationIsOpen ? 'restorePresentation' : 'minimizePresentation'}
    />
  );
};

PresentationOptionsContainer.propTypes = propTypes;
export default injectIntl(PresentationOptionsContainer);
