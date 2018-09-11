'use strict';

const RaumkernelLib = require('node-raumkernel');
const debug = require('debug')('neeo:player:raumController');
const images = require('./directory/images');
var parseString = require('xml2js').parseString;

const browseType = {
    ITEM: 'item',
    CONTAINER: 'container',
    ARTIST: 'Artist',
    ALBUM: 'Album',
    TRACK: 'Track',
    STATION: 'Station',
    FOLDER: 'Folder'
};

module.exports = {
    updateState,
    getBrowseItemsFor,
    getVolume,
    setNeeoController,
    updateCurrentPlaying,
    discoverDevices
}

/*
*  Teufel / Raumfeld device interface to NEEO SDK
*  example use of node-raumkernel: https://github.com/ChriD/node-raumkernel/blob/master/test.js
*/

var neeoController = undefined; // for raumkernel updates to neeo
var deviceEntries = [];
var roomEntries = [];


var raumkernel = new RaumkernelLib.Raumkernel();
raumkernel.init();
raumkernel.createLogger(5);

raumkernel.on("systemReady", function (_ready) {
    debug("Teufel/Raumfeld Controller ready.");
});

raumkernel.on("mediaServerRaumfeldAdded", function (_udn, _mediaServer) {
    debug("Teufel/Raumfeld Media Server found.");
});

raumkernel.on("rendererMediaItemDataChanged", function (_mediaRenderer, _data) {
    // updates for zone (when virtual renderer udn provided), room, device.
    // for control with Teufel app/remote/device change only propagated for device
    let deviceId = _mediaRenderer.name(); // might not be valid deviceId of a discovered device, assume graceful handling from SDK
    if (neeoController && deviceId ) {
        if (_data.albumArtURI)
            neeoController.updateCoverArt(deviceId, _data.albumArtURI);
        if (_data.title)
            neeoController.updateDescription(deviceId, _data.title);
        if (_data.artist) {
            neeoController.updateTitle(deviceId, _data.artist);
        } else if (_data.section) {
            neeoController.updateTitle(deviceId, _data.section);
        }
    } else { // happens during initialization
        debug("neeo controller not set yet.");
    }
});

raumkernel.on("rendererStateKeyValueChanged", function (_mediaRenderer, _key, _oldValue, _newValue, _roomUdn) {
    debug("mediaRenderer room: " + _mediaRenderer.name() + "  roomUdn: ", _roomUdn);
    // updates for zone (when virtual renderer udn provided), room, device.
    // for control with Teufel app/remote/device change only propagated for device
    let deviceId = _mediaRenderer.name(); // might not be valid deviceId of a discovered device, assume graceful handling from SDK
    if (neeoController && deviceId && _key != 'CurrentTrackMetaData') {
        switch (_key) {
            case 'name': break; // at startup found room names
            case 'Volume': neeoController.updateVolume(deviceId, _newValue); break;
            case 'Mute': neeoController.updateMute(deviceId, _newValue); break;
            case 'CurrentTrackMetaData': case 'AVTransportURIMetaData': case 'AVTransportURI':
                break; // using rendererMediaItemDataChanged instead
            case 'CurrentPlayMode': break; // NORMAL, REPEAT_ONE, REPEAT_ALL, RANDOM 
            case 'TransportState':  // TRANSITIONING, PLAYING, STOPPED, NO_MEDIA_PRESENT
                switch (_newValue) {
                    case 'PLAYING': neeoController.updatePlay(deviceId, true); break;
                    case 'NO_MEDIA_PRESENT':
                    case 'STOPPED': neeoController.updatePlay(deviceId, false);
                }
                break;
            case 'RoomVolumes':
            case 'RoomMutes':
            case 'RoomStates': break;
        }
    } else { // happens during initialization stage
        debug("neeo controller not initialized.");
    }
});


// updateState: Neeo onButtonPressed (does not include switches, e.g. on web interface) 
//              passed to roomVirtualMediaRenderer of currently selected room
function updateState(deviceId, key, value) {
    debug('deviceId: ' + deviceId +  '  updateState: ' + key + ' to: ', value);
    var roomVirtualMediaRenderer = _getRoomVirtualMediaRenderer(deviceId);
    if (roomVirtualMediaRenderer) {
        switch (key) {
            case 'PLAY': roomVirtualMediaRenderer.play(true); break;
            case 'PAUSE': roomVirtualMediaRenderer.pause(true); break;
            case 'PLAYING': case 'PLAY TOGGLE': // web interface : remote
                if (value == false)
                    roomVirtualMediaRenderer.pause(true);
                else
                    roomVirtualMediaRenderer.play(true);
                break;
            case 'MUTE': case 'MUTE TOGGLE': roomVirtualMediaRenderer.setMute(value); break;
            case 'SHUFFLE': case 'SHUFFLE TOGGLE': break;
            case 'REPEAT': roomVirtualMediaRenderer.setPlayMode("REPEAT_ALL", true); break;
            case 'REPEAT TOGGLE': break;
            case 'VOLUME': case 'VOLUME UP': case 'VOLUME DOWN': // web interface : remote
                roomVirtualMediaRenderer.setVolume(value);
                break;
            case 'NEXT': case 'NEXT TRACK':roomVirtualMediaRenderer.next(); break;
            case 'PREVIOUS': case 'PREVIOUS TRACK': roomVirtualMediaRenderer.prev(); break;
            case 'CLEAR QUEUE': break;
            case 'POWER ON':
                var mediaRenderer = _getRoomMediaRenderer(deviceId);
                roomVirtualMediaRenderer.leaveStandby(raumkernel.managerDisposer.zoneManager.getRoomUdnForMediaRendererUDN(mediaRenderer.udn()), true).then(function () {
                    var nice = ""
                }).catch(function () {
                    var nice = ""
                })
                break;
            case 'POWER OFF':
                var mediaRenderer = _getRoomMediaRenderer(deviceId);
                mediaRenderer.enterAutomaticStandby(mediaRenderer.roomUdn());
                break;
            default:
        }
    } else {
        console.error('roomVirtualMediaRenderer not found');
    }
}


function updateCurrentPlaying(deviceId, actionIdentifier) {
    debug("deviceId: " + deviceId +  "  updateCurrentPlaying: ", actionIdentifier);
    var roomVirtualMediaRenderer = raumkernel.managerDisposer.deviceManager.getVirtualMediaRenderer(deviceId);
    if (roomVirtualMediaRenderer)
        roomVirtualMediaRenderer.loadSingle(actionIdentifier);
}


function getBrowseItemsFor(browseIdentifier) {
    debug("getBrowseItemsFor: ", browseIdentifier );
    return _browseMediaServer(_getMediaServer(), browseIdentifier);
}



function setNeeoController(controller) {
    neeoController = controller;
}


function getVolume(deviceId) {
    return new Promise(function (resolve, reject) {
        var roomVirtualMediaRenderer = _getRoomVirtualMediaRenderer(deviceId);
        roomVirtualMediaRenderer.getVolume()
            .then(function (volumeVirtual) {
                resolve(+volumeVirtual);  // return volumeVirtual as number
            });
    });
}

function discoverDevices() {
    roomEntries = [];
    deviceEntries = [];
    return new Promise(function (resolve, reject) {
        _getRoomUDNs(); // discover all rooms & devices
        debug("discovered devices: %o", deviceEntries);
        debug("discovered rooms: %o", roomEntries);
        // using roomEntries name as deviceId
        resolve (roomEntries.map(_formatDiscoveryResult));
    });
}

function _formatDiscoveryResult(deviceEntry) {
    return {
        id: deviceEntry.name,
        name: deviceEntry.name,
        reachable: true,
    };
}

function _getRoomVirtualMediaRenderer(name) {
    return raumkernel.managerDisposer.deviceManager.getVirtualMediaRenderer(name);
}


function _getRoomMediaRenderer(name) {
    return raumkernel.managerDisposer.deviceManager.getMediaRenderer(name);
}

// Only called during device discovery process, a change of devices requires a new discovery
function _getRoomUDNs() {
    debug("entering _getRoomUDNS");
    let zones = raumkernel.managerDisposer.zoneManager.zoneConfiguration.zoneConfig.zones[0]['zone'];
    debug("_getRoomUDNs zones: %o ", zones);
    zones.forEach(function (zone) {
        let rooms = zone['room'];
        debug("zone udn: ", zone['$'].udn);
        rooms.forEach(function (room) {
            let roomEntry = [{
                name: room['$'].name,
                udn: room['$'].udn
            }];
            roomEntries = roomEntries.concat(roomEntry);
            debug("       room: " + room['$'].name + "  powerState: " + room['$'].powerState + "  udn: " + room['$'].udn);
            let devices = room['renderer'];
            devices.forEach(function (device) {
                let deviceEntry = [{
                    name: device['$'].name,
                    udn: device['$'].udn
                }];
                deviceEntries = deviceEntries.concat(deviceEntry);
                debug("               device: " + device['$'].name + " udn: " + device['$'].udn);
            });
        });
    });
}


function _getRendererUDNs(name) {
    var mediaRenderer = _getRoomVirtualMediaRenderer(name);
    return mediaRenderer.getRoomRendererUDNs();
}


function _getMediaServer() {
    if (raumkernel.mediaServerReady) {
        return raumkernel.managerDisposer.deviceManager.getRaumfeldMediaServer();
    } else
        console.error("mediaServer not ready");
    return false;
}


function _browseMediaServer(mediaServer, directory) {
    debug("entering browse mediaServer for directory: ", directory);
    return new Promise(function (resolve, reject) {
        if (mediaServer) {
            mediaServer.browse(directory).then(function (_data) {
                parseString(_data, function (err, result) {
                    let list = [];
                    if (('container' in result['DIDL-Lite'])){ // sub directories
                        let items = result['DIDL-Lite']['container'];
                        list = _formatBrowseListModel(items, browseType.CONTAINER);
                    }
                    if (('item' in result['DIDL-Lite'])){ // leaf level items
                        let items = result['DIDL-Lite']['item'] ;
                        list = list.concat(_formatBrowseListModel(items, browseType.ITEM));
                    }
                    if ( list.length == 0 )
                        reject("Raumfeld media server directory: " + directory + "  is empty.")
                    resolve(list);
                });
                reject("Raumfeld media server result parsing failed.")
            });
        } else
            reject("Raumfeld media server not available.");
    });
}


function _formatBrowseListModel(items, type) {
    return items.map((item) => {
        debug("formatting media server item", item);
        var cover = images.folderIcon;
        var libcover = undefined;
        try { libcover = item['upnp:albumArtURI']['0']['_']; } catch (err) { };
        if (type == browseType.ITEM)
            cover = libcover ? libcover : images.fileIcon;
        else
            cover = libcover ? libcover : images.folderIcon;
        return {
            title: item['dc:title']['0'],
            thumbnailUri: cover,
            browseIdentifier: (type == browseType.CONTAINER) ? item['$']['id'] : undefined,
            actionIdentifier: (type == browseType.CONTAINER) ? undefined : item['$']['id'],  // Neeo calls action (not browse) callback when set
        };
    });
}


function loadUri(deviceId, uri) {  // currently not used
    var roomVirtualMediaRenderer = raumkernel.managerDisposer.deviceManager.getVirtualMediaRenderer(deviceId);
    if (roomVirtualMediaRenderer) {
        debug("loading URI: ", uri);
        // !!! WARNING !!! WARNING !!! WARNING !!! WARNING !!!
        // node-raumkernel doesn't resolve diretory path for load.Uri correctly
        // file: node-raumkernel\lib\lib.device.upnp.mediaRenderer.raumfeldVirtual.js
        // updated: var data = Fs.readFileSync(__dirname.replace(/\\/g, "/") + "/setUriMetadata.template");
        // original: var data = Fs.readFileSync(self.getSettings().uriMetaDataTemplateFile);
        roomVirtualMediaRenderer.loadUri(uri).catch(function (_data) {
            debug(_data.toString());
        });
    } else
        debug("mediaRenderer not found.");
}
