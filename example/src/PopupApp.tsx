import 'ketcher-react/dist/index.css';

import { useState } from 'react';
import { ButtonsConfig, Editor, InfoModal } from 'ketcher-react';
import { Dialog } from '@mui/material';
import { Ketcher } from 'ketcher-core';
import { getStructServiceProvider } from './utils';

const getHiddenButtonsConfig = (): ButtonsConfig => {
  const searchParams = new URLSearchParams(window.location.search);
  const hiddenButtons = searchParams.get('hiddenControls');

  if (!hiddenButtons) return {};

  return hiddenButtons.split(',').reduce((acc, button) => {
    if (button) acc[button] = { hidden: true };

    return acc;
  }, {});
};

const structServiceProvider = getStructServiceProvider();

const PopupApp = () => {
  const hiddenButtonsConfig = getHiddenButtonsConfig();
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  setTimeout(() => {
    document
      .querySelector('.MuiPaper-root')
      ?.setAttribute('style', `min-width: 680px; min-height: 680px`);
  }, 500);

  return (
    <Dialog
      open={true}
      fullScreen={false}
      maxWidth="xl"
      classes={{ paper: 'ketcher-dialog' }}
    >
      <Editor
        errorHandler={(message: string) => {
          setHasError(true);
          setErrorMessage(message.toString());
        }}
        buttons={hiddenButtonsConfig}
        staticResourcesUrl={process.env.PUBLIC_URL}
        structServiceProvider={structServiceProvider}
        onInit={(ketcher: Ketcher) => {
          window.ketcher = ketcher;

          window.parent.postMessage(
            {
              eventType: 'init',
            },
            '*',
          );
          window.scrollTo(0, 0);
        }}
      />
      {hasError && (
        <InfoModal
          message={errorMessage}
          close={() => {
            setHasError(false);

            // Focus on editor after modal is closed
            const cliparea: HTMLElement | null =
              document.querySelector('.cliparea');
            cliparea?.focus();
          }}
        />
      )}
    </Dialog>
  );
};

export default PopupApp;
