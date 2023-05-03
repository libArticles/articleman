'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function (defaults) {
  const app = new EmberApp(defaults, {
    // Add options here
    fingerprint: {
      enabled: false,
    },
  });

  const { Webpack } = require('@embroider/webpack');
  return require('@embroider/compat').compatBuild(app, Webpack, {
    packagerOptions: {
      publicAssetURL: EmberApp.env() === 'production' ? 'https://articleman-static.bluelinden.art/assets/' : '/',
      webpackConfig: {
        output: {
          iife: false,
        },
      },
    },
  });
  // return app.toTree();
};
