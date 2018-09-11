'use strict';

/*
 * While the list handling could be done directly in the controller
 * we recommand separating it.
 */
const BluePromise = require('bluebird');
const browserService = require('./browserService');
const PlayerService = require('./PlayerService');
const RaumController = require('./RaumController');
const debug = require('debug')('neeo:player:controller');

const VOLUME_STEP = 4;
const VOLUME_MAX = 65;

/*
 * Device Controller
 * Events on that device from the Brain will be forwarded here for handling.
 */
module.exports = class PlayerController {
  constructor() {
    this._notificationsEnabled = true;
    this.sendMessageToBrainFunction = (param) => {
      debug('NOT_INITIALISED_YET %o', param);
    };

    this.playSwitch = this._getCallbacks(PlayerService.SWITCH_PLAYING);
    this.muteSwitch = this._getCallbacks(PlayerService.SWITCH_MUTE);
    this.shuffleSwitch = this._getCallbacks(PlayerService.SWITCH_SHUFFLE);
    this.repeatSwitch = this._getCallbacks(PlayerService.SWITCH_REPEAT);

    this.volumeSlider = this._getCallbacks(PlayerService.SLIDER_VOLUME);

    this.coverArtSensor = this._getCallbacks(PlayerService.SENSOR_COVERART);
    this.titleSensor = this._getCallbacks(PlayerService.SENSOR_TITLE);
    this.descriptionSensor = this._getCallbacks(PlayerService.SENSOR_DESCRIPTION);

    this.browseRoot = this._getBrowseRootCallbacks();
    this.browseQueue = this._getBrowseQueueCallbacks();
  }

  static build() {
    return new PlayerController();
  }

  sendNotificationToBrain(uniqueDeviceId, component, value) {
    this.sendMessageToBrainFunction({ uniqueDeviceId, component, value })
      .catch((error) => {
        debug('NOTIFICATION_FAILED', error.message);
      });
  }

  setNotificationCallbacks(updateFunction) {
    debug('setNotificationCallbacks');
    this.sendMessageToBrainFunction = updateFunction;
  }

  initialize() {
    debug('initialize player service and raumController');
    this.playerService = PlayerService.build();
    RaumController.setNeeoController(this);
  }

  _getCallbacks(component) {
    return {
      setter: (deviceId, value) => {
        console.log(`Setting component ${deviceId} ${component} to ${value}`);
        this.sendNotificationToBrain(deviceId, component, value);
        return this.playerService.updateState({ deviceId, key: component, value });
      },
      getter: (deviceId) => {
        debug(`Getting component state ${deviceId} ${component}`);
        return this.playerService.getState({ deviceId, key: component });
      },
    };
  }

  _getBrowseQueueCallbacks() {
    return {
      getter: (deviceId, params) => {
        const showQueue = !params.browseIdentifier;
        const browseParams = { deviceId, showQueue, params };
        return browserService.browse(browseParams)
          .catch((error) => {
            console.error('FILEBROWSER_LIST_BUILD_ERROR', { function: '_browseQueue', error });
            throw error;
          });
      },
      action: (deviceId, params) => {
        debug('queue list action called with %o', { deviceId, params });
        return this._updateCurrentTitle(deviceId, params);
      },
    };
  }

  _getBrowseRootCallbacks() {
    return {
      getter: (deviceId, params) => {
        const showRoot = !params.browseIdentifier;
        const browseParams = { deviceId, showRoot, params };
        return browserService.browse(browseParams)
          .catch((error) => {
            console.error('FILEBROWSER_LIST_BUILD_ERROR', { function: '_browseRoot', error });
            throw error;
          });
      },
      action: (deviceId, params) => {
        debug('root list action called with %o', { deviceId, params });
        return this._updateCurrentTitle(deviceId, params);
      },
    };
  }

  _updateCurrentTitle(deviceId, params) {
    if (params && params.actionIdentifier) {
      let action = params.actionIdentifier.split(":");
      if (action[0] == 'Renderer') {
        debug("");
      } else {
        RaumController.updateCurrentPlaying(deviceId, params.actionIdentifier);
        this.playerService.updateState({ deviceId, key: PlayerService.SENSOR_TITLE, value: params.actionIdentifier });
        this.sendNotificationToBrain(deviceId, PlayerService.SENSOR_TITLE, params.actionIdentifier);
      }
    }
    return BluePromise.resolve();
  }

  onButtonPressed(name, deviceId) {
    // On Neeo web remote only button (not switch) events trigger onButtonPressed.
    debug(`${name} button pressed for device ${deviceId}`);
    switch (name) {
      case 'PLAY':
        RaumController.updateState(deviceId, name, true);
        return this.playSwitch.setter(deviceId, true);
      case 'PLAY TOGGLE':
        const currentPlayState = this.playSwitch.getter(deviceId);
        RaumController.updateState(deviceId, name, !currentPlayState);
        return this.playSwitch.setter(deviceId, !currentPlayState);
      case 'PAUSE':
        RaumController.updateState(deviceId, name, true);
        return this.playSwitch.setter(deviceId, false);
      case 'VOLUME UP': { // Firmware version 0.51 remote volume hard buttons not working
        RaumController.getVolume(deviceId)
          .then(function (currentVolume) {
            let volume = (currentVolume + VOLUME_STEP) > VOLUME_MAX ? currentVolume : currentVolume + VOLUME_STEP;
            RaumController.updateState(deviceId, 'VOLUME', volume);
            return this.volumeSlider.setter(deviceId, volume);
          });
        break;
      }
      case 'VOLUME DOWN': {
        RaumController.getVolume(deviceId)
          .then(function (currentVolume) {
            let volume = currentVolume < VOLUME_STEP ? currentVolume : currentVolume - VOLUME_STEP;
            RaumController.updateState(deviceId, 'VOLUME', volume);
            return this.volumeSlider.setter(deviceId, volume);
          });
        break;
      }
      case 'MUTE TOGGLE':
        const currentMuteState = this.muteSwitch.getter(deviceId);
        RaumController.updateState(deviceId, name, !currentMuteState);
        return this.muteSwitch.setter(deviceId, !currentMuteState);
      case 'NEXT TRACK':
        RaumController.updateState(deviceId, name, true);
        return this.titleSensor.setter(deviceId, 'NEXT TRACK');
      case 'PREVIOUS TRACK':
        RaumController.updateState(deviceId, name, true);
        return this.titleSensor.setter(deviceId, 'PREVIOUS TRACK');
      case 'POWER ON':
      case 'POWER OFF':
        RaumController.updateState(deviceId, name, true);
        break;
    }
  }

  updateCoverArt(deviceId, coverArt){
    debug('updating coverArt to: ', coverArt);
    this.coverArtSensor.setter(deviceId, coverArt)
  }

  updateTitle(deviceId, title){
    debug('updating title to: ', title);
    this.titleSensor.setter(deviceId, title)
  }

  updateDescription(deviceId, description){
    debug('updating description to: ', description);
    this.descriptionSensor.setter(deviceId, description)
  }

  updateVolume(deviceId, volume){
    debug('updating volume to: ', volume);
    this.volumeSlider.setter(deviceId, volume);
  }

  updateMute(deviceId, mute){
    debug('updating mute to: ', mute);
    this.muteSwitch.setter(deviceId, mute);
  }

  updatePlay(deviceId, play) {
    debug('updating play to: ', play);
    this.playSwitch.setter(deviceId, play);
  }

  discoverDevices() {
    debug('discovery call');
    return RaumController.discoverDevices();
  }
};
