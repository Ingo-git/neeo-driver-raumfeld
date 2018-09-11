'use strict';

const neeoapi = require('neeo-sdk');
const capabilities = require('./capabilities');
const PlayerController = require('./PlayerController');

/*
 * Raumfeld / Teufel Streaming Player
 * The player functionality is based on the playerComponent example for the Neeo SDK
 *
 * Current player requirements:
 * - node-raumkernel nodejs based interface to Raumfeld/Teufel streaming devices
 * - device type: MUSICPLAYER
 * - components and sensors: see below
 * - directories: root, queue and browse
 */

const controller = PlayerController.build();
const discoveryInstructions = {
  headerText: 'Discover devices',
  description: 'NEEO will discover your Raumfeld / Teufel Streaming setup now, press NEXT'
};

const playerDevice = neeoapi.buildDevice('Raumfeld Player using Neeo SDK')
  .setManufacturer('Teufel')
  .setIcon('sonos')
  .setType('MUSICPLAYER')
  .addAdditionalSearchToken('SDK')
  .addAdditionalSearchToken('player')
  // please note the arrow function here, needed so "this" is pointing to the controller
  // also check out
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions#No_separate_this
  .registerSubscriptionFunction((...args) => controller.setNotificationCallbacks(...args))
  .registerInitialiseFunction(() => controller.initialize())
  .enableDiscovery(discoveryInstructions, controller.discoverDevices)
  .addRootDirectory({
    name: 'PLAYER_ROOT_DIRECTORY',
    label: 'ROOT',
  }, controller.browseRoot)
  .addQueueDirectory({
    name: 'PLAYER_QUEUE_DIRECTORY',
    label: 'QUEUE',
  }, controller.browseQueue);

// We use a helper to simplify adding all the player capabilities
addCapabilities(playerDevice);
/*
 * The last step is to export the driver, this makes it available to the
 * to tools like the CLI to start running the driver.
 */
module.exports = {
  devices: [
    playerDevice,
  ],
};

/**
 * The player widget requires a lot of different components:
 * - Switches
 *   - MUTE (including MUTE_SENSOR)
 *   - PLAYING (including PLAYING_SENSOR)
 *   - REPEAT (including REPEAT_SENSOR)
 *   - SHUFFLE (including SHUFFLE_SENSOR)
 * - Sliders
 *   - VOLUME (including VOLUME_SENSOR)
 * - Sensors (read only)
 *   - COVER_ART_SENSOR
 *   - TITLE_SENSOR
 *   - DESCRIPTION_SENSOR
 * - Directories
 *   - A root directory
 *   - A queue directory
 *
 * In addition the following buttons are also used:
 * - PLAY
 * - PLAY TOGGLE
 * - PAUSE
 * - VOLUME UP
 * - VOLUME DOWN
 * - MUTE TOGGLE
 * - NEXT TRACK
 * - PREVIOUS TRACK
 * - SHUFFLE TOGGLE
 * - REPEAT TOGGLE
 * - CLEAR QUEUE
 *
 * @param {*} device
 */
function addCapabilities(device) {
  capabilities.buttons.forEach((button) => {
    device.addButton(button);
  });
  device.addButtonHandler((name, deviceId) => controller.onButtonPressed(name, deviceId));

  capabilities.switches.forEach((component) => {
    device.addSwitch({
      name: component.name,
    }, controller[component.callbackName] );
  });

  capabilities.sliders.forEach((component) => {
    device.addSlider({
      name: component.name,
      unit: component.unit,
      range: component.range,
    }, controller[component.callbackName] );
  });

  capabilities.sensors.forEach((component) => {
    device.addSensor({
      name: component.name,
      type: component.type,
      unit: component.unit,
      range: component.range,
    }, controller[component.callbackName] );
  });

}
