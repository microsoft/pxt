import * as rudderanalytics from 'rudder-sdk-js';
rudderanalytics.load(
    '287DKMJUsG92u2S588OJ5CAisGd',
    'https://samlabsdohska.dataplane.rudderstack.com'
);

rudderanalytics.ready(() => {
    console.log('RudderStack ready');
});

export {rudderanalytics};