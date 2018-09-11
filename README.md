# Raumfeld / Teufel Streaming Player for NEEO

The driver is based on the media player example for the NEEO SDK and is using node-raumkernel to connect to Raumfeld / Teufel Streaming devices. The necessary software can be installed and run on a Raumfeld / Teufel device provided shell access and sufficient memory is available. However, it's not recommended due to the additional computational load.  

You can find the media player example at https://github.com/NEEOInc/neeo-sdk-examples/tree/master/lib/playerComponent

To find out more about NEEO, the Brain and "The Thinking Remote" checkout https://neeo.com/.

## Prerequisite

* node.js v6 (or greater), see http://nodejs.org
* neeo-sdk, see https://github.com/NEEOInc/neeo-sdk
* node-raumkernel, see https://github.com/ChriD/node-raumkernel 

## Getting started

1. Update tiles specified in file browserService.js function getRootListModel with your own favorite radio stations / albums / playlists / ... (e.g. by browsing the root folder with a running driver to find available items)
2. Install and start the driver, see NEEO SDK documentation.
3. Add Raumfeld / Teufel device(s) with NEEO app searching for: 'Teufel Raumfeld Player using Neeo SDK'. Autodiscovery should identify available 'rooms' setup with the Raumfeld / Teufel app. The Raumfeld / Teufel devices should be setup in 'rooms' and active to allow for correct discovery.

## Limitations

* Queue list and controls in the media player example have not been updated to work with Raumfeld / Teufel devices.
* NEEO Firmware 0.51.13 does not support the remote hard buttons for volume for a media player, a fix is planned for a future release. Workaround, add recipes for volume up and down.
* Device discovery and control is limited to rooms.
* Tested only with a Raumfeld Soundbar and a Raumfeld One S setup in different rooms and the Neeo SDK running on a Windows 10 and a Raspberry Pi 3 environment.
* Only onButtonPressed events for controls (play, pause, mute,...) from the physical remote are supported. Since they are not 'buttons', but 'switches' for the media player when using the NEEO app or web interface they do not work there.
* List browsing is currently limited to the default 64 elements, dynamic load for larger lists like in the Kodi driver has not been implemented yet.

## Updates

The implementation is based on a pre-release version of the NEEO media player example and its NEEO firmware support. Thus, I plan to update the neeo-driver-raumfeld later in 2018 probably also addressing some of the above listed limitations. 

